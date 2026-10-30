/**
 * @file NotificationService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-29
 * @description
 * 발송 대상의 채널 및 사업 유형에 따라 이메일과 문자(SMS/LMS)를 통합 발송
 *
 * 주요 기능 :
 * - GW / DS 사업별 발송 처리
 * - GW : 이메일 및 SMS 발송
 * - DS : 담당교사 / 주강사 / 보조강사 역할별 SMS 발송
 * - DS : 지정된 교육 과정에 한해 대여 교구 확인 문자 추가 발송
 * - 테스트용 수신자 옵션 지원
 * - 발송 성공 / 실패 / 스킵 결과 관리
 */


const TemplateService = require("./TemplateService");
const GmailService = require("./GmailService");
const SmsService = require("./SmsService");


// =============================================================
// 메인
// 사업 유형에 따라 발송 함수 분기
// =============================================================
async function sendTarget(target, options = {}) {

    const {
        testEmail = null,
        testPhone = null,
    } = options;


    const businessType = String(target.사업구분 || "GW")
        .trim()
        .toUpperCase();


    // DS 발송
    if (businessType === "DS") {

        return await sendDsTarget(target, {
            testPhone,
        });

    }

    // GW 발송
    if (businessType === "GW") {

        return await sendGwTarget(target, {
            testEmail,
            testPhone,
        });

    }

    throw new Error(`지원하지 않는 사업 유형입니다: ${businessType}`);

}


// GW 발송
async function sendGwTarget(target, options = {}) {

    const {
        testEmail = null,
        testPhone = null,
    } = options;

    const emailRecipient = testEmail || target.이메일;
    const smsRecipient = testPhone || target.연락처;

    const result = {
        사업구분: "GW",
        강사이름: target.강사이름,
        EMAIL: null,
        SMS: null,
    };


    // 1. EMAIL 발송
    if ((target.발송채널 || []).includes("EMAIL")) {

        const message = {
            subject: TemplateService.createEmailSubject(target),
            bodyText: TemplateService.createEmailBody(target),
        };

        try {
            const emailResult = await GmailService.sendEmail({
                to: emailRecipient,
                subject: message.subject,
                text: message.bodyText,
            });

            result.EMAIL = {
                success: true,
                recipient: emailRecipient,
                subject: message.subject, // 20261029 추가
                bodyText: message.bodyText, // 20261029 추가
                result: emailResult,
            };

            console.log(`[NotificationService.js] GW EMAIL 성공 ${target.강사이름} → ${emailRecipient}`);

        } catch (error) {
            result.EMAIL = {
                success: false,
                recipient: emailRecipient,
                subject: message.subject, // 20261029 추가
                bodyText: message.bodyText, // 20261029 추가
                error: error.message,
            };

            console.error(`[NotificationService.js] GW EMAIL 실패 ${target.강사이름} → ${emailRecipient}: ${error.message}`);

        }

    } else {
        result.EMAIL = {
            success: false,
            skipped: true,
            reason: "이메일 발송 불가",
        };
    }


    // 2. SMS / LMS 발송
    if ((target.발송채널 || []).includes("SMS")) {

        const message = {

            subject: TemplateService.createSmsSubject(),
            bodyText: TemplateService.createSmsBody(target),

        };

        try {
            const smsResult = await SmsService.send(
                smsRecipient,
                message
            );

            result.SMS = {
                success: smsResult.success,
                recipient: smsRecipient,
                subject: message.subject, // 20261029 추가
                bodyText: message.bodyText, // 20261029 추가
                result: smsResult,
            };

            if (smsResult.success) {
                console.log(`[NotificationService.js] GW SMS 성공 ${target.강사이름} → ${smsRecipient}`);
            } else {
                console.error(`[NotificationService.js] GW SMS 실패 ${target.강사이름} → ${smsRecipient}: ${smsResult.error}`);
            }
        } catch (error) {
            result.SMS = {
                success: false,
                recipient: smsRecipient,
                subject: message.subject, // 20261029 추가
                bodyText: message.bodyText, // 20261029 추가
                error: error.message,
            };
            console.error(`[NotificationService.js] GW SMS 실패 ${target.강사이름} → ${smsRecipient}: ${error.message}`);
        }

    } else {
        result.SMS = {
            success: false,
            skipped: true,
            reason: "문자 발송 불가",
        };
    }
    return result;
}


