/**
 * @file NotificationService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * 발송 대상의 채널 설정에 따라 이메일 및 문자(SMS/LMS) 알림을 생성하고 통합 발송
 * 
 * 주요 기능 :
 * - Target 데이터 기반 템플릿 매핑을 통한 이메일 및 SMS 문구 생성
 * - 지정된 발송 채널 포함 여부 판별 및 조건별 메시지 발송 처리
 * - 테스트용 수신자 옵션 지원을 통한 테스트 발송 가능
 * - 채널별 발송 성공/실패/스킵 결과 및 에러 로그 관리
 */


const TemplateService = require("./TemplateService");
const GmailService = require("./GmailService");
const SmsService = require("./SmsService");


/**
 * 이메일 / 문자 통합 발송
 */
async function sendTarget(target, options = {}) {

    const {
        testEmail = null,
        testPhone = null,
    } = options;

    const businessType = target.사업구분 || "GW";

    // DS
    if (businessType === "DS") {
        return await sendDsTarget(target, {
            testPhone,
        });
    }

    // GW
    return await sendGwTarget(target, {
        testEmail,
        testPhone,
    });
}


/**
 * =========================================================
 * GW 발송
 * =========================================================
 */
async function sendGwTarget(target, options = {}) {

    const {
        testEmail = null,
        testPhone = null,
    } = options;

    const emailRecipient = testEmail || target.이메일;
    const smsRecipient = testPhone || target.연락처;

    const result = {
        강사이름: target.강사이름,
        EMAIL: null,
        SMS: null,
    };


    // EMAIL
    if (target.발송채널.includes("EMAIL")) {

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
                result: emailResult,
            };

            console.log(`[EMAIL 성공] ${target.강사이름} → ${emailRecipient}`);

        } catch (error) {

            result.EMAIL = {
                success: false,
                recipient: emailRecipient,
                error: error.message,
            };

            console.error(`[EMAIL 실패] ${target.강사이름} → ${emailRecipient}: ${error.message}`);

        }

    } else {

        result.EMAIL = {
            success: false,
            skipped: true,
            reason: "이메일 발송 불가",
        };
    }


    // SMS / LMS
    if (target.발송채널.includes("SMS")) {

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
                result: smsResult,
            };

            if (smsResult.success) {

                console.log(`[SMS 성공] ${target.강사이름} → ${smsRecipient}`);

            } else {

                console.error(`[SMS 실패] ${target.강사이름} → ${smsRecipient}: ${smsResult.error}`);

            }

        } catch (error) {

            result.SMS = {
                success: false,
                recipient: smsRecipient,
                error: error.message,
            };

            console.error(`[SMS 실패] ${target.강사이름} → ${smsRecipient}: ${error.message}`);
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


/**
 * =========================================================
 * DS 발송
 * 담당교사에게만 SMS 발송
 * =========================================================
 */
async function sendDsTarget(target, options = {}) {

    const {
        testPhone = null,
    } = options;

    const smsRecipient = testPhone || target.담당교사연락처;

    const result = {
        사업구분: "DS",
        학교명: target.학교명,
        과정명: target.과정명,
        교육일: target.근무날짜,
        담당교사: target.담당교사명,
        SMS: null,
    };


    // 담당교사 연락처 확인
    if (!smsRecipient) {

        result.SMS = {
            success: false,
            skipped: true,
            reason: "담당교사 연락처 없음",
        };

        console.log(`[DS SMS 스킵] ${target.학교명} → 담당교사 연락처 없음`);

        return result;
    }


    // DS SMS 메시지 생성
    const message = {
        subject: TemplateService.createDsSmsSubject(),
        bodyText: TemplateService.createDsSmsBody(target),
    };


    // SMS / LMS 발송
    try {
        const smsResult = await SmsService.send(
            smsRecipient,
            message
        );

        result.SMS = {
            success: smsResult.success,
            recipient: smsRecipient,
            result: smsResult,
        };


        if (smsResult.success) {
            
            console.log(`[DS SMS 성공] ${target.담당교사명} → ${smsRecipient}`);

        } else {
            console.error(`[DS SMS 실패] ${target.담당교사명} → ${smsRecipient}: ${smsResult.error}`);
        }

    } catch (error) {

        result.SMS = {
            success: false,
            recipient: smsRecipient,
            error: error.message,
        };

        console.error(`[DS SMS 실패] ${target.담당교사명} → ${smsRecipient}: ${error.message}`);
    }
    return result;
}

module.exports = {
    sendTarget,
};