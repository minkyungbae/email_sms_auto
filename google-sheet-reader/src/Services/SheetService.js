const SHEET_CONFIG = require("../Configs/SheetConfig.js");
const DataMapper = require("../Utils/DataMapper.js");

async function getRowsByDate(date) { // 2026-10-06 변경: 특정 날짜의 여러 행을 조회하는 함수로 변경
    const url =
        `${SHEET_CONFIG.APPS_SCRIPT_URL}?date=${encodeURIComponent(date)}`;

    const response = await fetch(url);

    console.log("HTTP 상태:", response.status);

    const responseText = await response.text();

    // console.log("Apps Script 실제 응답:");
    // console.log(responseText);

    if (!response.ok) {
        throw new Error(
            `Apps Script 요청 실패: ${response.status}`
        );
    }

    let result;

    try {
        result = JSON.parse(responseText);
    } catch (error) {
        throw new Error("Apps Script가 JSON이 아닌 응답을 반환했습니다.");
    }

    if (!result.success) {
        throw new Error(result.message || "Google Sheet 조회 실패");
    }

     // 2026-10-06 변경: 특정 날짜의 여러 행을 객체 배열로 변환
    return DataMapper.rowToObjects(
        result.data,
        date
    );
}

module.exports = {
    getRowsByDate,
};