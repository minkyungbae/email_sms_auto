const SHEET_CONFIG = require("../Configs/SheetConfig.js");

async function getOneRow() {
    const response = await fetch(SHEET_CONFIG.APPS_SCRIPT_URL);

    if (!response.ok) {
        throw new Error(
            `Apps Script 요청 실패: ${response.status}`
        );
    }

    const result = await response.json();

    if (!result.success) {
        throw new Error("Google Sheet 조회 실패");
    }

    return result.data;
}

module.exports = {
    getOneRow,
};