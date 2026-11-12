/**
 * @file MessageConfig.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-12
 * @description
 * 사업별 이메일 및 문자 발송 메시지 설정 관리
 * 주요 기능 :
 * - GW 이메일 제목 및 본문 설정
 * - GW SMS 제목 및 본문 설정
 * - DS 담당교사 및 강사용 SMS 설정
 * - DS 대여 교구 수량 확인 SMS 설정
 * 
 * 참고:
 * - 실제 메시지 템플릿은 SmsBody.js에서 관리
 * - 연락처 링크는 security_info.js에서 관리
 * - 기존 MESSAGE_CONFIG 참조 구조 유지
 */


// =============================================================
// 1. 외부 설정 불러오기
// =============================================================
const { ACCOUNT_CONFIG } = require("../../../security_info.js")
const { 
    EMAIL_SMS_INFO,
    RENTAL_EQUIPMENT_COURSES
} = require("./SmsBody.js")


// =============================================================
// 2. GW - 강원SW미래채움 메시지 설정
// =============================================================
const GW_MESSAGE_CONFIG = {
    
    ORGANIZATION: "강원SW미래채움",
    SENDER_NAME: "강원SW미래채움",

    // 연락처 링크
    CONTACT_LINK: ACCOUNT_CONFIG.GW.CONTACT_LINK,
        
    // 이메일
    EMAIL_SUBJECT: EMAIL_SMS_INFO.GW.GW_EMAIL_SUBJECT,
    EMAIL_BODY: EMAIL_SMS_INFO.GW.GW_EMAIL_BODY,

    // SMS
    SMS_SUBJECT: EMAIL_SMS_INFO.GW.GW_SMS_SUBJECT,
    SMS_BODY: EMAIL_SMS_INFO.GW.GW_SMS_BODY,
};
    

// =============================================================
// 3. DS - 디지털새싹 메시지 설정
// =============================================================
const DS_MESSAGE_CONFIG = {

    ORGANIZATION: "디지털새싹 운영기관 코코아팹",
    SENDER_NAME: "코코아팹",

    // 연락처 링크
    CONTACT_LINK: ACCOUNT_CONFIG.DS.CONTACT_LINK,

    
    // ---------------------------------------------------------
    // 3-1. 담당교사용 SMS
    // ---------------------------------------------------------
    TEACHER_SMS_SUBJECT: EMAIL_SMS_INFO.DS.DS_TEACHER_SUBJECT,
    TEACHER_SMS_BODY: EMAIL_SMS_INFO.DS.DS_TEACHER_BODY,


    // ---------------------------------------------------------
    // 3-2. 주강사 및 보조강사용 SMS
    // ---------------------------------------------------------
    INSTRUCTOR_SMS_SUBJECT:  EMAIL_SMS_INFO.DS.DS_INSTRUCTOR_SUBJECT,
    INSTRUCTOR_SMS_BODY: EMAIL_SMS_INFO.DS.DS_INSTRUCTOR_BODY,


    // ---------------------------------------------------------
    // 3-3. 대여 교구 수량 확인용 SMS
    // ---------------------------------------------------------
    RENTAL_EQUIPMENT_COURSES: RENTAL_EQUIPMENT_COURSES,
    RENTAL_EQUIPMENT_SMS_SUBJECT: EMAIL_SMS_INFO.DS.DS_RENTAL_EQUIPMENT_SMS_SUBJECT,
    RENTAL_EQUIPMENT_SMS_BODY: EMAIL_SMS_INFO.DS.DS_RENTAL_EQUIPMENT_SMS_BODY,
};

// =============================================================
// 4. 통합 메시지 설정
// =============================================================
const MESSAGE_CONFIG = {
    GW: GW_MESSAGE_CONFIG,
    DS: DS_MESSAGE_CONFIG,
}

module.exports = MESSAGE_CONFIG;