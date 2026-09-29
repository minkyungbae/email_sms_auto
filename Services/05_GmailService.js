/**
 * =================================================================
 * 05_GmailService.gs
 * 메일 생성 및 발송 담당
 * 수신 이메일 검증 → 메시지 생성 → 테스트 모드 처리 → 실제 발송 → 결과 반환
 * =================================================================
 */
const GmailService = {
  // -----------------------------------------------------------------
  // 1. 메일 발송
  // -----------------------------------------------------------------
  send: function(classItem, recipientEmail) {
    const email = this.normalizeEmail(recipientEmail);

    if (!email) {
      return this.createFailureResult("수신 이메일이 없습니다.");
    }

    try {
      const message = TemplateService.createMessage(classItem, "EMAIL");

      // 테스트 모드에서는 실제 메일을 발송하지 않음
      if (CONFIG.TEST_MODE) {
        return this.createSuccessResult(email, message, true);
      }
      GmailApp.sendEmail(
        email,
        message.subject,
        message.bodyText,
        {
          name: this.getSenderName(classItem)
        }
      );
      return this.createSuccessResult(email, message);
    } catch (error) {
      return this.createFailureResult(error.toString());
    }
  },


  // -----------------------------------------------------------------
  // 2. 수신 이메일 정규화
  // -----------------------------------------------------------------
  normalizeEmail: function(email) { return String(email || "").trim(); },


  // -----------------------------------------------------------------
  // 3. 발신자 이름 조회
  // -----------------------------------------------------------------
  getSenderName: function(classItem) {
    return MESSAGE_CONFIG[classItem.businessType].SENDER_NAME;
  },

  
  // -----------------------------------------------------------------
  // 4. 성공 결과 생성
  // -----------------------------------------------------------------
  createSuccessResult: function(email, message, testMode) {
    const result = {
      success: true,
      email: email,
      subject: message.subject,
      bodyText: message.bodyText
    };

    if (testMode) { result.testMode = true; }

    return result;
  },


  // -----------------------------------------------------------------
  // 5. 실패 결과 생성
  // -----------------------------------------------------------------
  createFailureResult: function(errorMessage) {
    return {
      success: false,
      error: errorMessage
    };
  }
};