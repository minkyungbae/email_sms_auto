/**
 * @file app.js
 * @description
 * 매일 오전 10시 자동 발송 스케줄러 실행
 */

// =======================================
// 1. 모듈 불러오기
// =======================================
const path = require("path");

const {
    createDailySchedule,
} = require(
    path.join(
        __dirname,
        "google-sheet-reader",
        "src",
        "Services",
        "00_Scheduler.js"
    )
);


// =======================================
// 2. 트리거 실행
// =======================================
createDailySchedule();
