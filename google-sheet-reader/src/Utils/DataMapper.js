const SHEET_CONFIG = require("../Configs/SheetConfig.js");

// Google Sheet의 한 행을 객체로 변환
function rowToObject(row) {
    const headers = SHEET_CONFIG.HEADERS;

    return Object.fromEntries(
        headers.map((header, index) => [
            header,
            row[index] ?? null,
        ])
    );
}

function rowToObjects(rows) {
    return rows.map(rowToObject);
} // 2026-10-06 추가: 여러 행을 객체 배열로 변환하는 함수

module.exports = {
    rowToObject,
    rowToObjects, // 2026-10-06 추가: 여러 행을 객체 배열로 변환하는 함수
};