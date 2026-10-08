/**
 * @file GmailService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * 이 파일은 Gmail을 통한 이메일 발송 서비스를 제공.
 * 주요 기능 :
 * - Gmail SMTP 연결 설정
 * - 이메일 발송 기능
 */


const nodemailer = require("nodemailer");
const EMAIL_CONFIG = require("../Configs/GmailConfig");


/** Gmail SMTP transporter */
const transporter = nodemailer.createTransport({
    host: EMAIL_CONFIG.HOST,
    port: EMAIL_CONFIG.PORT,
    secure: EMAIL_CONFIG.SECURE,

    auth: {
        user: EMAIL_CONFIG.USER,
        pass: EMAIL_CONFIG.APP_PASSWORD,
    },
});


/** Gmail SMTP 연결 확인 */
async function verifyConnection() {
    await transporter.verify();

    console.log("Gmail SMTP 연결 성공");
}


/** 이메일 발송 */
async function sendEmail({ to, subject, text }) {
    if (!to) {
        throw new Error("수신 이메일 주소가 없습니다.");
    }

    if (!subject) {
        throw new Error("이메일 제목이 없습니다.");
    }

    if (!text) {
        throw new Error("이메일 본문이 없습니다.");
    }

    const result = await transporter.sendMail({
        from: `"${EMAIL_CONFIG.SENDER_NAME}" <${EMAIL_CONFIG.USER}>`,
        to,
        subject,
        text,
    });

    return {
        success: true,
        messageId: result.messageId,
        response: result.response,
    };
}


module.exports = {
    verifyConnection,
    sendEmail,
};