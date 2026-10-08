/**
 * @file DataMapper.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * Google Sheet의 2차원 배열 행 데이터를 설정된 헤더 기준의 객체 배열 구조로 매핑 및 변환
 * 주요 기능 :
 * - SheetConfig의 헤더 목록과 행의 인덱스를 1:1로 매핑하여 Key-Value 객체 생성
 * - 조회 요청 날짜를 각 데이터 객체의 '근무날짜' 필드로 일괄 부여
 * - 단일 행(rowToObject) 및 다중 행(rowToObjects)에 대한 데이터 구조 변환 처리
 */


const SHEET_CONFIG = require("../Configs/SheetConfig.js");

// Google Sheet의 한 행을 객체로 변환
function rowToObject(row, targetDate) {
    const headers = SHEET_CONFIG.HEADERS;

    const data = Object.fromEntries(
        headers.map((header, index) => [
            header,
            row[index] ?? null,
        ])
    );

    data["근무날짜"] = targetDate; // 2026-10-06 변경: 근무날짜를 targetDate로 설정

    return data;
}

function rowToObjects(rows, targetDate) {
    return rows.map(row => rowToObject(row, targetDate));
} // 2026-10-06 추가: 여러 행을 객체 배열로 변환하는 함수

module.exports = {
    rowToObject,
    rowToObjects, // 2026-10-06 추가: 여러 행을 객체 배열로 변환하는 함수
};