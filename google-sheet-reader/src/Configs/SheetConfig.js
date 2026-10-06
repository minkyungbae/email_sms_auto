require("dotenv").config();

const SHEET_CONFIG = {
    APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL,

    HEADERS: [
        "지역",
        "월",
        "강사유형",
        "사번",
        "강사시급",
        "강사이름",
        "근무유형",
        "내용(수요처명)",
        "반명",
        "근무시간",
        "근무날짜",

        // 2026-10-06 추가: 강사 정보
        "연락처",
        "이메일목록",
        "연락처매칭상태",
    ],
};

module.exports = SHEET_CONFIG;