/**
 * @file NotificationService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-13
 * @description
 * 발송 대상의 채널 및 사업 유형에 따라 이메일과 문자(SMS/LMS)를 통합 발송
 *
 * 주요 기능 :
 * - GW / DS 사업별 발송 처리
 * - GW : 이메일 및 SMS 발송
 * - DS : 담당교사 / 주강사 / 보조강사 역할별 SMS 발송
 * - DS : 지정된 교육 과정에 한해 대여 교구 확인 문자 추가 발송
 * - 테스트용 수신자 옵션 지원
 * - 이메일 미리보기 모드 지원
 * - 발송 성공 / 실패 / 스킵 결과 관리
 */


const TemplateService = require("./TemplateService");
const GmailService = require("./GmailService");
const SmsService = require("./SmsService");
const CONFIG = require("../Configs/Config");


// 상수 정의 20261113 추가
const BUSINESS_TYPES = {
    GW: "GW",
    DS: "DS",
};

const CHANNELS = {
    EMAIL: "EMAIL",
    SMS: "SMS",
};

const LOG_PREFIX = "[NotificationService.js]";


// =============================================================
// 1. 메인
// 사업 유형에 따라 발송 함수 분기
// =============================================================
async function sendTarget(target, options = {}) {

    const {
        testEmail = null,
        testPhone = null,
    } = options;

    const businessType = String(target.사업구분 || BUSINESS_TYPES.GW)
        .trim()
        .toUpperCase();

    // DS 발송
    switch (businessType) {

        case BUSINESS_TYPES.DS:
            return await sendDsTarget(target, {
                testPhone,
            });

        case BUSINESS_TYPES.GW:
            return await sendGwTarget(target, {
                testEmail,
                testPhone,
            });

        default:
            throw new Error(`지원하지 않는 사업 유형입니다: ${businessType}`);
    }

}


// =============================================================
// 2. 공통 실제 발송 함수 20261113 리팩터링
//
// 이메일 / SMS / LMS 실제 발송을 공통 처리
//
// sender : 실제 발송 서비스 함수
// recipient : 수신자
// message : 발송 메시지
// metadata : 발송 결과에 추가할 정보
// logLabel : 성공 / 실패 로그 구분
// =============================================================
async function executeDelivery({
    sender,
    recipient,
    message,
    metadata = {},
    logLabel,
}) {
    try {
        // 실제 발송
        const sendResult = await sender(recipient, message);

        // SMS는 발송 결과의 success 값을 사용
        // 이메일은 예외 없이 발송 함수가 완료되면 성공으로 처리
        const success = typeof sendResult?.success === "boolean"
            ? sendResult.success
            : true;

        const result = {
            success,
            recipient,
            ...metadata,
            subject: message.subject,
            bodyText: message.bodyText,
            result: sendResult,
        };

        // 발송 성공 / 실패 로그
        if (success) {

            console.log(`${logLabel} 성공 ${recipient}`);

        } else {

            console.error(`${logLabel} 실패 ${recipient}: ${sendResult.error || "발송 실패"}`);
        }

        return result;

    } catch (error) {

        console.error(`${logLabel} 실패 ${recipient}: ${error.message}`);

        return {
            success: false,
            recipient,
            ...metadata,
            subject: message.subject,
            bodyText: message.bodyText,
            error: error.message,
        };
    }
}

