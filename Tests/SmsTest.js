/**
 * =================================================================
 * SmsTest.gs
 * - 실제 강사 전화번호로 발송하는 것이 아닌, 지정된 테스트 수신자 번호로 문자 발송
 * - SmsService / TemplateService / MessageConfig를 사용하여 테스트 문자를 발송
 * =================================================================
 */

function runSmsTestForMyPhone() {
  const testPhone = securityInfo.TEST_PERSONAL_INFO.TEST_PHONE;
  const MAX_TEST_COUNT = 1;

  console.log(`[테스트 발송] SMS/LMS 테스트`);

  try {
    // -----------------------------------------------------------------
    // 1. 테스트 대상 날짜
    // -----------------------------------------------------------------
    const targetDateStr = Utils.getFutureDateString(CONFIG.DAYS_BEFORE);

    console.log(`[테스트 대상 날짜] ${targetDateStr}`);

    // -----------------------------------------------------------------
    // 2. 해당 날짜의 수업 정보 조회
    // -----------------------------------------------------------------
    const upcomingClasses = SheetService.getClassesByDate(targetDateStr);

    if (upcomingClasses.length === 0) {
      console.warn(`[알림] ${targetDateStr} 날짜로 등록된 수업 데이터가 시트에 없습니다.`);
      return;
    }
    console.log(`[조회된 수업] ${upcomingClasses.length}건`);

    // -----------------------------------------------------------------
    // 3. 동일 교육 그룹화
    // -----------------------------------------------------------------
    const groupedClasses = groupClassesForMail(upcomingClasses);
    const testTargets = groupedClasses.slice(0, MAX_TEST_COUNT);

    console.log(`[안내] 총 ${groupedClasses.length}개 대상 중 상위 ${testTargets.length}건만 테스트 발송합니다.`);

    // -----------------------------------------------------------------
    // 4. 지정된 testPhone 번호로 실제 문자 발송
    // -----------------------------------------------------------------
    let successCount = 0;
    let failedCount = 0;

    testTargets.forEach(function(item, index) {

      try {
        // -------------------------------------------------------------
        // 4-1. TemplateService를 통해 MessageConfig 템플릿 사용
        // -------------------------------------------------------------
        const smsMsg = TemplateService.createMessage(item, "SMS");
        const subject = smsMsg.subject || "";
        const messageText = smsMsg.bodyText || "";

        // -------------------------------------------------------------
        // 4-2. 메시지 확인
        // -------------------------------------------------------------
        console.log(`[SMS 테스트 발송] ${index + 1}/${testTargets.length}`);
        console.log(`[수신자] ${testPhone}`);
        console.log(`[제목] ${subject || "(없음)"}`);
        console.log(`[내용] ${messageText}`);

        // -------------------------------------------------------------
        // 4-3. 뿌리오 발송
        // -------------------------------------------------------------
        const ppurioCfg = CONFIG.PPURIO;
        const accessToken = SmsService.getAccessToken();

        if (!accessToken) {
          throw new Error("뿌리오 Access Token 발급 실패");
        }
        const cleanPhone = String(testPhone).replace(/[^0-9]/g, "");
        const byteSize = SmsService.getByteLength(messageText);
        const isLms = byteSize > 90;
        const messageType = isLms ? "LMS" : "SMS";

        let refKey = `TEST_${messageType}_${item.logKey || Date.now()}`;

        if (refKey.length > 32) {
          refKey = refKey.substring(0, 32);
        }

        const payload = {
          account: ppurioCfg.ACCOUNT,
          messageType: messageType,
          content: messageText,
          from: ppurioCfg.SENDER_NUMBER,
          duplicateFlag: "N",
          targetCount: 1,

          targets: [
            {
              to: cleanPhone,
              changeWord: {}
            }
          ],
          refKey: refKey
        };

        if (isLms && subject) { payload.subject = subject; }

        const options = {
          method: "post",

          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=utf-8"
          },

          payload:
            JSON.stringify(payload),

          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(`${ppurioCfg.API_URL}/v1/message`, options);
        const responseCode = response.getResponseCode();
        const responseText = response.getContentText();

        let responseData;

        try { responseData = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`뿌리오 응답 JSON 파싱 실패: ${responseText}`);
        }
        console.log(`[뿌리오 응답] ${responseCode} ${responseText}`);

        // -------------------------------------------------------------
        // 4-4. 발송 결과 확인
        // -------------------------------------------------------------
        if (responseCode === 200 && responseData.code === "1000") {
          successCount++;

          console.log(`[${messageType} 테스트 성공] ${testPhone} | MessageKey: ${responseData.messageKey}`);

          LogService.queueLog(
            refKey,
            item,
            testPhone,
            subject,
            messageText,
            messageType
          );

        } else {
          failedCount++;

          console.error(
            `[${messageType} 테스트 실패] HTTP: ${responseCode} | 코드: ${responseData.code} | 메시지: ${responseData.description}`
          );
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
    console.log(`[SMS 테스트 완료] 성공: ${successCount}건 | 실패: ${failedCount}건`);
  } catch (error) {
    console.error(`[SMS 테스트 실행 오류] ${error.message}`);
    console.error(error.stack);
  }
}