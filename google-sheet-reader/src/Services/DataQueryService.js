/**
 * @file DataQueryService.js
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 웹 화면용 교육 일정 / 발송 로그 조회 (서버 캐시 적용)
 *
 * 20261126 추가: 데이터 로드 속도 개선
 *
 * 주요 기능:
 * - 교육 일정 날짜 범위·특정 날짜 조회 결과 캐시
 * - 발송 로그 전체 조회 결과 캐시
 * - API 라우터와 미리 불러오기(PrefetchService)에서 공통 사용
 *
 * 주의:
 * - 발송 자동화(01_Main.js)는 이 서비스를 사용하지 않고 SheetService를 직접 호출
 *   → 문자·이메일 발송은 항상 시트의 최신 데이터 기준
 */

const SHEET_CONFIG = require("../Configs/SheetConfig.js");
const DataCache = require("../Utils/DataCache.js");
const {
    getRowsByDate,
    getRowsByDateRange,
} = require("./SheetService.js");


// =============================================================
// 1. 캐시 키
// =============================================================
const CACHE_KEYS = {
    education: (type) => `education:${type}:`,
    educationRange: (type, startDate, endDate) => `education:${type}:range:${startDate}:${endDate}`,
    educationDate: (type, date) => `education:${type}:date:${date}`,
    logs: "logs",
};

const LOG_REQUEST_TIMEOUT_MS = 120000;


// =============================================================
// 2. 교육 일정 날짜 범위 조회
// 반환: { value: 교육 데이터 배열, fetchedAt, cached }
// =============================================================
function getEducationRange(businessType, startDate, endDate, { refresh = false } = {}) {

    return DataCache.getOrFetch(
        CACHE_KEYS.educationRange(businessType, startDate, endDate),
        () => getRowsByDateRange(startDate, endDate, businessType),
        { refresh }
    );
}


// =============================================================
// 3. 교육 일정 특정 날짜 조회
// =============================================================
function getEducationDate(businessType, date, { refresh = false } = {}) {

    return DataCache.getOrFetch(
        CACHE_KEYS.educationDate(businessType, date),
        () => getRowsByDate(date, businessType),
        { refresh }
    );
}


// =============================================================
// 4. 발송 로그 Apps Script 조회
// 기존 logRoutes.js GET 처리를 이동
// =============================================================
async function fetchLogRecords() {

    const LOG_CONFIG = SHEET_CONFIG.LOG;

    const url = LOG_CONFIG?.APPS_SCRIPT_URL;
    const token = LOG_CONFIG?.TOKEN;
    const spreadsheetId = LOG_CONFIG?.SPREADSHEET?.ID;

    if (!url) throw new Error("로그 Apps Script URL이 설정되지 않았습니다.");
    if (!token) throw new Error("로그 API 인증키가 설정되지 않았습니다.");
    if (!spreadsheetId) throw new Error("로그 스프레드시트 ID가 설정되지 않았습니다.");

    if (typeof fetch !== "function") {
        throw new Error("현재 Node.js 환경에서 fetch를 사용할 수 없습니다.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOG_REQUEST_TIMEOUT_MS);

    try {
        console.log("[DataQueryService] 발송 로그 조회 시작");

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                action: "read",
                token,
                spreadsheetId,
            }),
            redirect: "follow",
            signal: controller.signal,
        });

        const responseText = await response.text();
        let responseData;

        try {
            responseData = JSON.parse(responseText);
        } catch (error) {
            console.error("[DataQueryService] 로그 응답 JSON 파싱 실패:", responseText.slice(0, 500));
            throw new Error(`Apps Script 로그 응답이 JSON 형식이 아닙니다: HTTP ${response.status}`);
        }

        if (!response.ok || !responseData.success) {
            throw new Error(
                responseData.message || `Apps Script 로그 조회 실패: HTTP ${response.status}`
            );
        }

        if (!Array.isArray(responseData.data)) {
            throw new Error("Apps Script 응답의 data가 배열 형태가 아닙니다.");
        }

        console.log(`[DataQueryService] 발송 로그 조회 완료: ${responseData.data.length}건`);

        return responseData.data;

    } catch (error) {

        if (error.name === "AbortError") {
            const timeoutError = new Error("발송 로그 조회 시간이 초과되었습니다.");
            timeoutError.isTimeout = true;
            throw timeoutError;
        }

        throw error;

    } finally {
        clearTimeout(timeoutId);
    }
}


// =============================================================
// 5. 발송 로그 조회 (캐시)
// =============================================================
function getLogRecords({ refresh = false } = {}) {

    return DataCache.getOrFetch(
        CACHE_KEYS.logs,
        fetchLogRecords,
        { refresh }
    );
}


// =============================================================
// 6. 발송 로그 캐시 비우고 다시 불러오기
// 발송 로그가 추가된 뒤 호출 (실패해도 발송 결과에는 영향 없음)
// =============================================================
function invalidateLogRecords() {

    DataCache.invalidate(CACHE_KEYS.logs);

    // 다음 화면 조회가 빠르도록 뒤에서 다시 불러오기
    getLogRecords({ refresh: true }).catch((error) => {
        console.warn(`[DataQueryService] 발송 로그 다시 불러오기 실패: ${error.message}`);
    });
}


// =============================================================
// 7. 캐시된 발송 로그의 수동 발송 확인 상태 수정
// =============================================================
function updateCachedManualConfirmation(updatedRecord) {

    return DataCache.update(CACHE_KEYS.logs, (records) =>
        records.map((record) =>
            String(record.ID) === String(updatedRecord.ID)
                ? {
                    ...record,
                    수동발송확인: updatedRecord.수동발송확인,
                    수동확인일시: updatedRecord.수동확인일시,
                }
                : record
        )
    );
}


module.exports = {
    CACHE_KEYS,
    getEducationRange,
    getEducationDate,
    getLogRecords,
    invalidateLogRecords,
    updateCachedManualConfirmation,
};
