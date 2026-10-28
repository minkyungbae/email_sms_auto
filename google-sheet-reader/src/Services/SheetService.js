
/**
 * @file SheetService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-28
 * @description
 * Google Apps Script API를 연동하여 특정 날짜의 구글 시트 데이터를 조회하고 객체 배열 구조로 매핑
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
// 2. 특정 날짜의 Google Sheet 데이터 조회
//
// businessType
// - GW : 강원
// - DS : 디지털새싹
//
// 기존 코드와의 호환을 위해 기본값은 GW
// =============================================================
async function getRowsByDate(
    date,
    businessType = "GW"
) {

    // ---------------------------------------------------------
    // 2-1. 사업 유형 정리
    // ---------------------------------------------------------
    const type = String(businessType).trim().toUpperCase();


    // ---------------------------------------------------------
    // 2-2. 날짜 유효성 검사
    // ---------------------------------------------------------
    const targetDate = String(date ?? "").trim();

    if (!targetDate) {
        throw new Error("[SheetService] 조회할 날짜가 없습니다.");
    }


    // ---------------------------------------------------------
    // 2-3. 지원하는 사업인지 확인
    // ---------------------------------------------------------
    const configuredUrl = SHEET_CONFIG.APPS_SCRIPT_URL?.[type];

    if (!configuredUrl) {
        throw new Error(`지원하지 않거나 Apps Script URL이 설정되지 않은 사업입니다: ${type}`);
    }


    // ---------------------------------------------------------
    // 2-4. Apps Script URL 검증 및 생성
    // ---------------------------------------------------------
    let url;

    try {
        const appsScriptUrl = String(configuredUrl).trim();

        url = new URL(appsScriptUrl);

        // HTTP / HTTPS만 허용
        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {
            throw new Error("지원하지 않는 URL 프로토콜입니다.");
        }

        // 조회 날짜 추가
        url.searchParams.set("date", targetDate);

    } catch (error) {

        throw new Error(`[SheetService] ${type} Apps Script URL이 올바르지 않습니다: ${error.message}`);

    }


    // ---------------------------------------------------------
    // 2-5. 요청 시작
    // ---------------------------------------------------------
    console.log("");
    console.log("========================================");
    console.log(`[SheetService] ${type} 데이터 조회: ${targetDate}`);
    console.log("[SheetService] 요청 URL:", url.toString());
    console.log("[SheetService] Apps Script 요청 시작");
    console.log("========================================");


    // ---------------------------------------------------------
    // 2-6. 요청 타임아웃 설정
    // ---------------------------------------------------------
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        console.log(`[SheetService] ${type} 요청 시간 초과 (600초)`);
        controller.abort();
    }, 600000);

    let response;

    try {
        response = await fetch(url, {

            method: "GET",

            headers: {
                Accept: "application/json",
            },

            // Apps Script 리디렉션 허용
            redirect: "follow",
            signal: controller.signal,
        });
    } catch (error) {

        // -----------------------------------------------------
        // 네트워크 오류 상세 확인
        // -----------------------------------------------------
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


        // 타임아웃
        if (error.name === "AbortError") {

            throw new Error(`[SheetService] ${type} 데이터 조회 시간 초과 (60초)`);

        }

        throw new Error(`[SheetService] ${type} Apps Script 통신 실패 (${errorCode}): ${errorMessage}`);

    } finally {

        clearTimeout(timeoutId);

    }


    // ---------------------------------------------------------
    // 2-7. 응답 수신 확인
    // ---------------------------------------------------------
    console.log("");
    console.log(`[SheetService] ${type} 응답 수신 완료`);
    console.log("[SheetService] HTTP 상태:", response.status);
    console.log("[SheetService] 최종 응답 URL:", response.url);


    // ---------------------------------------------------------
    // 2-8. 응답 본문 조회
    // ---------------------------------------------------------
    let responseText;

    try {

        responseText = await response.text();

    } catch (error) {

        const rootCause = getRootCause(error);

        console.error("[SheetService] 응답 본문 읽기 실패:", rootCause.message);

        throw new Error(`[SheetService] ${type} 응답 본문을 읽을 수 없습니다: ${rootCause.message}`);

    }


    // ---------------------------------------------------------
    // 2-9. HTTP 오류 확인
    // ---------------------------------------------------------
    if (!response.ok) {

        console.error("[SheetService] HTTP 요청 실패");
        console.error("상태 코드:", response.status);
        console.error("응답 내용:", responseText.slice(0, 500));

        throw new Error(`Apps Script 요청 실패: HTTP ${response.status}`);

    }


    // ---------------------------------------------------------
    // 2-10. JSON 파싱
    // ---------------------------------------------------------
    let result;

    try {

        result = JSON.parse(responseText);

    } catch (error) {

        console.error("[SheetService] JSON 파싱 실패");
        console.error("[SheetService] 응답 앞 500자:");
        console.error(responseText.slice(0, 500));

        throw new Error("Apps Script가 JSON이 아닌 응답을 반환했습니다.");

    }


    // ---------------------------------------------------------
    // 2-11. API 응답 상태 확인
    // ---------------------------------------------------------
    if (!result.success) {

        throw new Error(result.message || "Google Sheet 조회 실패");

    }


    // ---------------------------------------------------------
    // 2-12. 데이터 배열 검증
    // ---------------------------------------------------------
    if (!Array.isArray(result.data)) {

        throw new Error("Apps Script 응답의 data가 배열이 아닙니다.");

    }


    // ---------------------------------------------------------
    // 2-13. 조회 결과 출력
    // ---------------------------------------------------------
    console.log("");
    console.log(`[SheetService] ${type} 조회 결과: ${result.data.length}건`);


    // ---------------------------------------------------------
    // 2-14. DataMapper를 이용한 객체 변환
    // ---------------------------------------------------------
    return DataMapper.rowToObjects(
        result.data,
        targetDate,
        type
    );

}


module.exports = {
    getRowsByDate,
};
