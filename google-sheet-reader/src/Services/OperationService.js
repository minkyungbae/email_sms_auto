/**
 * @file OperationService.js
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-27
 * @description
 * 운영 데이터 시트 조회 (수요처정보 / 운영인력정보 / 강사배정 / 센터 강사비(연간·지역) / 센터 교구재 / MBO)
 *
 * 주요 기능:
 * - LOG Apps Script 에 action: readsheet 요청 (발송 로그와 같은 스프레드시트·토큰 사용)
 * - OperationParser 로 시트 표시 값을 화면용 데이터로 변환
 * - 공통 서버 캐시(DataCache, CacheConfig.TTL_MINUTES) 사용
 * - 20261127 추가: MBO 진행현황 수정 (action: updatembo), 수정 후 캐시 값도 함께 수정
 */

const SHEET_CONFIG = require("../Configs/SheetConfig.js");
const DataCache = require("../Utils/DataCache.js");
const Parser = require("../Utils/OperationParser.js");


// =============================================================
// 1. 설정
// =============================================================
const LOG_PREFIX = "[OperationService]";
const CACHE_KEY_PREFIX = "operations:";
const REQUEST_TIMEOUT_MS = 300000; // 300초

const PARSERS = {
    "demand": Parser.parseDemand,
    "staff": Parser.parseStaff,
    "assignment": Parser.parseAssignment,
    "fee-annual": Parser.parseFeeAnnual,
    "fee-region": Parser.parseFeeRegion,
    "materials": Parser.parseMaterials,
    "mbo": Parser.parseMbo, // 20261127 추가
};


// =============================================================
// 2. LOG Apps Script 요청 (20261127 수정: 조회·수정 공통)
// =============================================================
async function requestLogAppsScript(body, label) {

    const LOG_CONFIG = SHEET_CONFIG.LOG;

    const url = LOG_CONFIG?.APPS_SCRIPT_URL;
    const token = LOG_CONFIG?.TOKEN;
    const spreadsheetId = LOG_CONFIG?.SPREADSHEET?.ID;

    if (!url) throw new Error("로그 Apps Script URL이 설정되지 않았습니다.");
    if (!token) throw new Error("로그 API 인증키가 설정되지 않았습니다.");
    if (!spreadsheetId) throw new Error("로그 스프레드시트 ID가 설정되지 않았습니다.");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                ...body,
                token,
                spreadsheetId,
            }),
            redirect: "follow",
            signal: controller.signal,
        });

        const responseText = await response.text();
        let payload;

        try {
            payload = JSON.parse(responseText);
        } catch (error) {
            console.error(`${LOG_PREFIX} 응답 JSON 파싱 실패:`, responseText.slice(0, 500));
            throw new Error(`Apps Script 응답이 JSON 형식이 아닙니다: HTTP ${response.status}`);
        }

        if (!response.ok || !payload.success) {
            // 액션이 없는 이전 버전 Apps Script 인 경우 안내
            if (String(payload.message ?? "").includes("지원하지 않는 요청")) {
                throw new Error(`LOG Apps Script에 ${body.action} 기능이 없습니다. LOG_Code.gs를 업데이트하고 새 버전으로 배포해 주세요.`);
            }
            throw new Error(payload.message || `Apps Script ${label} 실패: HTTP ${response.status}`);
        }

        return payload;

    } catch (error) {

        if (error.name === "AbortError") {
            throw new Error(`${label} 시간이 초과되었습니다.`);
        }

        throw error;

    } finally {
        clearTimeout(timeoutId);
    }
}


// =============================================================
// 2-1. 시트 표시 값 조회
// 반환: { grid: 2차원 표시 값, listOptions: 드롭다운 선택지(MBO만) }
// =============================================================
async function fetchSheetGrid(sheetName) {

    const payload = await requestLogAppsScript({ action: "readsheet", sheetName }, `${sheetName} 시트 조회`);

    if (!Array.isArray(payload.data)) {
        throw new Error("Apps Script 응답의 data가 배열 형태가 아닙니다.");
    }

    return {
        grid: payload.data.map((row) => (Array.isArray(row) ? row.map((value) => String(value ?? "")) : [])),
        listOptions: Array.isArray(payload.listOptions) ? payload.listOptions : [],
    };
}


// =============================================================
// 3. 운영 데이터 조회 (캐시 사용, refresh=true 이면 다시 조회)
// =============================================================
function isOperationKey(key) {
    return Object.prototype.hasOwnProperty.call(PARSERS, key);
}

async function getOperationData(key, { refresh = false } = {}) {

    if (!isOperationKey(key)) {
        const error = new Error(`지원하지 않는 운영 데이터입니다: ${key}`);
        error.status = 404;
        throw error;
    }

    const sheetName = SHEET_CONFIG.OPERATIONS.SHEETS[key];

    const { value, fetchedAt } = await DataCache.getOrFetch(
        `${CACHE_KEY_PREFIX}${key}`,
        async () => {
            const startedAt = Date.now();
            const { grid, listOptions } = await fetchSheetGrid(sheetName);
            const data = PARSERS[key](grid, { listOptions });

            console.log(`${LOG_PREFIX} ${sheetName} 조회 완료 (${grid.length}행, ${Date.now() - startedAt}ms)`);

            return data;
        },
        { refresh }
    );

    return {
        key,
        sheetName,
        fetchedAt,
        data: value,
    };
}


// =============================================================
// 4. MBO 진행현황 수정 (20261127 추가)
// 시트에 저장 후, 캐시에 있는 MBO 데이터의 해당 지표도 같이 수정
// =============================================================
async function updateMboProgress({ row, name, status, note, actual }) {

    const payload = await requestLogAppsScript(
        { action: "updatembo", row, name, status, note, actual },
        "MBO 진행현황 저장"
    );

    const saved = payload.data ?? {};
    const savedRow = String(saved.row ?? row);

    DataCache.update(`${CACHE_KEY_PREFIX}mbo`, (value) => ({
        ...value,
        kpis: (value.kpis ?? []).map((kpi) => (kpi.행 === savedRow
            ? {
                ...kpi,
                진행상태: saved.진행상태 ?? kpi.진행상태,
                진행현황: saved.진행현황 ?? kpi.진행현황,
                진행실적: saved.진행실적 ?? kpi.진행실적, // 20261127 추가
                진행율: saved.진행율 ?? kpi.진행율, // 20261127 추가
            }
            : kpi)),
    }));

    console.log(`${LOG_PREFIX} MBO 진행현황 저장 완료 (${savedRow}행)`);

    return {
        행: savedRow,
        진행상태: String(saved.진행상태 ?? ""),
        진행현황: String(saved.진행현황 ?? ""),
        진행실적: String(saved.진행실적 ?? ""),
        진행율: String(saved.진행율 ?? ""),
    };
}


module.exports = {
    getOperationData,
    updateMboProgress, // 20261127 추가
};
