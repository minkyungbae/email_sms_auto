/**
 * @file SheetService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-12
 * @description
 * Google Apps Script API를 연동하여 특정 날짜의 Google Sheet 데이터를 조회하고
 * 객체 배열 구조로 매핑
 *
 * 주요 기능:
 * - 사업별 Apps Script URL 선택
 * - 지정된 날짜를 기반으로 Google Sheet 조회
 * - 요청 타임아웃 및 네트워크 오류 처리
 * - API 응답 상태 및 JSON 포맷 검증
 * - DataMapper를 통한 객체 배열 변환
 */

const SHEET_CONFIG = require("../Configs/SheetConfig.js");
const DataMapper = require("../Utils/DataMapper.js");


// =============================================================
// 설정
// =============================================================
const REQUEST_TIMEOUT_MS = 600000;


// =============================================================
// 1. 네트워크 오류 원인 확인
// =============================================================
function getRootCause(error) {

    let current = error;

    while (
        current &&
        current.cause &&
        current.cause !== current
    ) {
        current = current.cause;
    }

    return current || error;
}


// =============================================================
// 2. 사업 유형 정리
// =============================================================
function normalizeBusinessType(businessType) {

    return String(businessType).trim().toUpperCase();
}


// =============================================================
// 3. 조회 날짜 검증
// =============================================================
function validateDate(date) {

    const targetDate = String(date ?? "").trim();

    if (!targetDate) {
        throw new Error("[SheetService] 조회할 날짜가 없습니다.");
    }

    return targetDate;
}


// =============================================================
// 4. Apps Script URL 생성 및 검증
// =============================================================
function createRequestUrl(type, targetDate) {

    const configuredUrl = SHEET_CONFIG.APPS_SCRIPT_URL?.[type];

    if (!configuredUrl) {
        throw new Error(`지원하지 않거나 Apps Script URL이 설정되지 않은 사업입니다: ${type}`);
    }

    try {
        const url = new URL(
            String(configuredUrl).trim()
        );

        // HTTP / HTTPS만 허용
        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {
            throw new Error("지원하지 않는 URL 프로토콜입니다.");
        }

        // 조회 날짜 추가
        url.searchParams.set("date", targetDate);

        return url;

    } catch (error) {
        throw new Error(`[SheetService] ${type} Apps Script URL이 올바르지 않습니다: ${error.message}`);

    }
}


// =============================================================
// 5. Apps Script API 요청
// =============================================================
async function requestAppsScript(url, type) {

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {

        console.log(`[SheetService] ${type} 요청 시간 초과 (600초)`);

        controller.abort();

    }, REQUEST_TIMEOUT_MS);

    try {

        const response = await fetch(url, {

            method: "GET",

            headers: {
                Accept: "application/json",
            },

            // Apps Script 리디렉션 허용
            redirect: "follow",

            signal: controller.signal,

        });

        return response;

    } catch (error) {
        handleNetworkError(error, url, type);

    } finally {
        clearTimeout(timeoutId);

    }
}


// =============================================================
// 6. 네트워크 오류 처리
// =============================================================
function handleNetworkError(error, url, type) {

    const rootCause = getRootCause(error);

    const errorCode = rootCause.code || error.code || "UNKNOWN";

    const errorMessage = rootCause.message || error.message;

    console.error("");
    console.error("========================================");
    console.error(`[SheetService] ${type} 요청 실패`);
    console.error("========================================");

    console.error("오류 유형:", error.name);
    console.error("오류 코드:", errorCode);
    console.error("오류 상세:", errorMessage);

    if (rootCause.syscall) {
        console.error("시스템 호출:", rootCause.syscall);
    }

    if (rootCause.hostname) {
        console.error("호스트:", rootCause.hostname);
    }
    console.error("요청 URL:", url.toString());

    // 요청 타임아웃
    if (error.name === "AbortError") {

        throw new Error(`[SheetService] ${type} 데이터 조회 시간 초과 (600초)`);

    }

    throw new Error(`[SheetService] ${type} Apps Script 통신 실패 (${errorCode}): ${errorMessage}`);
}


