// 트리거 실행
// Node.js 스케줄러는 Node 프로세스가 계속 실행되고 있어야 합니다.
const { createDailySchedule } = require("./Services/02_Scheduler.js");

createDailySchedule();