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

module.exports = {
    rowToObject,
};