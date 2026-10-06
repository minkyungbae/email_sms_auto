const SHEET_CONFIG = require("../Configs/SheetConfig.js");
const DataMapper = require("../Utils/DataMapper.js");

async function getOneRow() {
    const response = await fetch(SHEET_CONFIG.APPS_SCRIPT_URL);

    if (!response.ok) {
        throw new Error(
            `Apps Script 요청 실패: ${response.status}`
        );
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error(
            result.message || "Google Sheet 조회 실패"
        );
    }

    return DataMapper.rowToObjects(result.data); // 2026-10-06 변경: 여러 행을 객체 배열로 변환
}

module.exports = {
    getOneRow,
};