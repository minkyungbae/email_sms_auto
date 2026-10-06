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