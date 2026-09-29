/**
 * =================================================================
 * DSSmsTest.gs
 * - 실제 강사 전화번호로 발송하는 것이 아닌, 지정된 테스트 수신자 번호로 DS SMS 발송
 * - DS 시트 데이터 및 TemplateService를 사용하여 테스트 문자를 발송
 * =================================================================
 */

function runDSTestForMyPhone() {
  const testPhone = securityInfo.TEST_PERSONAL_INFO.TEST_PHONE;
  const MAX_TEST_COUNT = 1;

  console.log(`[테스트 발송] DS SMS 테스트`);

  try {
    // -----------------------------------------------------------------
    // 1. 테스트 대상 날짜
    // -----------------------------------------------------------------
    const targetDateStr = Utils.getFutureDateString(CONFIG.DAYS_BEFORE);

    console.log(`[테스트 대상 날짜] ${targetDateStr}`);

    // -----------------------------------------------------------------
    // 2. 해당 날짜의 DS 수업 정보 조회
    // -----------------------------------------------------------------
    const upcomingClasses = SheetService.getClassesByDate(targetDateStr);
    const dsClasses = upcomingClasses.filter(item => item.businessType === "DS");

    if (dsClasses.length === 0) {
      console.warn(`[알림] ${targetDateStr} 날짜에 등록된 DS 수업 데이터가 없습니다.`);
      return;
    }

    // -----------------------------------------------------------------
    // 3. 테스트 대상 선정
    // -----------------------------------------------------------------
    const testTargets = dsClasses.slice(0, MAX_TEST_COUNT);

    console.log(`[안내] 총 ${dsClasses.length}개 DS 수업 중 상위 ${testTargets.length}건만 테스트 발송합니다.` );

    // -----------------------------------------------------------------
    // 4. 지정된 testPhone 번호로 SMS 발송
    // -----------------------------------------------------------------
    let successCount = 0;
    let failedCount = 0;

    testTargets.forEach(function(item, index) {
      try {
        // -------------------------------------------------------------
        // 4-1. DS 메시지 생성
        // -------------------------------------------------------------
        const smsMsg = TemplateService.createMessage(item, "SMS");

        console.log(`[SMS 테스트 발송] ${index + 1}/${testTargets.length}`);
        console.log(`[제목] ${smsMsg.subject || "(없음)"}`);
        console.log(`[내용] ${smsMsg.bodyText || ""}`);

        // -------------------------------------------------------------
        // 4-2. SmsService를 통해 SMS/LMS 자동 판별 및 발송
        // -------------------------------------------------------------
        const result = SmsService.send(testPhone, smsMsg,`TEST_DS_${Date.now()}`);

        // -------------------------------------------------------------
        // 4-3. 발송 결과
        // -------------------------------------------------------------
        if (result.success) {
          successCount++;

          console.log(`[문자 테스트 성공] MessageKey: ${result.messageKey || "(없음)"}`);

          const messageType = SmsService.getByteLength(smsMsg.bodyText) > 90 ? "LMS" : "SMS";

          LogService.queueLog(
            `TEST_DS_${item.logKey || Date.now()}`,
            item,
            testPhone,
            smsMsg.subject || "",
            smsMsg.bodyText || "",
            messageType
          );
        } else {
          failedCount++;
          console.error(`[문자 테스트 실패] ${result.error}`);
        }
      } catch (error) {
        failedCount++;

        console.error(`[SMS 테스트 오류] ${error.message}`);
        console.error(error.stack);
      }
    });

    // -----------------------------------------------------------------
    // 5. 로그 저장
    // -----------------------------------------------------------------
    try {
      LogService.flushLogs();
      console.log("[로그 저장 완료]");
    } catch (error) {
      console.error(`[로그 저장 오류] ${error.message}`);
      console.error(error.stack);
    }

    // -----------------------------------------------------------------
    // 6. 결과
    // -----------------------------------------------------------------
    console.log(`[DS SMS 테스트 완료] 성공: ${successCount}건 | 실패: ${failedCount}건`);
  } catch (error) {
    console.error(`[DS SMS 테스트 실행 오류] ${error.message}`);
    console.error(error.stack);
  }
}