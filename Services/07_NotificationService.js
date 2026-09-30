/**
 * =================================================================
 * 07_NotificationService.js
 * 이메일과 SMS 발송 과정을 통합 관리
 * 
 * 역할
 * - 이메일 / SMS 채널 통합 처리
 * - 중복 발송 확인
 * - 메시지 생성
 * - 채널별 실제 발송
 * - 발송 로그 저장
 * - 발송 결과 통계 관리
 * =================================================================
 */

// -----------------------------------------------------------------
// 1. 모듈 가져오기
// -----------------------------------------------------------------  
const LogService = require("./09_LogService");
const TemplateService = require("./08_TemplateService");
const GmailService = require("./05_GmailService");
const SmsService = require("./06_SmsService");


const NotificationService = {
  // -----------------------------------------------------------------
  // 1. 채널별 발송 통계 초기화
  // -----------------------------------------------------------------
  createStatistics: function() {
    return {
      EMAIL: this.createChannelStatistics(),
      SMS: this.createChannelStatistics()
    };
  },


  // -----------------------------------------------------------------
  // 2. 채널별 통계 기본 구조 생성
  // -----------------------------------------------------------------
  createChannelStatistics: function() {
    return {
      success: 0,
      failed: 0,
      skipped: 0
    };
  },


  // -----------------------------------------------------------------
  // 3. 이메일/SMS 발송 통합 처리
  // -----------------------------------------------------------------
  async send(classItem, channel, recipient, auth) {

    // 3-0. 채널명 정규화
    const normalizedChannel =
      this.normalizeChannel(channel);


    // 3-1. 채널 확인
    if (
      normalizedChannel !== "EMAIL" &&
      normalizedChannel !== "SMS"
    ) {
      return this.createFailedResult(
        normalizedChannel,
        "지원하지 않는 채널"
      );
    }


    // 3-2. 중복 발송 확인
    if (
      LogService.isAlreadySent(
        classItem.logKey,
        normalizedChannel
        )
    ) {
      return this.createSkippedResult(
        normalizedChannel,
        "이미 발송됨"
      );
    }


    // 3-3. 수신자 확인
    if (!recipient) {
      console.warn(`[발송 실패] ${normalizedChannel} 수신자 정보 없음 | ${classItem.instructorName}`);

      return this.createFailedResult(
        normalizedChannel,
        "수신자 정보 없음"
      );
    }


    // 3-4. 메시지 생성
    let message;

    try {
      message = TemplateService.createMessage(
        classItem,
        normalizedChannel
      );

    } catch (error) {
      console.error(`[메시지 생성 실패] ${normalizedChannel} | ${error}`);
      
      return this.createFailedResult(
        normalizedChannel,
        `메시지 생성 실패: ${error.message}`
      );
    }

    console.log(
      `[메시지 생성 완료] 
      사업: ${classItem.businessType || classItem.type || "GW"} | 
      채널: ${normalizedChannel} | 
      제목: ${message.subject}`
    );


    // 3-5. 채널별 실제 발송
    let result;

    try {
      result = await this.sendByChannel(
        classItem,
        normalizedChannel,
        recipient,
        message
      );

    } catch (error) {
      console.error(`[${normalizedChannel} 발송 예외] ${error}`);
      console.error(error.stack);

      return this.createFailedResult(
        normalizedChannel,
        error.message || String(error)
      );
    }


    // 3-6. 발송 결과 확인
    if (!result || !result.success) {
      const errorMessage = 
        result && result.error
        ? result.error
        : "알 수 없는 오류";

      console.error(`[${normalizedChannel} 발송 실패] ${errorMessage}`);

      return this.createFailedResult(
        normalizedChannel,
        errorMessage
      );
    }


    // 3-7. 발송 로그 저장
    this.queueLog(
      classItem,
      recipient,
      normalizedChannel,
      message,
      result
    );


    // 3-8. 성공 결과 반환
    return {
      status: "SUCCESS",
      channel: normalizedChannel,
      recipient: recipient
    };
  },


  // -----------------------------------------------------------------
  // 4. 채널명 정규화
  // -----------------------------------------------------------------
  normalizeChannel: function(channel) {
    if (!channel) {
      return ""; 
    }

    return String(channel).trim().toUpperCase();
  },


  // -----------------------------------------------------------------
  // 5. 채널별 실제 발송 처리
  // -----------------------------------------------------------------
  async sendByChannel(
    classItem,
    channel,
    recipient,
    message,
    auth
  ) {
    switch (channel) {

      case "EMAIL":

        return await GmailService.send(
          classItem,
          recipient,
          auth
        );

      case "SMS":
        return await SmsService.send(
          recipient,
          message,
          classItem.logKey
        );

      default:
        return {
          success: false,
          error: `지원하지 않는 채널: ${channel}`
        };
    }
  },


  // -----------------------------------------------------------------
  // 6. 발송 성공 후 로그 저장
  // -----------------------------------------------------------------
  queueLog: function(
    classItem,
    recipient,
    channel,
    message,
    result
  ) {

    LogService.queueLog(
      classItem.logKey,
      classItem,
      recipient,
      result.subject || message.subject,
      result.bodyText || message.bodyText,
      channel
    );
  },


  // -----------------------------------------------------------------
  // 7. 실패 결과 생성
  // -----------------------------------------------------------------
  createFailedResult: function(
    channel,
    reason
  ) {

    return {
      status: "FAILED",
      channel: channel,
      reason: reason
    };
  },


  // -----------------------------------------------------------------
  // 8. 중복 발송 결과 생성
  // -----------------------------------------------------------------
  createSkippedResult: function(
    channel,
    reason
  ) {

    return {
      status: "SKIPPED",
      channel: channel,
      reason: reason
    };
  },


  // -----------------------------------------------------------------
  // 9. 발송 결과를 통계에 반영
  // -----------------------------------------------------------------
  updateStatistics: function(
    statistics,
    result
  ) {

    if (!statistics || !result) {
      return;
    }

    const stat = statistics[result.channel];

    if (!stat) {
      return;
    }

    const statusKey =
      String(result.status || "").toLowerCase();

    if (stat[statusKey] !== undefined) {
      stat[statusKey]++;
    }
  }
};


module.exports = NotificationService;