/**
 * 교육 일정 그룹을 기반으로 실제 발송 대상자에게 이메일 / 문자 발송
 *
 * 역할
 * - 연락처 매칭 상태 확인
 * - 이메일, 문자 발송 가능 여부 판단
 * - 실제 발송 채널 결정
 */


const TemplateService = require("./TemplateService");
const GmailService = require("./GmailService");
const SmsService = require("./SmsService");


/** 이메일 / 문자 통합 발송 */
async function sendTarget(target, options = {}) {

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


    // ---------------------------------------------------------
    // EMAIL
    // ---------------------------------------------------------
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


    // ---------------------------------------------------------
    // SMS / LMS
    // ---------------------------------------------------------
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

module.exports = {
    sendTarget,
};