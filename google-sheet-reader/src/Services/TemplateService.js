/**
 * @file TemplateService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-13
 * @description
 * 발송 대상 데이터를 바탕으로 메시지 템플릿 내 치환 변수를 생성하고, 이메일 및 SMS 문구를 완성
 * 
 * 주요 기능 :
 * - 날짜 형식을 YYYY-MM-DD → M월 D일로 포맷팅
 * - 교육 목록 데이터(근무시간, 반명)를 줄바꿈 형태의 일정 목록 문자열로 변환
 * - 발송 대상 정보 기반의 템플릿 치환 변수 매핑
 * - 정규표현식을 활용한 메시지 템플릿 내 플레이스홀더 변수 치환 처리
 * - 이메일 및 SMS/LMS 발송용 제목과 본문 텍스트 생성
 */


const MESSAGE_CONFIG = require("../Configs/MessageConfig");
const { ACCOUNT_CONFIG } = require("../../../security_info")


// =============================================================
// 1. 날짜 포맷팅
// 내부 날짜 YYYY-MM-DD → 화면 표시용 M월 D일
// 예: 2026-10-06 → 10월 6일
// =============================================================
function formatDisplayDate(date) {
    const match = String(date).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (!match) {
        return date ?? "";
    }

    return `${Number(match[2])}월 ${Number(match[3])}일`;
}

// =============================================================
// 2.템플릿 변수 치환
// =============================================================
function replaceTemplateVariables(template, variables) {
    return String(template ?? "").replace(
        /{([A-Z0-9_]+)}/g,
        (match, key) => variables[key] ?? match
    );
}

// =============================================================
// 3. 템플릿 본문 생성
// =============================================================
function createMessage(template, variables) {
    return replaceTemplateVariables(template, variables);
}


