/**
 * @file TemplateService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
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

/**
 * 내부 날짜 YYYY-MM-DD → 화면 표시용 M월 D일
 * 예: 2026-10-06 → 10월 6일
 */
function formatDisplayDate(date) {
    const match = String(date).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (!match) {
        return date;
    }

    const month = Number(match[2]);
    const day = Number(match[3]);

    return `${month}월 ${day}일`;
}


const TemplateService = {

    /**
     * 교육 일정 목록을 문자열로 변환
     *
     * 예:
     * 09:10~10:40 / 6학년3반
     * 10:50~12:20 / 6학년5반
     */
    createClassSchedule(target) {
        return target.교육목록.map(classInfo => {
                return `${classInfo.근무시간} / ${classInfo.반명}`;
            })
            .join("\n");
    },

    /** 템플릿 변수 치환 */
    replaceVariables(template, variables) {

        return template.replace(/{([A-Z0-9_]+)}/g, (match, key) => {
                return variables[key] ?? match;
            }
        );
    },


    /** 템플릿 변수 생성 */
    createVariables(target) {

        return {
            INSTRUCTOR: target.강사이름,
            DATE: formatDisplayDate(target.근무날짜),
            LOCATION: target.수요처명,
            WORK_TYPE: target.근무유형,
            ORGANIZATION: MESSAGE_CONFIG.GW.ORGANIZATION,
            CLASS_SCHEDULE: this.createClassSchedule(target),
            CONTACT_LINK: MESSAGE_CONFIG.GW.CONTACT_LINK,
        };
    },


    /** 이메일 제목 생성 */
    createEmailSubject(target) {
        const template = MESSAGE_CONFIG.GW.EMAIL_SUBJECT;
        const variables = this.createVariables(target);

        return this.replaceVariables(
            template,
            variables
        );
    },


    /** 이메일 본문 생성 */
    createEmailBody(target) {
        const template = MESSAGE_CONFIG.GW.EMAIL_BODY;
        const variables = this.createVariables(target);

        return this.replaceVariables(
            template,
            variables
        );
    },


    /** SMS 제목 생성 */
    createSmsSubject() {
        return MESSAGE_CONFIG.GW.SMS_SUBJECT;
    },


    /** SMS 본문 생성 */
    createSmsBody(target) {
        const template = MESSAGE_CONFIG.GW.SMS_BODY;
        const variables = this.createVariables(target);

        return this.replaceVariables(
            template,
            variables
        );
    },

    
    /** DS SMS 생성 */
    createDsVariables(target) {
    return {
        TEACHER: target.담당교사명 || "",

        INSTRUCTOR: target.주강사표기 || "",
        ASSISTANT_INSTRUCTOR: target.보조강사표기 || "",

        DATE: formatDisplayDate(target.근무날짜),
        LOCATION: target.학교명 || "",
        COURSE_NAME: target.과정명 || "",

        TIME: target.교육목록
            ?.map(classInfo => classInfo.근무시간)
            .join("\n") || "",

        STUDENT_COUNT: target.학생수 || "",

        ORGANIZATION: MESSAGE_CONFIG.DS.ORGANIZATION,
        CONTACT_LINK: MESSAGE_CONFIG.DS.CONTACT_LINK,

        EDUCATION_MANUAL_URL:
            ACCOUNT_CONFIG.DS.EDUCATION_MANUAL_URL || "",

        TEACHER_CHECKLIST_URL:
            ACCOUNT_CONFIG.DS.TEACHER_CHECKLIST_URL || "",
        };
    },

    createDsSmsSubject() {
        return MESSAGE_CONFIG.DS.SMS_SUBJECT;
    },

    createDsSmsBody(target) {
        const template = MESSAGE_CONFIG.DS.SMS_BODY;
        const variables = this.createDsVariables(target);

        return this.replaceVariables(template, variables);
    },
};


module.exports = TemplateService;