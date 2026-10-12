/**
 * @file MessageConfig.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-12
 * @description
 * 이 파일은 이메일 및 문자 발송을 위한 메시지 템플릿 설정을 관리.
 * 주요 기능 :
 * - 이메일 제목 및 본문 템플릿 관리
 * - 문자 제목 및 본문 템플릿 관리
 */

const { ACCOUNT_CONFIG } = require("../../../security_info.js")
const { EMAIL_SMS_INFO, RENTAL_EQUIPMENT_COURSES } = require("./SmsBody.js")

const MESSAGE_CONFIG = {

    // -------------------------------------------------------------
    // 강원SW미래채움 (GW)
    // -------------------------------------------------------------

    GW: {

        ORGANIZATION: "강원SW미래채움",
        SENDER_NAME: "강원SW미래채움",

        CONTACT_LINK: 
            ACCOUNT_CONFIG.GW.CONTACT_LINK,

        // 이메일 제목
        EMAIL_SUBJECT: 
            EMAIL_SMS_INFO.GW.GW_EMAIL_SUBJECT,

        // 이메일 본문
        EMAIL_BODY: 
            EMAIL_SMS_INFO.GW.GW_EMAIL_BODY,


// --------------------------------------------------------------
        // SMS 제목
        SMS_SUBJECT: 
            EMAIL_SMS_INFO.GW.GW_SMS_SUBJECT,

        // SMS 본문
        SMS_BODY: 
            EMAIL_SMS_INFO.GW.GW_SMS_BODY,
    },
    

// -------------------------------------------------------------
// Sms 발송용 템플릿 (DS)
// -------------------------------------------------------------
DS: {

    /** 담당교사용 */

    ORGANIZATION: "디지털새싹 운영기관 코코아팹",

    SENDER_NAME: "코코아팹",

    CONTACT_LINK: ACCOUNT_CONFIG.DS.CONTACT_LINK,

    TEACHER_SMS_SUBJECT:
        EMAIL_SMS_INFO.DS.DS_TEACHER_SUBJECT,

    TEACHER_SMS_BODY:
        EMAIL_SMS_INFO.DS.DS_TEACHER_BODY,

// ======================================================
    /** 주 강사, 보조 강사용 */
    
    INSTRUCTOR_SMS_SUBJECT: 
        EMAIL_SMS_INFO.DS.DS_INSTRUCTOR_SUBJECT,

    INSTRUCTOR_SMS_BODY:
        EMAIL_SMS_INFO.DS.DS_INSTRUCTOR_BODY,

// ======================================================
    /** 대여 교구 수량 확인용 */

    RENTAL_EQUIPMENT_COURSES: 
        RENTAL_EQUIPMENT_COURSES,

    RENTAL_EQUIPMENT_SMS_SUBJECT: 
        EMAIL_SMS_INFO.DS.DS_RENTAL_EQUIPMENT_SMS_SUBJECT,

    RENTAL_EQUIPMENT_SMS_BODY:
        EMAIL_SMS_INFO.DS.DS_RENTAL_EQUIPMENT_SMS_BODY,
},
};

module.exports = MESSAGE_CONFIG;