// =============================================================
// 4. 템플릿 서비스 객체 정의
// =============================================================
const TemplateService = {

    // ---------------------------------------------------------
    // 4-1-1. GW 교육 일정 목록 생성
    // 09:10~10:40 / 6학년3반
    // 10:50~12:20 / 6학년5반
    // ---------------------------------------------------------
    createClassSchedule(target) {
        return (target.교육목록 || [])
            .map(classInfo => `${classInfo.근무시간 || ""} / ${classInfo.반명 || ""}`)
            .join("\n");
    },

    // 4-1-2. GW 템플릿 변수 생성
    createVariables(target) {
        return {
            INSTRUCTOR: target.강사이름 || "",
            DATE: formatDisplayDate(target.근무날짜),
            LOCATION: target.수요처명 || "",
            WORK_TYPE: target.근무유형 || "",
            ORGANIZATION: MESSAGE_CONFIG.GW.ORGANIZATION,
            CLASS_SCHEDULE: this.createClassSchedule(target),
            CONTACT_LINK: MESSAGE_CONFIG.GW.CONTACT_LINK,
        };
    },


    // 4-1-3. GW 이메일 제목 생성
    createEmailSubject(target) {
        return createMessage(
            MESSAGE_CONFIG.GW.EMAIL_SUBJECT,
            this.createVariables(target)
        );
    },


    // 4-1-4. GW 이메일 본문 생성
    createEmailBody(target) {
        return createMessage(
            MESSAGE_CONFIG.GW.EMAIL_BODY,
            this.createVariables(target)
        );
    },


    // 4-1-5. GW SMS 제목 생성
    createSmsSubject() {
        return MESSAGE_CONFIG.GW.SMS_SUBJECT;
    },


    // 4-1-6. GW SMS 본문 생성
    createSmsBody(target) {
        return createMessage(
            MESSAGE_CONFIG.GW.SMS_BODY,
            this.createVariables(target)
        );
    },

    // ---------------------------------------------------------
    // 4-2. DS
    // ---------------------------------------------------------

    // 4-2-1. DS 공통 변수 생성
    createDsVariables(target) {

    return {
        // 담당교사 정보
        TEACHER: target.담당교사명 || "",
        TEACHER_PHONE: target.담당교사연락처 || "",

        // 주강사 / 보조강사 정보
        INSTRUCTOR: target.주강사표기 || target.주강사명 || "",
        ASSISTANT_INSTRUCTOR: target.보조강사표기 || target.보조강사명 || "",

        // 교육 정보
        DATE: formatDisplayDate(target.근무날짜),
        LOCATION: target.학교명 || "",
        COURSE_NAME: target.과정명 || "",

        TIME: target.교육목록
            ?.map(classInfo => classInfo.근무시간 || "")
            .filter(Boolean)
            .join("\n") || "",

        STUDENT_COUNT: target.학생수 ?? "",

        // 운영기관 및 카카오 채널
        ORGANIZATION: MESSAGE_CONFIG.DS.ORGANIZATION,
        CONTACT_LINK: MESSAGE_CONFIG.DS.CONTACT_LINK,

        // 담당교사용 URL
        EDUCATION_MANUAL_URL: ACCOUNT_CONFIG.DS.EDUCATION_MANUAL_URL || "", // 261012 추가
        TEACHER_CHECKLIST_URL: ACCOUNT_CONFIG.DS.TEACHER_CHECKLIST_URL || "", // 261012 추가

        // 강사용 URL
        INSTRUCTOR_MANUAL_URL: ACCOUNT_CONFIG.DS.INSTRUCTOR_MANUAL_URL || "", // 261012 추가
        INSTRUCTOR_DOCUMENT_URL: ACCOUNT_CONFIG.DS.INSTRUCTOR_DOCUMENT_URL || "", // 261012 추가
        DS_HOMEPAGE_URL: ACCOUNT_CONFIG.DS.DS_HOMEPAGE_URL || "", // 261012 추가
        };
    },


    // ---------------------------------------------------------
    // 4-3. DS 담당교사 안내 문자 261012 추가
    // ---------------------------------------------------------

    // 4-3-1. 담당교사 SMS 제목
    createDsTeacherSmsSubject() {
        return MESSAGE_CONFIG.DS.TEACHER_SMS_SUBJECT;
    },

    // 4-3-2. 담당교사 SMS 본문
    createDsTeacherSmsBody(target) {
        return createMessage(
            MESSAGE_CONFIG.DS.TEACHER_SMS_BODY,
            this.createDsVariables(target)
        );
    },


    // ---------------------------------------------------------
    // 4-4. DS 주강사 / 보조강사 안내 문자 261012 추가
    // ---------------------------------------------------------

    // 4-4-1. 강사용 SMS 제목
    createDsInstructorSmsSubject() {
        return MESSAGE_CONFIG.DS.INSTRUCTOR_SMS_SUBJECT;
    },


    // 4-4-2. 강사용 SMS 본문
    createDsInstructorSmsBody(target) {
        return createMessage(
            MESSAGE_CONFIG.DS.INSTRUCTOR_SMS_BODY,
            this.createDsVariables(target)
        );
    },


    // ---------------------------------------------------------
    // 4-5. DS 대여 교구 수량 확인 문자 261012 추가
    // ---------------------------------------------------------

    // 대여 교구 확인 대상 과정 여부 확인
    isRentalEquipmentCourse(target) {
        const courseName = String(target.과정명 || "").trim();

        return MESSAGE_CONFIG.DS.RENTAL_EQUIPMENT_COURSES
            .some(course => String(course).trim() === courseName);
    },


    // 4-5-1. 대여 교구 확인 SMS 제목
    createRentalEquipmentSmsSubject() {
        return MESSAGE_CONFIG.DS.RENTAL_EQUIPMENT_SMS_SUBJECT;
    },


    // 4-5-2. 대여 교구 확인 SMS 본문
    createRentalEquipmentSmsBody(target) {
        return createMessage(
            MESSAGE_CONFIG.DS.RENTAL_EQUIPMENT_SMS_BODY,
            this.createDsVariables(target)
        );
    },
};


module.exports = TemplateService;