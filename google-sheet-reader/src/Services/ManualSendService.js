/**
 * @file ManualSendService.js
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 발송 로그 화면에서 선택하거나 직접 입력한 수신자에게 문자(SMS/LMS) 및 이메일을 개별 발송
 *
 * 주요 기능:
 * - 웹에서 전달한 개별 발송 요청 데이터 검증 및 정규화
 * - 수신자별 문자 / 이메일 채널 선택 발송
 * - 웹에서 수정한 문자 및 이메일 제목·본문으로 발송
 * - 기존 테스트 설정(Config.js) 동일 적용
 *   · SMS_TEST_RECIPIENT_MODE  : 테스트 전화번호로 발송
 *   · TEST_MODE                : 뿌리오 실제 발송 안 함
 *   · EMAIL_TEST_MODE          : 이메일 미리보기(실제 발송 안 함)
 *   · EMAIL_TEST_RECIPIENT_MODE: 테스트 이메일 주소로 발송
 * - NotificationService와 동일한 발송 결과 구조 반환 (LogService 로그 생성용)
 */


const GmailService = require("./GmailService");
const SmsService = require("./SmsService");


// =============================================================
// 1. 개별 발송 제한값
// =============================================================
const LIMITS = {
    MAX_MESSAGES: 100,          // 1회 요청 최대 수신자 수
    SMS_MAX_BYTES: 2000,        // LMS 본문 최대 바이트 (90byte 초과 시 LMS)
    SMS_SUBJECT_MAX_LENGTH: 40, // LMS 제목 최대 글자 수
    EMAIL_SUBJECT_MAX_LENGTH: 200,
    EMAIL_BODY_MAX_LENGTH: 20000,
    TEXT_MAX_LENGTH: 200,       // 이름, 기관명 등 일반 텍스트
};

const BUSINESS_TYPES = ["GW", "DS"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LOG_PREFIX = "[ManualSendService.js]";


// =============================================================
// 2. 공통 정규화 함수
// =============================================================
function toText(value, maxLength = LIMITS.TEXT_MAX_LENGTH) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value).trim().slice(0, maxLength);
}

function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}


// =============================================================
// 3. 개별 발송 요청 검증
//
// 입력 예시:
// {
//   sourceLogId: "uuid",
//   businessType: "GW" | "DS",
//   recipient: { name, role, phone, email, affiliation },
//   education: { 교육과정명, 교육기관명, 반명, 교육일, 요일, 교육시간 },
//   sms:   { enabled, subject, body },
//   email: { enabled, subject, body }
// }
//
// 검증 실패 시 수신자 번호와 사유를 모아 하나의 오류로 반환
// =============================================================
function normalizeManualMessages(rawMessages) {

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
        throw new Error("발송할 수신자가 없습니다.");
    }

    if (rawMessages.length > LIMITS.MAX_MESSAGES) {
        throw new Error(`한 번에 최대 ${LIMITS.MAX_MESSAGES}명까지 발송할 수 있습니다.`);
    }

    const errors = [];

    const messages = rawMessages.map((raw, index) => {

        const label = `${index + 1}번째 수신자`;

        if (!isPlainObject(raw)) {
            errors.push(`${label}: 요청 형식이 올바르지 않습니다.`);
            return null;
        }

        const recipientRaw = isPlainObject(raw.recipient) ? raw.recipient : {};
        const educationRaw = isPlainObject(raw.education) ? raw.education : {};
        const smsRaw = isPlainObject(raw.sms) ? raw.sms : {};
        const emailRaw = isPlainObject(raw.email) ? raw.email : {};

        // -----------------------------------------------------
        // 3-1. 수신자 정보
        // -----------------------------------------------------
        const recipient = {
            name: toText(recipientRaw.name),
            role: toText(recipientRaw.role),
            phone: toText(recipientRaw.phone, 30),
            email: toText(recipientRaw.email),
            affiliation: toText(recipientRaw.affiliation),
        };

        const displayName = recipient.name || label;

        const businessType = BUSINESS_TYPES.includes(
            String(raw.businessType || "").trim().toUpperCase()
        )
            ? String(raw.businessType).trim().toUpperCase()
            : "GW";

        // -----------------------------------------------------
        // 3-2. 문자 내용
        // -----------------------------------------------------
        const sms = {
            enabled: smsRaw.enabled === true,
            subject: toText(smsRaw.subject, LIMITS.SMS_SUBJECT_MAX_LENGTH),
            body: String(smsRaw.body ?? "").replace(/\r\n/g, "\n").trim(),
        };

        if (sms.enabled) {

            const phoneDigits = SmsService.normalizePhone(recipient.phone);

            if (phoneDigits.length < 9 || phoneDigits.length > 11) {
                errors.push(`${displayName}: 문자 수신 연락처가 올바르지 않습니다.`);
            }

            if (!sms.body) {
                errors.push(`${displayName}: 문자 본문을 입력해 주세요.`);

            } else if (SmsService.getByteLength(sms.body) > LIMITS.SMS_MAX_BYTES) {
                errors.push(`${displayName}: 문자 본문은 ${LIMITS.SMS_MAX_BYTES}byte 이하로 작성해 주세요.`);
            }
        }

        // -----------------------------------------------------
        // 3-3. 이메일 내용
        // -----------------------------------------------------
        const email = {
            enabled: emailRaw.enabled === true,
            subject: toText(emailRaw.subject, LIMITS.EMAIL_SUBJECT_MAX_LENGTH),
            body: String(emailRaw.body ?? "").replace(/\r\n/g, "\n").trim(),
        };

        if (email.enabled) {

            if (!EMAIL_PATTERN.test(recipient.email)) {
                errors.push(`${displayName}: 이메일 주소가 올바르지 않습니다.`);
            }

            if (!email.subject) {
                errors.push(`${displayName}: 이메일 제목을 입력해 주세요.`);
            }

            if (!email.body) {
                errors.push(`${displayName}: 이메일 본문을 입력해 주세요.`);

            } else if (email.body.length > LIMITS.EMAIL_BODY_MAX_LENGTH) {
                errors.push(`${displayName}: 이메일 본문이 너무 깁니다.`);
            }
        }

        if (!sms.enabled && !email.enabled) {
            errors.push(`${displayName}: 문자 또는 이메일 중 하나 이상을 선택해 주세요.`);
        }

        return {
            sourceLogId: toText(raw.sourceLogId, 64),
            businessType,
            recipient,
            education: {
                교육과정명: toText(educationRaw.교육과정명),
                교육기관명: toText(educationRaw.교육기관명),
                반명: toText(educationRaw.반명),
                교육일: toText(educationRaw.교육일),
                요일: toText(educationRaw.요일),
                교육시간: toText(educationRaw.교육시간),
            },
            sms,
            email,
        };
    });

    if (errors.length > 0) {

        const preview = errors.slice(0, 5).join("\n");
        const more = errors.length > 5 ? `\n외 ${errors.length - 5}건` : "";

        throw new Error(`발송 요청을 확인해 주세요.\n${preview}${more}`);
    }

    return messages;
}


