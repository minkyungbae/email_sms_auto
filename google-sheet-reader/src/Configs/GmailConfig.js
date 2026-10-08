/**
 * @file GmailConfig.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * 이 파일은 Gmail을 통한 이메일 발송 설정을 관리.
 * 주요 기능 :
 * - Gmail SMTP 서버 설정
 * - 환경 변수 기반 사용자 인증 정보 관리
 */


require("dotenv").config();

const EMAIL_CONFIG = {
    HOST: "smtp.gmail.com",
    PORT: 465,
    SECURE: true,

    USER: process.env.GMAIL_USER,
    APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,

    SENDER_NAME: "2022강원SW미래채움",
};

module.exports = EMAIL_CONFIG;