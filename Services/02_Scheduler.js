/**
 * 02_Scheduler.gs
 * 매일 지정된 시간에 자동 실행하기 위한 트리거(스케줄러) 관리
 */

/** 매일 atHour 시간에 실행 트리거 등록 */
function createDailyTrigger() {
  clearTriggers(); // 중복 트리거 방지 삭제
  
  const atHour = 11;

  ScriptApp.newTrigger("runNotificationProcess")
    .timeBased()
    .everyDays(1)
    .atHour(atHour)
    .create();
    
  console.log(`[트리거 등록 완료] 매일 ${atHour}시대에 교육안내 자동발송이 실행되도록 스케줄러를 등록했습니다.`);
}

/** 기존 등록된 동일 트리거 초기화 */
function clearTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "runNotificationProcess") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  console.log("[트리거 초기화 완료]");
}