// =============================================================
// 7. API 응답 본문 조회
// =============================================================
async function readResponseText(response, type) {

    try {
        return await response.text();

    } catch (error) {
        const rootCause = getRootCause(error);

        console.error("[SheetService] 응답 본문 읽기 실패:", rootCause.message);

        throw new Error(`[SheetService] ${type} 응답 본문을 읽을 수 없습니다: ${rootCause.message}`);
    }
}


// =============================================================
// 8. HTTP 응답 상태 확인
// =============================================================
function validateHttpResponse(response, responseText) {

    if (!response.ok) {
        console.error("[SheetService] HTTP 요청 실패");
        console.error("상태 코드:", response.status);
        console.error("응답 내용:", responseText.slice(0, 500));

        throw new Error(`Apps Script 요청 실패: HTTP ${response.status}`);
    }
}


// =============================================================
// 9. JSON 응답 파싱
// =============================================================
function parseJsonResponse(responseText) {

    try {
        return JSON.parse(responseText);

    } catch (error) {
        console.error("[SheetService] JSON 파싱 실패");
        console.error("[SheetService] 응답 앞 500자:");
        console.error(responseText.slice(0, 500));

        throw new Error("Apps Script가 JSON이 아닌 응답을 반환했습니다.");
    }
}


// =============================================================
// 10. API 응답 데이터 검증
// =============================================================
function validateApiResult(result) {

    // JSON 응답이 객체인지 확인
    if (
        !result ||
        typeof result !== "object" ||
        Array.isArray(result)
    ) {
        throw new Error("Apps Script 응답 형식이 올바르지 않습니다.");
    }

    // API 처리 결과 확인
    if (!result.success) {
        throw new Error(result.message || "Google Sheet 조회 실패");
    }

    // 데이터 배열 확인
    if (!Array.isArray(result.data)) {
        throw new Error("Apps Script 응답의 data가 배열이 아닙니다.");
    }
    return result.data;
}


// =============================================================
// 11. 응답 처리
// =============================================================
async function processResponse(response, type) {

    console.log("");
    console.log(`[SheetService] ${type} 응답 수신 완료`);
    console.log("[SheetService] HTTP 상태:", response.status);
    console.log("[SheetService] 최종 응답 URL:", response.url);

    // 응답 본문 조회
    const responseText = await readResponseText(response, type);

    // HTTP 상태 확인
    validateHttpResponse(response, responseText);

    // JSON 파싱
    const result = parseJsonResponse(responseText);

    // API 응답 데이터 검증
    return validateApiResult(result);
}


// =============================================================
// 12. 특정 날짜의 Google Sheet 데이터 조회
// businessType: GW, DS
// 기존 코드와의 호환을 위해 기본값은 GW
// =============================================================
async function getRowsByDate(
    date,
    businessType = "GW"
) {
    // ---------------------------------------------------------
    // 12-1. 사업 유형 및 날짜 정리
    // ---------------------------------------------------------
    const type = normalizeBusinessType(businessType);
    const targetDate = validateDate(date);


    // ---------------------------------------------------------
    // 12-2. Apps Script URL 생성
    // ---------------------------------------------------------
    const url = createRequestUrl(type, targetDate);


    // ---------------------------------------------------------
    // 12-3. 요청 시작 로그
    // ---------------------------------------------------------
    console.log("");
    console.log("========================================");
    console.log(`[SheetService] ${type} 데이터 조회: ${targetDate}`);
    console.log("[SheetService] 요청 URL:", url.toString());
    console.log("[SheetService] Apps Script 요청 시작");
    console.log("========================================");


    // ---------------------------------------------------------
    // 12-4. Apps Script API 요청
    // ---------------------------------------------------------
    const response = await requestAppsScript(url, type);


    // ---------------------------------------------------------
    // 12-5. 응답 처리 및 데이터 검증
    // ---------------------------------------------------------
    const rows = await processResponse(response, type);


    // ---------------------------------------------------------
    // 12-6. 조회 결과 출력
    // ---------------------------------------------------------
    console.log("");
    console.log(`[SheetService] ${type} 조회 결과: ${rows.length}건`);


    // ---------------------------------------------------------
    // 12-7. DataMapper를 이용한 객체 변환
    // ---------------------------------------------------------
    return DataMapper.rowToObjects(
        rows,
        targetDate,
        type
    );

}


module.exports = {
    getRowsByDate,
};