// =============================================================
// 3. GW 발송 20261113 수정
// 이메일 및 SMS/LMS
// =============================================================
async function sendGwTarget(target, options = {}) {

    const {
        testEmail = null,
        testPhone = null,
    } = options;

    // ---------------------------------------------------------
    // 3-1. 이메일 발송 모드 확인
    // ---------------------------------------------------------
    // 이메일 미리보기 모드 (true: 실제 발송하지 않고 미리보기만 진행)
    const emailPreviewMode = CONFIG.EMAIL_TEST_MODE !== false;

    // 이메일 테스트 수신자 모드 (true: 테스트 이메일 주소로 발송 / false: 실제 수신자 이메일 주소로 발송)
    const emailTestRecipientMode = CONFIG.EMAIL_TEST_RECIPIENT_MODE === true;


    // ---------------------------------------------------------
    // 3-2. 이메일 수신 주소 결정 20261113 수정
    // ---------------------------------------------------------
    let emailRecipient = "";

    if (emailTestRecipientMode) {

        // 테스트 수신자 모드
        emailRecipient = testEmail || "";

    } else {

        // 실제 수신자 모드
        emailRecipient = target.이메일 || "";
    }

    // SMS 수신 주소
    const smsRecipient = testPhone || target.연락처


    // ---------------------------------------------------------
    // 3-3. 발송 결과 초기화
    // ---------------------------------------------------------
    const result = {
        사업구분: BUSINESS_TYPES.GW,
        강사이름: target.강사이름,
        EMAIL: null,
        SMS: null,
    };


    // ---------------------------------------------------------
    // 3-4. EMAIL 발송
    // ---------------------------------------------------------
    if ((target.발송채널 || []).includes(CHANNELS.EMAIL)) {

        const message = {
            subject: TemplateService.createEmailSubject(target),
            bodyText: TemplateService.createEmailBody(target),
        };

        // 테스트 수신자 모드인데 테스트 이메일 주소가 없는 경우
        // 실제 강사 이메일 주소로 잘못 발송되지 않도록 차단
        if (!emailRecipient) {

            result.EMAIL = {
                success: false,
                skipped: false,
                recipient: "",
                subject: message.subject,
                bodyText: message.bodyText,
                error: "테스트 이메일 주소가 설정되지 않았습니다.",
                reason: "이메일 수신 주소 누락",
                emailTestRecipientMode, // 20261113 추가
            };

            console.error(`${LOG_PREFIX} GW EMAIL 실패: 테스트 이메일 주소가 설정되지 않았습니다.`);

        } else {

            result.EMAIL = await sendGwEmail({
                target,
                recipient: emailRecipient,
                message,
                emailTestRecipientMode,  // 20261113 추가
            });
        }

    } else {

        result.EMAIL = createSkippedResult(`${LOG_PREFIX} 이메일 발송 불가`);
    }


    // ---------------------------------------------------------
    // 3-5. SMS / LMS 발송
    // ---------------------------------------------------------
    if ((target.발송채널 || []).includes(CHANNELS.SMS)) {

        const message = {
            subject: TemplateService.createSmsSubject(),
            bodyText: TemplateService.createSmsBody(target),
        };

        result.SMS = await sendGwSms({
            target,
            recipient: smsRecipient,
            message,
        });

    } else {

        result.SMS = createSkippedResult(
            `${LOG_PREFIX} SMS 발송 불가`
        );
    }

    return result;
}

// =============================================================
// 4. GW 이메일 발송 미리보기 모드 20261113 리팩터링
// =============================================================
async function sendGwEmail({
    target,
    recipient,
    message,
    emailTestRecipientMode = false,  // 20261113 추가
}) {

    // ---------------------------------------------------------
    // 4-1. 이메일 미리보기 모드
    // ---------------------------------------------------------
    if (CONFIG.EMAIL_TEST_MODE !== false) {

        console.log("\n========================================");
        console.log(`${LOG_PREFIX} GW EMAIL 미리보기`);
        console.log(`강사 이름: ${target.강사이름}`);
        console.log(`수신 예정 이메일 주소: ${recipient}`);

        console.log(message.subject);
        console.log(message.bodyText);
        console.log("========================================");

        return {
            success: true,
            skipped: false,
            previewOnly: true,
            recipient,
            emailTestRecipientMode,  // 20261113 추가
            subject: message.subject,
            bodyText: message.bodyText,
            reason: "이메일 미리보기 모드 - 실제 발송하지 않음",
        };
    }

    // ---------------------------------------------------------
    // 4-2. 실제 이메일 발송
    // ---------------------------------------------------------
    return await executeDelivery({
        sender: (to, emailMessage) => GmailService.sendEmail({
            to,
            subject: emailMessage.subject,
            text: emailMessage.bodyText,
        }),
        recipient,
        message,
        metadata: {
            emailTestRecipientMode,
        },
        logLabel: `${LOG_PREFIX} GW EMAIL ${target.강사이름}`,
    });
}



// =============================================================
// 5. GW SMS / LMS 발송 20261113 리팩터링
// =============================================================
async function sendGwSms({ target, recipient, message }) {
    
    return await executeDelivery({
        sender: (to, smsMessage) => SmsService.send(to, smsMessage),
        recipient,
        message,
        metadata: {},
        logLabel: `${LOG_PREFIX} GW SMS ${target.강사이름}`,
    });
}


