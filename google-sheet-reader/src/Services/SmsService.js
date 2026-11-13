/**
 * @file SmsService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-12
 * @description
 * 뿌리오 API를 연동하여 문자 바이트 수 계산, 인증 토큰 캐싱 및 SMS/LMS 발송을 처리
 *
 * 주요 기능:
 * - 문자 본문의 바이트 수 계산(90byte 기준)을 통한 SMS / LMS 규격 자동 판별
 * - Basic 인증 기반 뿌리오 Access Token 발급 및 10분 단위 메모리 캐싱
 * - 수신자 전화번호 정제 및 API 표준 Payload 생성
 * - 테스트 모드에서 mock 발송 결과 반환
 * - 뿌리오 API를 통한 실제 메시지 발송 및 응답 결과 변환
 */

const CONFIG = require("../Configs/Config.js");


// 설정
const TOKEN_CACHE_TIME = 10 * 60 * 1000; // 10분

const API_ENDPOINTS = {
    TOKEN: "/v1/token",
    MESSAGE: "/v1/message",
};


// Access Token 캐시
const tokenCache = new Map();


const SmsService = {
    // =========================================================
    // 1. 기본 설정 및 데이터 정규화
    // 문자열 바이트 길이 계산
    // 기존 프로그램의 계산 방식 유지: ASCII = 1byte 그 외 문자 = 2byte
    // =========================================================
    getByteLength(str) {

        if (!str) {
            return 0;
        }

        let byteLength = 0;

        for (const char of String(str)) {
            byteLength += char.charCodeAt(0) > 127 ? 2 : 1;
        }
        return byteLength;
    },


    // 뿌리오 설정 반환
    getConfig() {

        return CONFIG.PPURIO;
    },


    // 전화번호 정제
    // 010-1234-5678 → 01012345678
    normalizePhone(phone) {

        return String(phone || "").replace(/[^0-9]/g, "");
    },


    // SMS / LMS 타입 결정: 90byte 초과 시 LMS
    getMessageType(messageText) {

        const byteSize = SmsService.getByteLength(messageText);

        const isLms = byteSize > 90;

        return {
            byteSize,
            isLms,
            messageType: isLms ? "LMS" : "SMS",
        };
    },


    // 참조 키 생성: 최대 32자
    createRefKey(customRefKey) {

        const refKey = customRefKey || `MSG_${Date.now()}`;

        return String(refKey).substring(0, 32);
    },


    // =========================================================
    // 2. API 응답 처리: API 응답 JSON 파싱
    // ========================================================= 
    async parseResponse(response) {

        const text = await response.text();

        if (!text) {
            return null;
        }
        try {

            return JSON.parse(text);

        } catch (error) {
            console.error("[뿌리오] API 응답 JSON 파싱 실패");

            return null;
        }
    },


    // 네트워크 오류 원인 확인
    getRootCause(error) {

        let current = error;

        while (
            current &&
            current.cause &&
            current.cause !== current
        ) {
            current = current.cause;
        }

        return current || error;
    },


    // =========================================================
    // 3. Access Token 관리: 캐시된 토큰이 있으면 재사용
    // =========================================================
    async getAccessToken() {

        const ppurioConfig = SmsService.getConfig();

        const cacheKey = `PPURIO_TOKEN_${ppurioConfig.ACCOUNT}`;


        // -----------------------------------------------------
        // 3-1. 캐시 확인
        // -----------------------------------------------------
        const cachedToken = tokenCache.get(cacheKey);

        if (
            cachedToken &&
            cachedToken.expiresAt > Date.now()
        ) {
            console.log("[뿌리오] 캐시된 Access Token 사용");

            return cachedToken.token;
        }


        // -----------------------------------------------------
        // 3-2. 인증 정보 생성
        // -----------------------------------------------------
        const rawAuth = `${ppurioConfig.ACCOUNT}:${ppurioConfig.REF_KEY}`;

        const encodedAuth = Buffer.from(rawAuth).toString("base64");


        // -----------------------------------------------------
        // 3-3. 토큰 요청
        // -----------------------------------------------------
        try {
            const response = await fetch(
                `${ppurioConfig.API_URL}${API_ENDPOINTS.TOKEN}`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Basic ${encodedAuth}`,
                        "Content-Type": "application/json; charset=utf-8",
                    },
                }
            );
            const data = await SmsService.parseResponse(response);


            // -------------------------------------------------
            // 토큰 발급 결과 확인
            // -------------------------------------------------
            if (
                !response.ok ||
                !data ||
                !data.token
            ) {
                throw new Error(`[뿌리오] 토큰 발급 실패 (${response.status})`);
            }


            // -------------------------------------------------
            // 토큰 캐싱
            // -------------------------------------------------
            tokenCache.set(
                cacheKey,
                {
                    token: data.token,
                    expiresAt: Date.now() + TOKEN_CACHE_TIME,
                }
            );

            console.log("[뿌리오] Access Token 발급 및 캐싱 완료");

            return data.token;

        } catch (error) {
            console.error("[뿌리오] Access Token 요청 실패:", error.message);

            return null;
        }
    },


    // API 연결 테스트: 실제 문자 발송은 하지 않음
    async verifyConnection() {

        const token = await SmsService.getAccessToken();

        if (!token) {
            throw new Error("뿌리오 API 인증에 실패했습니다.");
        }

        console.log("[뿌리오] API 연결 성공");

        return true;
    },


    // =========================================================
    // 4. 뿌리오 API Payload 생성
    // =========================================================
    buildPayload({
        phone,
        message,
        refKey,
        isLms,
    }) {
        const ppurioConfig = SmsService.getConfig();

        const payload = {
            account: ppurioConfig.ACCOUNT,
            messageType: isLms ? "LMS" : "SMS",
            content: message.bodyText,
            from: ppurioConfig.SENDER_NUMBER,
            duplicateFlag: "N",
            targetCount: 1,
            targets: [
                {
                    to: phone,
                    changeWord: {},
                },
            ],
            refKey,
        };

        // LMS만 제목 사용
        if (isLms && message.subject) {
            payload.subject = message.subject;
        }
        return payload;
    },


    // =========================================================
    // 5. 실제 문자 발송 API 요청
    // =========================================================
    async requestMessage(
        accessToken,
        payload
    ) {
        const ppurioConfig = SmsService.getConfig();

        const response = await fetch(
            `${ppurioConfig.API_URL}${API_ENDPOINTS.MESSAGE}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json; charset=utf-8",
                },
                body: JSON.stringify(payload),
            }
        );
        const data = await SmsService.parseResponse(response);

        return {
            response,
            data,
        };
    },


    // =========================================================
    // 6. 뿌리오 발송 결과 변환
    // =========================================================
    parseSendResult({
        response,
        data,
        phone,
        message,
        messageText,
        messageType,
    }) {

        // 뿌리오 성공 응답
        if (
            response.status === 200 &&
            data &&
            data.code === "1000"
        ) {

            return {
                success: true,
                phone,
                messageKey: data.messageKey,
                messageType,
                subject: message.subject || "",
                bodyText: messageText,
            };
        }

        // 뿌리오 실패 응답
        return {
            success: false,
            phone,
            messageType,
            error: data?.description || `문자 발송 실패 (${response.status})`,
        };
    },


    // 테스트 모드 결과 생성
    createTestResult({
        phone,
        message,
        messageText,
        messageType,
    }) {

        return {
            success: true,
            testMode: true,
            phone,
            messageType,
            subject: message.subject || "",
            bodyText: messageText,
        };
    },


    // =========================================================
    // 7. SMS / LMS 발송
    // =========================================================
    async send(
        recipientPhone,
        message,
        customRefKey
    ) {
        // -----------------------------------------------------
        // 7-1. 전화번호 정제
        // -----------------------------------------------------
        const phone = SmsService.normalizePhone(recipientPhone);

        if (!phone) {

            return {
                success: false,
                error: "수신 전화번호가 없습니다.",
            };
        }


        // -----------------------------------------------------
        // 7-2. 메시지 검증
        // -----------------------------------------------------
        const messageText = String(message?.bodyText || "");

        if (!messageText) {

            return {
                success: false,
                error: "문자 본문이 없습니다.",
            };
        }


        // -----------------------------------------------------
        // 7-3. SMS / LMS 결정
        // -----------------------------------------------------
        const {byteSize, isLms, messageType,} = SmsService.getMessageType(messageText);

        console.log(`[뿌리오] ${messageType} (${byteSize}byte)`);


        // -----------------------------------------------------
        // 7-4. 참조 키 생성
        // -----------------------------------------------------
        const refKey = SmsService.createRefKey(customRefKey);


        // -----------------------------------------------------
        // 7-5. Payload 생성
        // -----------------------------------------------------
        const payload = SmsService.buildPayload({
            phone,
            message,
            refKey,
            isLms,
        });


        // -----------------------------------------------------
        // 7-6. 테스트 모드
        // -----------------------------------------------------
        if (CONFIG.TEST_MODE) {

            console.log("[뿌리오] TEST_MODE - 실제 발송하지 않음");

            return SmsService.createTestResult({
                phone,
                message,
                messageText,
                messageType,
            });
        }


        // -----------------------------------------------------
        // 7-7. Access Token 발급
        // -----------------------------------------------------
        const accessToken = await SmsService.getAccessToken();

        if (!accessToken) {

            return {
                success: false,
                error: "뿌리오 Access Token 발급 실패",
            };
        }


        // -----------------------------------------------------
        // 7-8. 실제 발송
        // -----------------------------------------------------
        try {
            const result = await SmsService.requestMessage(accessToken, payload);

            return SmsService.parseSendResult({
                response: result.response,
                data: result.data,
                phone,
                message,
                messageText,
                messageType,
            });

        } catch (error) {
            console.error("[뿌리오] 문자 발송 API 호출 오류:", error.message);

            return {
                success: false,
                phone,
                messageType,
                error:
                    error.message ||
                    String(error),
            };
        }
    },
};


module.exports = SmsService;