// =============================================================
// 4. 문자 개별 발송
// =============================================================
async function sendSms(message, testOptions) {

    const recipientPhone = testOptions.smsTestRecipientMode
        ? testOptions.testPhone
        : message.recipient.phone;

    const smsMessage = {
        subject: message.sms.subject,
        bodyText: message.sms.body,
    };

    try {
        // TEST_MODE인 경우 SmsService에서 mock 결과 반환
        const sendResult = await SmsService.send(
            recipientPhone,
            smsMessage,
            `MANUAL_${Date.now()}`
        );

        return {
            success: Boolean(sendResult?.success),
            skipped: false,
            recipient: recipientPhone || "",
            subject: smsMessage.subject,
            bodyText: smsMessage.bodyText,
            result: sendResult,
            error: sendResult?.success ? undefined : sendResult?.error,
        };

    } catch (error) {

        console.error(`${LOG_PREFIX} 문자 발송 실패 ${message.recipient.name}: ${error.message}`);

        return {
            success: false,
            skipped: false,
            recipient: recipientPhone || "",
            subject: smsMessage.subject,
            bodyText: smsMessage.bodyText,
            error: error.message,
        };
    }
}


// =============================================================
// 5. 이메일 개별 발송
// =============================================================
async function sendEmail(message, testOptions) {

    const recipientEmail = testOptions.emailTestRecipientMode
        ? testOptions.testEmail || ""
        : message.recipient.email;

    const base = {
        skipped: false,
        recipient: recipientEmail,
        subject: message.email.subject,
        bodyText: message.email.body,
        emailTestRecipientMode: testOptions.emailTestRecipientMode,
    };

    // 테스트 수신자 모드인데 테스트 주소가 없으면 실제 주소로 잘못 발송되지 않도록 차단
    if (!recipientEmail) {
        return {
            ...base,
            success: false,
            error: "테스트 이메일 주소가 설정되지 않았습니다.",
        };
    }

    // 이메일 미리보기 모드: 실제 발송하지 않음
    if (testOptions.emailTestMode) {

        console.log(`${LOG_PREFIX} 이메일 미리보기 - ${message.recipient.name} <${recipientEmail}>`);

        return {
            ...base,
            success: true,
            previewOnly: true,
            reason: "이메일 미리보기 모드 - 실제 발송하지 않음",
        };
    }

    try {
        const sendResult = await GmailService.sendEmail({
            to: recipientEmail,
            subject: message.email.subject,
            text: message.email.body,
        });

        return {
            ...base,
            success: true,
            result: sendResult,
        };

    } catch (error) {

        console.error(`${LOG_PREFIX} 이메일 발송 실패 ${message.recipient.name}: ${error.message}`);

        return {
            ...base,
            success: false,
            error: error.message,
        };
    }
}


// =============================================================
// 6. 수신자 1명 개별 발송
// 선택한 채널만 발송하고, 선택하지 않은 채널은 null 반환
// =============================================================
async function sendManualMessage(message, testOptions) {

    const smsDetail = message.sms.enabled
        ? await sendSms(message, testOptions)
        : null;

    const emailDetail = message.email.enabled
        ? await sendEmail(message, testOptions)
        : null;

    return {
        smsDetail,
        emailDetail,
    };
}


module.exports = {
    LIMITS,
    normalizeManualMessages,
    sendManualMessage,
};