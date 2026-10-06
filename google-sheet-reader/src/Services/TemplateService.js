const MESSAGE_CONFIG = require("../Configs/MessageConfig");

/**
 * 내부 날짜 YYYY-MM-DD
 * → 화면 표시용 M월 D일
 *
 * 예:
 * 2026-10-06 → 10월 6일
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
    }
};


module.exports = TemplateService;