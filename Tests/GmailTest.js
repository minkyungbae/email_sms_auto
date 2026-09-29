/**
 * =================================================================
 * 99_GmailTest.gs
 * - 실제 강사 이메일이 아닌 지정된 테스트 수신자에게 실제 메일을 1건 발송
 * - TemplateService / MessageConfig를 사용하여 실제 운영 메시지와 동일한 형식으로 테스트
 * =================================================================
 */

function runProgramTestForMyEmail() {
  const testRecipientEmail = securityInfo.TEST_PERSONAL_INFO.TEST_EMAIL;
  const MAX_TEST_COUNT = 1; // 전체 건 중에서 1개만 반환

  console.log(`[테스트 발송] Gmail 테스트`);

  try {
    // -----------------------------------------------------------------
    // 1. 테스트 대상 날짜
    // -----------------------------------------------------------------
    const targetDateStr = Utils.getFutureDateString( CONFIG.DAYS_BEFORE);
    console.log(`[테스트 대상 날짜] ${targetDateStr}`);

    // -----------------------------------------------------------------
    // 2. 수업 데이터 조회
    // -----------------------------------------------------------------
    const upcomingClasses = SheetService.getClassesByDate( targetDateStr);
    console.log(`[조회된 수업] ${upcomingClasses.length}건`);

    if (upcomingClasses.length === 0) {
      console.warn(`[알림] ${targetDateStr} 날짜에 해당하는 수업이 없습니다.`);
      return;
    }

    // -----------------------------------------------------------------
    // 3. 교육 그룹화
    // -----------------------------------------------------------------
    const groupedClasses = groupClassesForMail(upcomingClasses);
    const testTargets = groupedClasses.slice(0, MAX_TEST_COUNT);

    console.log(`[테스트 대상] 전체 ${groupedClasses.length}건 중 ${testTargets.length}건`);

    // -----------------------------------------------------------------
    // 4. 실제 Gmail 발송
    // -----------------------------------------------------------------
    let successCount = 0;
    let failedCount = 0;

    testTargets.forEach(
      function(item, index) {

        try {
          // -----------------------------------------------------------
          // 4-1. TemplateService를 통해 MessageConfig의 EMAIL 템플릿 사용
          // -----------------------------------------------------------
          const emailMsg = TemplateService.createMessage(item, "EMAIL");
          const subject = emailMsg.subject || "";
          const bodyText = emailMsg.bodyText || "";

          console.log(`[Gmail 테스트 발송] ${index + 1}/${testTargets.length}`);
          console.log(`제목: ${subject}`);
          console.log(`본문:\n${bodyText}`);

          // -----------------------------------------------------------
          // 4-2. Gmail 발송
          // -----------------------------------------------------------
          GmailApp.sendEmail(
            testRecipientEmail,
            subject,
            bodyText,
            {
              name: emailMsg.senderName || "강원SW미래채움"
            }
          );
          successCount++;

          console.log(`[Gmail 테스트 성공]`);

          // -----------------------------------------------------------
          // 4-3. 테스트 로그 기록
          // -----------------------------------------------------------
          const logKey = `TEST_EMAIL_${item.logKey || Date.now()}`;

          LogService.queueLog(
            logKey,
            item,
            testRecipientEmail,
            subject,
            bodyText,
            "EMAIL"
          );
        } catch (error) {
          failedCount++;
          console.error(`[Gmail 테스트 발송 실패] ${error.message}`);
          console.error( error.stack );
        }
      }
    );

    // -----------------------------------------------------------------
    // 5. 테스트 로그 저장
    // -----------------------------------------------------------------
    try {
      LogService.flushLogs();
      console.log("[로그 저장 완료]");
    } catch (error) {
      console.error(`[로그 저장 오류] ${error.message}`);
      console.error(error.stack);
    }

    // -----------------------------------------------------------------
    // 6. 최종 결과
    // -----------------------------------------------------------------
    console.log(`[Gmail 테스트 완료] 성공: ${successCount}건 | 실패: ${failedCount}건`);
  } catch (error) {
    console.error(`[Gmail 테스트 실행 오류] ${error.message}`);
    console.error(error.stack);
  }
}