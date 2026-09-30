/**
 * 02_Scheduler.js
 * 매일 지정된 시간에 자동 실행하기 위한 트리거(스케줄러) 관리
 */

/** 매일 atHour 시간에 실행 트리거 등록 */

const cron = require("node-cron");
const {runNotificationProcess} = require("./01_Main.js");

// ----------------------------------------------------------------
// 1. 매일 {schedule}시에 교육 안내 자동 발송 실행
// ----------------------------------------------------------------
function createDailySchedule() {

    const schedule = "0 11 * * *";

    cron.schedule(schedule, async () => {

        console.log(`[스케줄러 실행] 교육안내 자동발송 프로세스를 시작합니다.`);

        try {
            await runNotificationProcess();

            console.log("[스케줄러 완료] 교육안내 자동발송이 완료되었습니다.");

        } catch (error) {
            console.error("[스케줄러 오류]", error);
        }
    });
    console.log(`[스케줄러 등록 완료] 매일 ${schedule}시에 실행됩니다.`);
}

module.exports = {
    createDailySchedule
};
