const CONFIG = require("../Configs/Config.js");

// Access Token 캐시
const tokenCache = new Map();

const TOKEN_CACHE_TIME = 10 * 60 * 1000; // 10분


const SmsService = {
    /**
     * 문자열 바이트 길이 계산
     *
     * 기존 프로그램의 계산 방식 유지:
     * ASCII = 1byte
     * 그 외 문자 = 2byte
     */
    getByteLength(str) {
        if (!str) {
            return 0;
        }

        let byteLength = 0;

        for (const char of String(str)) {
            byteLength += char.charCodeAt(0) > 127
                ? 2
                : 1;
        }

        return byteLength;
    },


    /** 뿌리오 설정 반환 */
    getConfig() {
        return CONFIG.PPURIO;
    },


    /**
     * 전화번호 정제
     *
     * 010-1234-5678
     * → 01012345678
     */
    normalizePhone(phone) {
        return String(phone || "")
            .replace(/[^0-9]/g, "");
    },


    /** Access Token 발급(캐시된 토큰이 있으면 재사용) */
    async getAccessToken() {
        const ppurioConfig = SmsService.getConfig();
        const cacheKey = `PPURIO_TOKEN_${ppurioConfig.ACCOUNT}`;

        // ---------------------------------------------
        // 캐시 확인
        // ---------------------------------------------
        const cachedToken = tokenCache.get(cacheKey);

        if (
            cachedToken &&
            cachedToken.expiresAt > Date.now()
        ) {
            console.log("[뿌리오] 캐시된 Access Token 사용");

            return cachedToken.token;
        }


        // ---------------------------------------------
        // 인증 정보 생성
        // ---------------------------------------------
        const rawAuth =
            `${ppurioConfig.ACCOUNT}:${ppurioConfig.REF_KEY}`;

        const encodedAuth =
            Buffer
                .from(rawAuth)
                .toString("base64");


        // ---------------------------------------------
        // 토큰 요청
        // ---------------------------------------------
        try {
            const response = await fetch(
                `${ppurioConfig.API_URL}/v1/token`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Basic ${encodedAuth}`,
                        "Content-Type": "application/json; charset=utf-8",
                    },
                }
            );

            const data = await SmsService.parseResponse(response);


            // -----------------------------------------
            // 토큰 발급 실패
            // -----------------------------------------
            if (
                !response.ok ||
                !data ||
                !data.token
            ) {
                throw new Error(`[뿌리오] 토큰 발급 실패 (${response.status})`);
            }


            // -----------------------------------------
            // 토큰 캐싱
            // -----------------------------------------
            tokenCache.set(
                cacheKey,
                {
                    token: data.token,
                    expiresAt: Date.now() + TOKEN_CACHE_TIME,
                }
            );

            console.log("[뿌리오] Access Token 발급 및 캐싱 완료"

            );
            return data.token;

        } catch (error) {
            console.error("[뿌리오] Access Token 요청 실패:", error.message);

            return null;
        }
    },


    /** API 응답 JSON 파싱 */
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


    /** API 연결 테스트(실제 문자 발송은 하지 않음) */
    async verifyConnection() {
        const token = await SmsService.getAccessToken();

        if (!token) {
            throw new Error("뿌리오 API 인증에 실패했습니다.");
        }
        console.log("[뿌리오] API 연결 성공");

        return true;
    },


    /**
     * 참조 키 생성
     * 최대 32자
     */
    createRefKey(customRefKey) {
        const refKey = customRefKey || `MSG_${Date.now()}`;

        return refKey.substring(0, 32);
    },


    /**
     * SMS / LMS 타입 결정
     * 90byte 초과 → LMS
     */
    getMessageType(messageText) {
        const byteSize = SmsService.getByteLength(messageText);

        return {
            byteSize,
            isLms: byteSize > 90,
            messageType:
                byteSize > 90
                    ? "LMS"
                    : "SMS",
        };
    },


    /** 뿌리오 API Payload 생성 */
    buildPayload({
        phone,
        message,
        refKey,
        isLms,
    }) {
        const ppurioConfig = SmsService.getConfig();
        const payload = {
            account: ppurioConfig.ACCOUNT,
            messageType: isLms  ? "LMS" : "SMS",
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
        if (
            isLms &&
            message.subject
        ) {
            payload.subject = message.subject;
        }
        return payload;
    },


    /** 실제 문자 API 요청 */
    async requestMessage(
        accessToken,
        payload
    ) {

        const ppurioConfig = SmsService.getConfig();

        const response = await fetch(
            `${ppurioConfig.API_URL}/v1/message`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type":
                        "application/json; charset=utf-8",
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


    /** 뿌리오 발송 결과 변환 */
    parseSendResult({
        response,
        data,
        phone,
        message,
        messageText,
        messageType,
    }) {

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
        return {
            success: false,
            phone,
            messageType,
            error: data?.description || `문자 발송 실패 (${response.status})`,
        };
    },


    /** 테스트 모드 결과 */
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


    /** SMS / LMS 발송 */
    async send(
        recipientPhone,
        message,
        customRefKey
    ) {

        // ---------------------------------------------
        // 1. 전화번호 정제
        // ---------------------------------------------
        const phone = SmsService.normalizePhone(recipientPhone);

        if (!phone) {
            return {
                success: false,
                error: "수신 전화번호가 없습니다.",
            };
        }


        // ---------------------------------------------
        // 2. 메시지 검증
        // ---------------------------------------------
        const messageText = String(message?.bodyText || "");

        if (!messageText) {
            return {
                success: false,
                error: "문자 본문이 없습니다.",
            };
        }


        // ---------------------------------------------
        // 3. SMS / LMS 결정
        // ---------------------------------------------
        const {
            byteSize,
            isLms,
            messageType,
        } =
            SmsService.getMessageType(messageText);

        console.log(`[뿌리오] ${messageType} (${byteSize}byte)`);


        // ---------------------------------------------
        // 4. 참조 키
        // ---------------------------------------------
        const refKey = SmsService.createRefKey(customRefKey);


        // ---------------------------------------------
        // 5. Payload 생성
        // ---------------------------------------------
        const payload =
            SmsService.buildPayload({
                phone,
                message,
                refKey,
                isLms,
            });


        // ---------------------------------------------
        // 6. 테스트 모드
        // ---------------------------------------------
        if (CONFIG.TEST_MODE) {

            console.log("[뿌리오] TEST_MODE - 실제 발송하지 않음");

            return SmsService.createTestResult({
                phone,
                message,
                messageText,
                messageType,
            });
        }


        // ---------------------------------------------
        // 7. Access Token
        // ---------------------------------------------
        const accessToken = await SmsService.getAccessToken();

        if (!accessToken) {
            return {
                success: false,
                error: "뿌리오 Access Token 발급 실패",
            };
        }


        // ---------------------------------------------
        // 8. 실제 발송
        // ---------------------------------------------
        try {
            const result =
                await SmsService.requestMessage(
                    accessToken,
                    payload
                );

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