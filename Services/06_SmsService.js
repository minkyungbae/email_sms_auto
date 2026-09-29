/**
 * =================================================================
 * 06_SmsService.gs
 * 뿌리오(Ppurio) REST API v1 연동 모듈
 * =================================================================
 */

const SmsService = {
  /**
   * 1. 문자열의 바이트 길이를 계산
   * 한글 등 ASCII 범위를 벗어나는 문자는 2바이트로 계산
   */
  getByteLength: function(str) {
    if (!str) return 0;

    let byteLength = 0;

    for (let i = 0; i < str.length; i++) { byteLength += str.charCodeAt(i) > 127 ? 2 : 1; }

    return byteLength;
  },

  // -----------------------------------------------------------------
  // 2. 뿌리오 API 설정을 반환
  // -----------------------------------------------------------------
  getConfig: function() { return CONFIG.PPURIO; },


  // -----------------------------------------------------------------
  // 3. 뿌리오 API Access Token을 발급받음 (Script Cache에 저장된 토큰이 있으면 재사용)
  // -----------------------------------------------------------------
  getAccessToken: function() {
    const ppurioCfg = SmsService.getConfig();
    const cache = CacheService.getScriptCache();
    const cacheKey = `PPURIO_TOKEN_${ppurioCfg.ACCOUNT}`;

    const cachedToken = cache.get(cacheKey);

    if (cachedToken) { return cachedToken; }

    const rawAuth = `${ppurioCfg.ACCOUNT}:${ppurioCfg.REF_KEY}`;
    const encodedAuth = Utilities.base64Encode(rawAuth);

    const response = UrlFetchApp.fetch(
      `${ppurioCfg.API_URL}/v1/token`,
      {
        method: "post",
        headers: {
          Authorization: `Basic ${encodedAuth}`,
          "Content-Type": "application/json; charset=utf-8"
        },
        muteHttpExceptions: true
      }
    );

    const data = SmsService.parseResponse(response);

    if (
      response.getResponseCode() !== 200 || !data || !data.token
    ) {
      console.error("[뿌리오] 토큰 발급 실패");
      return null;
    }

    // 3-1. 기존과 동일하게 10분 캐싱
    cache.put(cacheKey, data.token, 600);

    return data.token;
  },


  // -----------------------------------------------------------------
  // 4. API 응답 JSON을 안전하게 파싱
  // ----------------------------------------------------------------- 
  parseResponse: function(response) {
    try {
      return JSON.parse(response.getContentText());
    } catch (error) {
      console.error(`[뿌리오] API 응답 JSON 파싱 실패: ${error}`);

      return {};
    }
  },


  // -----------------------------------------------------------------
  // 5. 수신 전화번호를 숫자만 남긴 형태로 정제
  // -----------------------------------------------------------------
  normalizePhone: function(recipientPhone) {
    return String(recipientPhone || "").replace(/[^0-9]/g, "");
  },


  // -----------------------------------------------------------------
  // 6. 메시지 참조 키를 생성하고 최대 길이를 제한
  // -----------------------------------------------------------------
  createRefKey: function(customRefKey) {
    const refKey = customRefKey || `MSG_${Date.now()}`;

    return refKey.substring(0, 32);
  },


  // -----------------------------------------------------------------
  // 7. SMS/LMS 발송 payload를 생성
  // -----------------------------------------------------------------
  buildPayload: function(phone, message, refKey, isLms) {
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

    if (isLms && message.subject) { payload.subject = message.subject; }

    return payload;
  },


  // -----------------------------------------------------------------
  // 8. 테스트 모드 결과를 생성
  // -----------------------------------------------------------------
  createTestResult: function(phone, message, messageText) {
    return {
      success: true,
      testMode: true,
      phone: phone,
      subject: message.subject,
      bodyText: messageText
    };
  },


  // -----------------------------------------------------------------
  // 9. 뿌리오 문자 발송 API를 호출
  // -----------------------------------------------------------------
  requestMessage: function(accessToken, payload) {
    const ppurioCfg = SmsService.getConfig();

    const response = UrlFetchApp.fetch(
      `${ppurioCfg.API_URL}/v1/message`,
      {
        method: "post",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8"
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    return {
      response: response,
      data: SmsService.parseResponse(response)
    };
  },


  // -----------------------------------------------------------------
  // 10. 뿌리오 API 응답 결과를 발송 결과 객체로 변환
  // -----------------------------------------------------------------
  parseSendResult: function(
    response,
    data,
    phone,
    message,
    messageText
  ) {
    if (
      response.getResponseCode() === 200 && data.code === "1000"
    ) {
      return {
        success: true,
        phone: phone,
        messageKey: data.messageKey,
        subject: message.subject,
        bodyText: messageText
      };
    }
    return {
      success: false,
      error: data.description || "문자 발송 실패"
    };
  },


  // -----------------------------------------------------------------
  // 11. SMS/LMS 발송
  // -----------------------------------------------------------------
  send: function(recipientPhone, message, customRefKey) {
    const phone = SmsService.normalizePhone(recipientPhone);


    // -------------------------------------------------------------
    // 11-1. 수신 전화번호 검증
    // -------------------------------------------------------------
    if (!phone) {
      return {
        success: false,
        error: "수신 전화번호가 없습니다."
      };
    }


    // -------------------------------------------------------------
    // 11-2. Access Token 발급
    // -------------------------------------------------------------
    const accessToken = SmsService.getAccessToken();

    if (!accessToken) {
      return {
        success: false,
        error: "뿌리오 토큰 발급 실패"
      };
    }


    // -------------------------------------------------------------
    // 11-3. 메시지 타입 결정
    // -------------------------------------------------------------
    const messageText = message.bodyText;
    const byteSize = SmsService.getByteLength(messageText);
    const isLms = byteSize > 90;


    // -------------------------------------------------------------
    // 11-4. 참조 키 생성
    // -------------------------------------------------------------
    const refKey = SmsService.createRefKey(customRefKey);


    // -------------------------------------------------------------
    // 11-5. API Payload 생성
    // -------------------------------------------------------------
    const payload = SmsService.buildPayload(phone, message, refKey, isLms);


    // -------------------------------------------------------------
    // 11-6. 테스트 모드
    // -------------------------------------------------------------
    if (CONFIG.TEST_MODE) {
      return SmsService.createTestResult(phone, message, messageText);
    }


    // -------------------------------------------------------------
    // 11-7. 실제 문자 발송
    // -------------------------------------------------------------
    try {
      const result = SmsService.requestMessage(accessToken, payload);

      return SmsService.parseSendResult(
        result.response,
        result.data,
        phone,
        message,
        messageText
      );
    } catch (error) {
      return {
        success: false,
        error: error.toString()
      };
    }
  }
};