// =============================================================
// DS 발송
//
// 1. 담당교사 → 담당교사 안내 템플릿
// 2. 주강사 → 강사 안내 템플릿
// 3. 보조강사 → 강사 안내 템플릿
// 4. 지정 과정 → 세 역할 모두 대여 교구 확인 템플릿 추가 발송
//
// 동일인이 여러 역할을 맡아도 역할별로 각각 발송
// =============================================================
async function sendDsTarget(target, options = {}) {

    const {
        testPhone = null,
    } = options;

    const result = {
        사업구분: "DS",
        학교명: target.학교명,
        과정명: target.과정명,
        교육일: target.근무날짜,
        역할별안내: {},
        대여교구확인: {},
    };

    // 1. 역할별 수신자 및 템플릿 설정
    const roleMessages = [

        // 담당교사
        {
            role: "담당교사",
            name: target.담당교사명,
            phone: target.담당교사연락처,
            subject: () => TemplateService.createDsTeacherSmsSubject(),
            body: () => TemplateService.createDsTeacherSmsBody(target),
        },


        // 주강사
        {
            role: "주강사",
            name: target.주강사명,
            phone: target.주강사연락처,
            subject: () => TemplateService.createDsInstructorSmsSubject(),
            body: () => TemplateService.createDsInstructorSmsBody(target),
        },


        // 보조강사
        {
            role: "보조강사",
            name: target.보조강사명,
            phone: target.보조강사연락처,
            subject: () => TemplateService.createDsInstructorSmsSubject(),
            body: () => TemplateService.createDsInstructorSmsBody(target),
        },
    ];


    // 2. 역할별 교육 안내 문자 발송
    console.log("\n========================================");
    console.log("[NotificationService.js] DS 역할별 교육 안내 문자 발송");
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
            message: rentalMessage, // 20261029 수정
        });

        result.역할별안내[recipient.role] = smsResult;

    }


    // 3. 대여 교구 확인 문자 발송 여부 확인
    const isRentalEquipmentCourse = TemplateService.isRentalEquipmentCourse(target);

    if (isRentalEquipmentCourse) {

        console.log("\n========================================");
        console.log("[NotificationService.js] DS 대여 교구 수량 확인 문자 발송");
        console.log(`대상 과정: ${target.과정명}`);
        console.log("========================================");

        // 대여 교구 확인 문자 생성
        const rentalMessage = {
            subject: TemplateService.createRentalEquipmentSmsSubject(),
            bodyText: TemplateService.createRentalEquipmentSmsBody(target),
        };


        // 담당교사 / 주강사 / 보조강사 모두에게 발송
        for (const recipient of roleMessages) {

            const smsResult = await sendRoleSms({
                target,
                role: recipient.role, // 20261029 수정: 역할명과 발송유형 분리
                name: recipient.name,
                phone: recipient.phone,
                testPhone,
                message: rentalMessage,
            });

            result.대여교구확인[recipient.role] = smsResult;
        }
    } else {
        console.log(`[DS 대여 교구 문자 스킵] 대상 과정 아님: ${target.과정명}`);

        result.대여교구확인 = {
            skipped: true,
            reason: "대여 교구 확인 문자 대상 과정이 아님",
        };
    }
    return result;
}

// =============================================================
// DS 역할별 SMS 발송 공통 함수
//
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
    // 연락처 확인
    if (!phone) {

        console.log(`[NotificationService.js] DS SMS 스킵 ${target.학교명} / ${role}: 연락처 없음`);

        return {
            success: false,
            skipped: true,
            reason: "해당 역할 연락처 없음",
            role,
            name: name || "",
            subject: message.subject, // 20261029 추가
            bodyText: message.bodyText, // 20261029 추가
        };
    }

    // 테스트 번호가 있으면 실제 역할별 연락처 대신 사용
    const recipientPhone = testPhone || phone;

    // SMS / LMS 발송
    try {
        const smsResult = await SmsService.send(
            recipientPhone,
            message
        );

        const result = {
            success: Boolean(smsResult.success),
            recipient: recipientPhone,
            role,
            name: name || "",
            subject: message.subject, // 20261029 추가
            bodyText: message.bodyText, // 20261029 추가
            result: smsResult,
        };

        // 발송 성공 / 실패 로그
        if (smsResult.success) {

            console.log(
                `[NotificationService.js] DS SMS 성공 ${target.학교명} / ${role} ${name || ""} → ${recipientPhone}`
            );

        } else {
            console.error(
                `[NotificationService.js] DS SMS 실패 ${target.학교명} / ${role} ${name || ""} → ${recipientPhone}: ${smsResult.error}`
            );
        }
        return result;

    } catch (error) {
        console.error(
            `[NotificationService.js] DS SMS 실패 ${target.학교명} / ${role} ${name || ""} → ${recipientPhone}: ${error.message}`
        );

        return {
            success: false,
            recipient: recipientPhone,
            role,
            name: name || "",
            subject: message.subject, // 20261029 추가
            bodyText: message.bodyText, // 20261029 추가
            error: error.message,
        };
    }
}


module.exports = {
    sendTarget,
};