// =============================================================
// 6. DS 발송
//
// - 담당교사 → 담당교사 안내 템플릿
// - 주강사 → 강사 안내 템플릿
// - 보조강사 → 강사 안내 템플릿
// - 지정 과정 → 세 역할 모두 대여 교구 확인 템플릿 추가 발송
//
// 동일인이 여러 역할을 맡아도 역할별로 각각 발송
// =============================================================
async function sendDsTarget(target, options = {}) {

    const {
        testPhone = null,
    } = options;

    const result = {
        사업구분: BUSINESS_TYPES.DS,
        학교명: target.학교명,
        과정명: target.과정명,
        교육일: target.근무날짜,
        역할별안내: {},
        대여교구확인: {},
    };

    // ---------------------------------------------------------
    // 6-1. 역할별 수신자 및 템플릿 설정
    // ---------------------------------------------------------
    const roleMessages = createDsRoleMessages(target);


    // ---------------------------------------------------------
    // 6-2. 역할별 교육 안내 문자 발송
    // ---------------------------------------------------------
    console.log("\n========================================");
    console.log(`${LOG_PREFIX} DS 역할별 교육 안내 문자 발송`);
    console.log(`학교명: ${target.학교명}`);
    console.log(`과정명: ${target.과정명}`);
    console.log("========================================");

    for (const recipient of roleMessages) {

        const message = {
            subject: recipient.subject(),
            bodyText: recipient.body(),
        };

        const smsResult = await sendRoleSms({
            target,
            role: recipient.role,
            name: recipient.name,
            phone: recipient.phone,
            testPhone,
            message, // 20261112 수정: 역할별 메시지 전달
        });

        result.역할별안내[recipient.role] = smsResult;

    }


    // ---------------------------------------------------------
    // 6-3. 대여 교구 확인 문자 발송 여부 확인 20261113 리팩터링
    // ---------------------------------------------------------
    const isRentalEquipmentCourse = TemplateService.isRentalEquipmentCourse(target);

    if (isRentalEquipmentCourse) {

        result.대여교구확인 = await sendRentalEquipmentMessages({
            target,
            roleMessages,
            testPhone,
        });

    } else {
        console.log(`${LOG_PREFIX} DS 대여 교구 문자 스킵: 대상 과정 아님 (${target.과정명})`);

        result.대여교구확인 = {
            skipped: true,
            reason: "대여 교구 확인 문자 대상 과정이 아님",
        };
    }

    return result;
}

// =============================================================
// 7. DS 역할별 메시지 설정
// =============================================================
function createDsRoleMessages(target) {

    return [
        // 담당교사
        {
            role: "담당교사",
            name: target.담당교사,
            phone: target.담당교사연락처,
            subject: () => TemplateService.createDsTeacherSubject(target),
            body: () => TemplateService.createDsTeacherBody(target),
        },
        // 주강사
        {
            role: "주강사",
            name: target.주강사,
            phone: target.주강사연락처,
            subject: () => TemplateService.createDsInstructorSubject(target),
            body: () => TemplateService.createDsInstructorBody(target),
        },
        // 보조강사
        {
            role: "보조강사",
            name: target.보조강사,
            phone: target.보조강사연락처,
            subject: () => TemplateService.createDsAssistantSubject(target),
            body: () => TemplateService.createDsAssistantBody(target),
        }
    ];
}


// =============================================================
// 8. DS 대여 교구 확인 문자
// 지정된 과정에 한해 담당교사 / 주강사 / 보조강사 발송
// =============================================================
async function sendRentalEquipmentMessages({
    target,
    roleMessages,
    testPhone,
}) {

    // 대여 교구 확인 메시지 생성
    const rentalMessage = {
        subject: TemplateService.createDsRentalEquipmentSubject(target),
        bodyText: TemplateService.createDsRentalEquipmentBody(target),
    };

    const result = {};

    // 담당교사 / 주강사 / 보조강사 모두에게 발송
    for (const recipient of roleMessages) {

        const smsResult = await sendRoleSms({
            target,
            role: recipient.role,
            name: recipient.name,
            phone: recipient.phone,
            testPhone,
            message: rentalMessage,
        });

        result[recipient.role] = smsResult;
    }

    return result;
}


// =============================================================
// 9. DS 역할별 SMS 발송
// 담당교사 / 주강사 / 보조강사
// 역할별로 각각 호출하여 문자 발송 처리
// =============================================================
async function sendRoleSms({
    target,
    role,
    name,
    phone,
    testPhone,
    message,
}) {

    // ---------------------------------------------------------
    // 9-1. 연락처 확인
    // ---------------------------------------------------------
    if (!phone) {

        console.log(`${LOG_PREFIX} DS SMS 스킵 ${target.학교명} / ${role}: 연락처 없음`);

        return {
            success: false,
            skipped: true,
            reason: "해당 역할 연락처 없음",
            role,
            name: name || "",
            subject: message.subject,
            bodyText: message.bodyText,
        };
    }


    // ---------------------------------------------------------
    // 9-2. 테스트 번호 적용
    // ---------------------------------------------------------
    const recipientPhone = testPhone || phone;


    // ---------------------------------------------------------
    // 9-3. 실제 SMS / LMS 발송
    // ---------------------------------------------------------
    return await executeDelivery({
        sender: (phoneNumber, smsMessage) => SmsService.send(phoneNumber, smsMessage),
        recipient: recipientPhone,
        message,
        metadata: {
            role,
            name: name || "",
        },
        logLabel: `${LOG_PREFIX} DS SMS ${target.학교명} / ${role} ${name || ""}`,
    });
}

// =============================================================
// 10. 공통 결과 생성
// =============================================================
function createSkippedResult(reason) {

    return {
        success: false,
        skipped: true,
        reason,
    };
}


module.exports = {
    sendTarget,
};