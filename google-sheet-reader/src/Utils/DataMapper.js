/**
 * @file DataMapper.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * Google Sheet / Apps Script의 데이터를 Node.js 애플리케이션에서 사용하는 객체 배열 구조로 변환
 * 
 * 주요 기능 :
 * - SheetConfig의 헤더 목록과 행의 인덱스를 1:1로 매핑하여 Key-Value 객체 생성
 * - 조회 요청 날짜를 각 데이터 객체의 '근무날짜' 필드로 일괄 부여
 * - 단일 행(rowToObject) 및 다중 행(rowToObjects)에 대한 데이터 구조 변환 처리
 * 
 * 사업별 데이터 구조
 * ---------------------------------------------------------------
 * GW
 * - Apps Script에서 2차원 배열(row)을 반환
 * - HEADERS.GW 기준으로 객체 변환
 *
 * DS
 * - Apps Script에서 이미 객체 형태로 반환
 * - 별도의 헤더 매핑 없이 그대로 사용
 */

const SHEET_CONFIG = require("../Configs/SheetConfig.js");

// Google Sheet의 한 행을 객체로 변환
function rowToObject(
    row,
    targetDate,
    businessType = "GW"
) {
    const type = String(businessType).trim().toUpperCase();

    // DS
    // DS GAS는 이미 객체 형태로 데이터를 반환하므로 헤더를 기준으로 다시 매핑하지 않음
    if (type === "DS") {
        
        // 혹시 잘못된 형태의 데이터가 들어오는 경우를 방어
        if (
            !row ||
            typeof row !== "object" ||
            Array.isArray(row)
        ) {
            throw new Error("DS 데이터 형식이 올바르지 않습니다.");
        }
        return {
            ...row,
            근무날짜: row["근무날짜"] || targetDate,
        };
    }

    // GW
    if (type === "GW") {
        
        const headers = SHEET_CONFIG.HEADERS.GW;

        if (!Array.isArray(row)) {
            throw new Error("GW 데이터 형식이 올바르지 않습니다.");
        }
        const data = Object.fromEntries(
            headers.map(
                (header, index) => [header, row[index] ?? null,]
            )
        );
        data["근무날짜"] = targetDate;
        
        return data;
    }
    throw new Error(`지원하지 않는 사업 유형입니다: ${businessType}`);
}


function rowToObjects(
    rows,
    targetDate,
    businessType = "GW"
) {
    if (!Array.isArray(rows)) {

        throw new Error("변환할 데이터가 배열 형태가 아닙니다.");
    }
    return rows.map(
        row => rowToObject(row, targetDate, businessType));
}

module.exports = {
    rowToObject,
    rowToObjects,
};