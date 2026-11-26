/**
 * @file PerformanceService.js
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-26
 * @description
 * 교육 실적 현황 화면에서 사용하는 수료 실적(수료실적_RAW) 데이터 조회
 *
 * 주요 기능:
 * - PERFORMANCE Apps Script 호출 (SheetService 공통 요청 처리 재사용)
 * - B:AN 행 배열을 SheetConfig.HEADERS.PERFORMANCE 기준 객체로 변환
 * - 시트 헤더가 설정과 다를 경우 경고 메시지 반환 (컬럼 이동 감지)
 * - 짧은 시간 메모리 캐시로 반복 조회 시 Apps Script 호출 최소화
 *
 * 20261126 수정: 자체 1분 캐시 → 공통 서버 캐시(DataCache, CacheConfig.TTL_MINUTES) 사용
 */


const SHEET_CONFIG = require("../Configs/SheetConfig.js");
const DataCache = require("../Utils/DataCache.js"); // 20261126 추가: 공통 서버 캐시

const {
    createRequestUrl,
    requestAppsScript,
    readResponseText,
    validateHttpResponse,
    parseJsonResponse,
    validateApiResult,
} = require("./SheetService.js");


// =============================================================
// 1. 설정
// =============================================================
const TYPE = "PERFORMANCE";
const CACHE_KEY = "performance"; // 20261126 수정: 공통 캐시 키

const LOG_PREFIX = "[PerformanceService]";


// =============================================================
// 2. 헤더 비교용 정규화 (공백·줄바꿈 차이 무시)
// =============================================================
function normalizeHeader(value) {
    return String(value ?? "").replace(/\s+/g, "").trim();
}


// =============================================================
// 3. 시트 헤더 검증
// 설정된 컬럼명과 시트 4행 헤더가 다르면 경고 목록 반환
// =============================================================
function getHeaderWarnings(sheetHeaders) {

    const expectedHeaders = SHEET_CONFIG.HEADERS.PERFORMANCE;

    if (!Array.isArray(sheetHeaders) || sheetHeaders.length === 0) {
        return [];
    }

    return expectedHeaders.reduce((warnings, expected, index) => {

        const actual = sheetHeaders[index];

        if (normalizeHeader(actual) !== normalizeHeader(expected)) {
            warnings.push(`${index + 1}번째 컬럼: 예상 "${expected}" / 시트 "${actual ?? ""}"`);
        }

        return warnings;
    }, []);
}


// =============================================================
// 4. 행 배열 → 객체 변환
// =============================================================
function rowToRecord(row) {

    const headers = SHEET_CONFIG.HEADERS.PERFORMANCE;

    return Object.fromEntries(
        headers.map((header, index) => [
            header,
            row[index] === null || row[index] === undefined
                ? ""
                : String(row[index]).trim(),
        ])
    );
}


// =============================================================
// 5. 수료 실적 조회
// refresh=true 이면 캐시를 무시하고 다시 조회
// =============================================================
// 20261126 수정: 공통 서버 캐시 사용
async function getPerformanceRecords({ refresh = false } = {}) {

    const { value } = await DataCache.getOrFetch(
        CACHE_KEY,
        fetchPerformanceRecords,
        { refresh }
    );

    return value;
}


// =============================================================
// 5-1. 수료 실적 Apps Script 조회
// 20261126 수정: 캐시 처리 분리
// =============================================================
async function fetchPerformanceRecords() {

    const startedAt = Date.now(); // 20261125 추가: 소요 시간 로그

    console.log(`${LOG_PREFIX} Apps Script 요청 시작`);

    // ---------------------------------------------------------
    // 5-1. Apps Script 요청 (토큰은 설정된 경우에만 전달)
    // ---------------------------------------------------------
    const url = createRequestUrl(TYPE, {
        token: SHEET_CONFIG.PERFORMANCE?.TOKEN,
    });

    const response = await requestAppsScript(url, TYPE);

    // ---------------------------------------------------------
    // 5-2. 응답 검증 및 데이터 추출
    // ---------------------------------------------------------
    const responseText = await readResponseText(response, TYPE);

    console.log(`${LOG_PREFIX} Apps Script 응답 수신: HTTP ${response.status} (${Date.now() - startedAt}ms)`);

    validateHttpResponse(response, responseText);

    const payload = parseJsonResponse(responseText);
    const rows = validateApiResult(payload);

    // ---------------------------------------------------------
    // 5-3. 객체 변환 및 헤더 확인
    // ---------------------------------------------------------
    const records = rows
        .filter((row) => Array.isArray(row))
        .map(rowToRecord);

    const headerWarnings = getHeaderWarnings(payload.headers);

    if (headerWarnings.length > 0) {
        console.warn(`${LOG_PREFIX} 시트 헤더가 설정과 다릅니다.`);
        headerWarnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    console.log(`${LOG_PREFIX} 수료 실적 ${records.length}건 조회 (${Date.now() - startedAt}ms)`);

    const result = {
        records,
        headerWarnings,
        fetchedAt: new Date().toISOString(),
    };

    return result;
}


module.exports = {
    getPerformanceRecords,
};