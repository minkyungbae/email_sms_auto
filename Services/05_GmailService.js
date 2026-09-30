/**
 * =================================================================
 * 05_GmailService.js
 * 메일 생성 및 발송 담당
 * 수신 이메일 검증 → 메시지 생성 → 테스트 모드 처리 → 실제 발송 → 결과 반환
 * =================================================================
 */

const { google } = require("googleapis");

const CONFIG = require("../Configs/Config.js");
const TemplateService = require("./08_TemplateService.js");
const MESSAGE_CONFIG = require("../Configs/MessageConfig.js");

const GmailService = {
  // -----------------------------------------------------------------
  // 1. Gmail API 클라이언트 생성
  // -----------------------------------------------------------------
  getGmailClient: function(auth) {

    return google.gmail({ 
      version: "v1", 
      auth: auth
    });
  },


  // -----------------------------------------------------------------
  // 2. 메일 발송
  // -----------------------------------------------------------------
  send: async function(
    classItem,
    recipientEmail,
    auth
  ) {

    const email = this.normalizeEmail(recipientEmail);

    if (!email) {
      return this.createFailureResult("수신 이메일이 없습니다.");
    }

    try {
      // 2-0. 메시지 생성
      const message = TemplateService.createMessage(
        classItem, "EMAIL"
      );

      // 2-1. 테스트 모드에서는 실제 메일을 발송하지 않음
      if (CONFIG.TEST_MODE) {
        return this.createSuccessResult(email, message, true);
      }

      // 2-2.Gmail API
      const gmail = this.getGmailClient(auth);

      // 2-3. 발신자 이름
      const senderName = this.getSenderName(classItem);

      // 2-4. 메일 생성
      const rawMessage = this.encodeMessage(
          email,
          message.subject,
          message.bodyText,
          senderName
      );

      // 2-5. 메일 발송
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: rawMessage
        }
      });

      // 2-6. 성공 결과 반환
      return this.createSuccessResult(email, message);
    } catch (error) {
      return this.createFailureResult(error.toString());
    }
  },


  // -----------------------------------------------------------------
  // 3. 수신 이메일 정규화
  // -----------------------------------------------------------------
  normalizeEmail: function(email) {
    return String(email || "").trim();
  },


  // -----------------------------------------------------------------
  // 4. 발신자 이름 조회
  // -----------------------------------------------------------------
  getSenderName: function(classItem) {
    const businessType =
      classItem.businessType;

    return MESSAGE_CONFIG[businessType].SENDER_NAME;
  },

  
  // -----------------------------------------------------------------
  // 5. 메시지 생성
  // -----------------------------------------------------------------
  createSuccessResult: function(
    recipientEmail,
    subject,
    bodyText,
    senderName
  ) {
    const message = [
      `From: ${senderName}`,
      `To: ${recipientEmail}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=UTF-8",
      "",
      bodyText 
    ].join("\r\n");

    return Buffer
    .from(message, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  },


  // -----------------------------------------------------------------
  // 6. 성공 결과 생성
  // -----------------------------------------------------------------
  createSuccessResult: function(
    email,
    message,
    testMode
  ) {
    const result = {
        success: true,
        email: email,
        subject: message.subject,
        bodyText: message.bodyText
    };

    if (testMode) {
      result.testMode = true;
    }

    return result;
  },

  // -----------------------------------------------------------------
  // 7. 실패 결과 생성
  // -----------------------------------------------------------------
  createFailureResult: function(
    errorMessage
  ) {
    return {
      success: false,
      error: errorMessage
    };
  }
};


module.exports = {
  GmailService
};