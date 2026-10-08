/**
 * @file SheetService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * Google Apps Script API를 연동하여 특정 날짜의 구글 시트 데이터를 조회하고 객체 배열 구조로 매핑
 * 
 * 주요 기능 :
 * - 사업별 Apps Script URL 선택
 * - 지정된 날짜를 기반으로 Google Sheet 조회
 * - API 응답 상태 및 JSON 포맷 검증
 * - DataMapper를 통한 객체 배열 변환
 */


const SHEET_CONFIG = require("../Configs/SheetConfig.js");
const DataMapper = require("../Utils/DataMapper.js");

// =================================================================
// 특정 날짜의 Google Sheet 데이터 조회
//
// businessType
// - GW : 강원
// - DS : 디지털새싹
//
// 기존 코드와의 호환을 위해 기본값은 GW
// =================================================================
async function getRowsByDate(
    date,
    businessType = "GW"
) {
    // 사업 타입 정리
    const type = String(businessType).trim().toUpperCase();


    // 지원하는 사업인지 확인
    if (!SHEET_CONFIG.APPS_SCRIPT_URL[type]) {
        throw new Error(`지원하지 않는 사업 유형입니다: ${businessType}` );
    }

    // 사업별 Apps Script URL
    const appsScriptUrl = SHEET_CONFIG.APPS_SCRIPT_URL[type];
    const url = `${appsScriptUrl}?date=${encodeURIComponent(date)}`;
    console.log(`[SheetService] ${type} 데이터 조회: ${date}`);

    const response = await fetch(url);

    console.log("[SheetService] 요청 URL:", url);
    console.log("[SheetService] HTTP 상태:", response.status);

    // 응답 본문
    const responseText = await response.text();

    console.log("[SheetService] Apps Script 응답 원문:");
    // console.log(responseText);

    // HTTP 오류
    if (!response.ok) {
        throw new Error(`Apps Script 요청 실패: ${response.status}`);
    }

    // JSON 파싱
    let result;

    try {
        result = JSON.parse(responseText);
    } catch (error) {
        console.error("[SheetService] JSON 파싱 실패");
        console.error("[SheetService] 응답 앞 500자:");
        console.error(responseText.slice(0, 500));

        throw new Error(
            "Apps Script가 JSON이 아닌 응답을 반환했습니다."
        );
    }

    if (!result.success) {
        throw new Error(result.message || "Google Sheet 조회 실패");
    }

    if (!Array.isArray(result.data)) {
        throw new Error("Apps Script 응답의 data가 배열이 아닙니다.");
    }
    console.log(
        `[SheetService] ${type} 조회 결과: ${result.data.length}건`
    );

     // 2026-10-08 변경: type 추가
    return DataMapper.rowToObjects(
        result.data,
        date,
        type
    );
}

module.exports = {
    getRowsByDate,
};