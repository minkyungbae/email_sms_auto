/**
 * =================================================================
 * 01_Main.gs
 *
 * 교육 안내 자동 발송 메인 실행 파일
 *
 * 실행 흐름
 * 1. 서비스 초기화
 * 2. 기존 발송 로그 로드
 * 3. 대상 날짜 계산
 * 4. 강사 연락처 조회
 * 5. 수업 데이터 조회
 * 6. 수업 그룹화
 * 7. 이메일 / 문자 발송
 * 8. 로그 일괄 저장
 * =================================================================
 */

// -----------------------------------------------------------------
// 1. 메인 실행 함수
// -----------------------------------------------------------------
function runNotificationProcess() {

  console.log("=== 교육 안내 자동 발송 시작 ===");

  try {
    // -----------------------------------------------------------------
    // 1-1. 서비스 초기화
    // -----------------------------------------------------------------
    LogService.initialize();


    // -----------------------------------------------------------------
    // 1-2. 기존 발송 로그 로드
    // -----------------------------------------------------------------
    LogService.preloadSentLogs();


    // -----------------------------------------------------------------
    // 1-3. 대상 날짜 계산
    // -----------------------------------------------------------------
    const targetDate = Utils.getFutureDateString(CONFIG.DAYS_BEFORE);
    console.log(`[발송 대상 날짜] ${targetDate}`);


    // -----------------------------------------------------------------
    // 1-4. 강사 연락처 조회
    // -----------------------------------------------------------------
    const instructorContacts = SheetService.getInstructorContactMap();


    // -----------------------------------------------------------------
    // 1-5. 대상 날짜의 수업 조회
    // -----------------------------------------------------------------
    const classes = SheetService.getClassesByDate(targetDate);
    console.log(`[조회된 수업 행] ${classes.length}건`);


    // -----------------------------------------------------------------
    // 1-6. 발송 대상이 없는 경우 종료
    // -----------------------------------------------------------------
    if (classes.length === 0) {
      console.log("[종료] 발송 대상이 없습니다.");
      return;
    }


    // -----------------------------------------------------------------
    // 1-7. 원본 데이터 사업 유형 확인
    // -----------------------------------------------------------------
    classes.forEach(function(item, index) {

      console.log(
        `[원본 ${index + 1}] 사업=${item.businessType || item.type || "GW"} | ` +
        `강사=${item.instructorName} | 학교=${item.location}`
      );
    });


    // -----------------------------------------------------------------
    // 1-8. 동일 교육 그룹화
    // -----------------------------------------------------------------
    const groupedClasses = groupClassesForMail(classes);

    console.log(`[최종 발송 대상] ${groupedClasses.length}건`);


    // -----------------------------------------------------------------
    // 1-9. 발송 통계 초기화
    // -----------------------------------------------------------------
    const statistics = NotificationService.createStatistics();


    // -----------------------------------------------------------------
    // 1-10. 이메일 / 문자 발송
    // -----------------------------------------------------------------
    groupedClasses.forEach(
      function(item) {

        // 강사 연락처 정보
        const contact = instructorContacts[item.instructorName] || {};

        // ---------------------------------------------------------
        // 1-10-1. EMAIL
        // ---------------------------------------------------------
        if (CONFIG.ENABLE_EMAIL) {
          const email = item.email || contact.email || "";
          const result = NotificationService.send(item, "EMAIL", email);

          NotificationService.updateStatistics(statistics, result);

        } else {
          console.log("[EMAIL 스킵] CONFIG.ENABLE_EMAIL=false");
        }

        // ---------------------------------------------------------
        // 1-10-2. SMS
        // ---------------------------------------------------------
        if (CONFIG.ENABLE_SMS) {
          const phone = item.phone || contact.phone || "";
          const result = NotificationService.send(item, "SMS", phone);

          NotificationService.updateStatistics(statistics, result);
        } else {
          console.log("[SMS 스킵] CONFIG.ENABLE_SMS=false");
        }
      }
    );
    // ---------------------------------------------------------
    // 1-11. 로그 일괄 저장
    // ---------------------------------------------------------
    LogService.flushLogs();


    // ---------------------------------------------------------
    // 1-12. 최종 결과 출력
    // ---------------------------------------------------------
    console.log("=== 교육 안내 자동 발송 결과 ===");

    ["EMAIL", "SMS"].forEach(
      function(channel) {
        const stat = statistics[channel];
        console.log(`[${channel}] 성공 ${stat.success}건 | 스킵 ${stat.skipped}건 | 실패 ${stat.failed}건`);
      }
    );
  } catch (error) {
    console.error(`[전체 프로세스 오류] ${error}`);
    console.error(error.stack);
    LogService.writeErrorLog(error);

  } finally {
    try { 
        LogService.flushLogs();
     } catch (logError) { console.error(`[로그 최종 저장 실패] ${logError}`);
    }
  }
}