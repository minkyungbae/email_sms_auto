/**
 * =================================================================
 * 06_SmsService.js
 * 뿌리오(Ppurio) REST API v1 연동 모듈
 * =================================================================
 */

const CONFIG = require("../Configs/Config.js");


// Access Token 캐시
const tokenCache = new Map();


const SmsService = {
  /**
   * 1. 문자열의 바이트 길이를 계산
   * 한글 등 ASCII 범위를 벗어나는 문자는 2바이트로 계산
   */
  getByteLength: function(str) {
    if (!str) return 0;

    let byteLength = 0;

    for (let i = 0; i < str.length; i++) { 
      byteLength += str.charCodeAt(i) > 127 ? 2 : 1; 
    }

    return byteLength;
  },


  // 2. 뿌리오 API 설정을 반환
  getConfig: function() { return CONFIG.PPURIO; },


  // 3. 뿌리오 API Access Token을 발급받음 (캐시에 토큰이 있으면 재사용)
  async getAccessToken() {

    const ppurioCfg = SmsService.getConfig();
    const cacheKey = `PPURIO_TOKEN_${ppurioCfg.ACCOUNT}`;
 
    // 3-1. 캐시된 토큰 확인
    const cachedToken = tokenCache.get(cacheKey);

    if (
      cachedToken && cachedToken.expiresAt > Date.now()
    ) {
      console.log("[뿌리오] 캐시된 Access Token 사용");
      return cachedToken.token;
      }

    // 3-2. 인증 정보 생성
    const rawAuth = `${ppurioCfg.ACCOUNT}:${ppurioCfg.REF_KEY}`;

    const encodedAuth = Buffer.from(rawAuth).toString("base64");

    // 3-3. 토큰 발급 API 호출
    try{
      const response = await fetch(
        `${ppurioCfg.API_URL}/v1/token`,
        {
          method: "post",
          headers: {
            Authorization: `Basic ${encodedAuth}`,
            "Content-Type": "application/json; charset=utf-8"
          }
        }
      );


    // 3-4. API 응답 JSON 파싱
    const data = await SmsService.parseResponse(response);


    // 3-5. 토큰 발급 실패 시 null 반환
    if (
      response.getResponseCode() !== 200 || 
      !data || 
      !data.token
    ) {
      console.error("[뿌리오] 토큰 발급 실패");
      return null;
    }

    // 3-6. 기존과 동일하게 10분 토큰 캐싱
    tokenCache.set(
      cacheKey, 
      {
      token: data.token,
      expiresAt: Date.now() + (600 * 1000)
      }
    );

    console.log("[뿌리오] Access Token 발급 및 캐싱 완료");
    return data.token;
    } catch (error) {
        console.error("[뿌리오] 토큰 발급 API 호출 오류", error);
        return null;
      }
  },


  // 4. API 응답 JSON을 안전하게 파싱
  async parseResponse(response) {
    try {
      return await response.json();
    } catch (error) {
      console.error("[뿌리오] API 응답 JSON 파싱 실패", error);
      return null;
    }
  },


  // 5. 수신 전화번호를 숫자만 남긴 형태로 정제
  normalizePhone: function(recipientPhone) {
    return String(
      recipientPhone || ""
    ).replace(/[^0-9]/g, "");
  },


  // 6. 메시지 참조 키를 생성하고 최대 길이를 제한
  createRefKey: function(customRefKey) {
    const refKey = 
    customRefKey || 
    `MSG_${Date.now()}`;

    return refKey.substring(0, 32);
  },


  // 7. SMS/LMS 발송 payload를 생성
  buildPayload: function(
    phone,
    message,
    refKey,
    isLms
  ) {
    const ppurioCfg = SmsService.getConfig();

    const payload = {
      account: ppurioCfg.ACCOUNT,
      messageType: isLms ? "LMS" : "SMS",
      content: message.bodyText,
      from: ppurioCfg.SENDER_NUMBER,
      duplicateFlag: "N",
      targetCount: 1,
      targets: [
        {
          to: phone,
          changeWord: {}
        }
      ],
      refKey: refKey
    };

    // LMS인 경우 제목(subject) 필드 추가
    if (isLms && message.subject) {
      payload.subject = message.subject;
    }

    return payload;
  },


  // 8. 테스트 모드 결과를 생성
  createTestResult: function(
    phone,
    message,
    messageText
  ) {
    return {
      success: true,
      testMode: true,
      phone: phone,
      subject: message.subject,
      bodyText: messageText
    };
  },


  // 9. 뿌리오 문자 발송 API를 호출
  async requestMessage(
    accessToken,
    payload
  ) {
    const ppurioCfg = SmsService.getConfig();

    const response = await fetch(
      `${ppurioCfg.API_URL}/v1/message`,
      {
        method: "post",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(payload)
      }
    );

    const data =
      await SmsService.parseResponse(response);

    return {
      response: response,
      data: data
    };
  },


  // 10. 뿌리오 API 응답 결과를 발송 결과 객체로 변환
  parseSendResult: function(
    response,
    data,
    phone,
    message,
    messageText
  ) {

    // 10-1. 정상 발송
    if (
      response.status === 200 &&
      data && 
      data.code === "1000"
    ) {
      return {
        success: true,
        phone: phone,
        messageKey: data.messageKey,
        subject: message.subject,
        bodyText: messageText
      };
    }

    // 10-2. 발송 실패
    return {
      success: false,
      phone: phone,
      error: data.description || "문자 발송 실패"
    };
  },


  // 11. SMS/LMS 발송
  async send(
    recipientPhone,
    message,
    customRefKey
  ) {
    // 11-0. 수신 전화번호 정규화
    const phone = SmsService.normalizePhone(recipientPhone);


    // 11-1. 수신 전화번호 검증
    if (!phone) {
      return {
        success: false,
        error: "수신 전화번호가 없습니다."
      };
    }


    // 11-2. Access Token 발급
    const accessToken = await SmsService.getAccessToken();

    if (!accessToken) {
      return {
        success: false,
        error: "뿌리오 토큰 발급 실패"
      };
    }


    // 11-3. 메시지 타입 결정
    // 90자 이상이면 LMS, 90자 이하면 SMS
    const messageText = message.bodyText;
    const byteSize = SmsService.getByteLength(messageText);
    const isLms = byteSize > 90;


    // 11-4. 참조 키 생성
    const refKey = SmsService.createRefKey(customRefKey);


    // 11-5. API Payload 생성
    const payload = SmsService.buildPayload(phone, message, refKey, isLms);


    // 11-6. 테스트 모드
    if (CONFIG.TEST_MODE) {
      console.log("[뿌리오] 테스트 모드 - 실제 발송 없이 결과 생성");
      return SmsService.createTestResult(phone, message, messageText);
    }


    // 11-7. 실제 문자 발송
    try {
      const result = 
          await SmsService.requestMessage(accessToken, payload);

      return SmsService.parseSendResult(
        result.response,
        result.data,
        phone,
        message,
        messageText
      );
    } catch (error) {
      console.error("[뿌리오] 문자 발송 API 호출 오류", error);
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  }
};


module.exports = SmsService;