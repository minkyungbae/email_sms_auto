/**
 * =================================================================
 * 08_TemplateService.js
 * 사업별(GW/DS) 및 채널별(EMAIL/SMS) 문구 템플릿 치환 모듈
 * 
 * * 주요 역할
 * - 사업 유형(GW/DS)에 맞는 템플릿 선택
 * - 채널(EMAIL/SMS)에 맞는 제목 선택
 * - 템플릿 내 Placeholder 치환
 * - 교육 날짜 표시 형식 변환 (YYYY-MM-DD → M월 d일)
 * =================================================================
 */

const CONFIG = require("../Configs/Config.js");
const MESSAGE_CONFIG = require("../Configs/MessageConfig.js");
const { ACCOUNT_CONFIG } = require("../security_info.js");

const TemplateService = {

  // -------------------------------------------------------------
  // 1. 수업 정보와 채널에 알맞은 메시지 생성
  // -------------------------------------------------------------
  createMessage: function(classItem, channel) {

    const normalizedChannel = this.normalizeChannel(channel);
    const businessType = this.getBusinessType(classItem);

    console.log(`[템플릿 선택] 사업=${businessType} | 채널=${normalizedChannel}`);


    // 1-1. 사업 유형에 맞는 템플릿 선택
    const templateConfig = MESSAGE_CONFIG[businessType];

    if (!templateConfig) {
      throw new Error(`[템플릿 오류] 지원하지 않는 사업 유형: ${businessType}`);
    }

    // 1-2. 보안 설정 가져오기
    const secureConfig = ACCOUNT_CONFIG[businessType] || {};

    // 1-3. 템플릿 설정 + 보안 설정 결합
    const templateData = {
      ...templateConfig,
      ...secureConfig
    };

    // 1-4. 채널에 맞는 제목 선택
    let rawSubject = "";

    if (normalizedChannel === "EMAIL") {
      rawSubject = templateConfig.EMAIL_SUBJECT || "";

    } else if (normalizedChannel === "SMS") {
      rawSubject = templateConfig.SMS_SUBJECT || "";

    } else {
      throw new Error(`[템플릿 오류] 지원하지 않는 채널: ${normalizedChannel}`);
    }

    // 1-5. 본문
    const rawBody = templateConfig.BODY || "";

    // 1-6. Placeholder 치환
    const subject =
      this.replacePlaceholders(
        rawSubject,
        classItem,
        templateConfig
    );

    const bodyText =
      this.replacePlaceholders(
        rawBody,
        classItem,
        templateConfig
    );

    console.log(`[템플릿 생성 완료] 사업=${businessType} | 채널=${normalizedChannel}`);

    return {
      subject,
      bodyText
    };
  },


  /**
   * 2. 사업 유형 확인
   *
   * 우선순위
   * 1. businessType
   * 2. type
   * 3. GW
   */
  getBusinessType: function(classItem) {

    if (!classItem) {
      return "GW";
    }

    const rawType =
      classItem.businessType ||
      classItem.type ||
      "GW";

    const businessType = 
      String(rawType)
        .trim()
        .toUpperCase();

    if (businessType === "DS") {
      return "DS";
    }

    return "GW";
  },


  // -------------------------------------------------------------
  // 3. 채널명 정규화
  // -------------------------------------------------------------
  normalizeChannel: function(channel) {

    if (!channel) {
      return "";
    }

    return String(channel)
      .trim()
      .toUpperCase();
  },


  // -------------------------------------------------------------
  // 4. 템플릿 치환 변수 매핑
  // -------------------------------------------------------------
  replacePlaceholders: function(
    templateStr,
    classItem,
    tpl
  ) {

    if (!templateStr) {
      return "";

    }
    return templateStr
      // 수업 정보
      .replace(/{INSTRUCTOR}/g, classItem.instructorName || "") // 강사명
      .replace(/{ASSISTANT_INSTRUCTOR}/g, classItem.assistantInstructor || "") // 보조강사
      .replace(/{LOCATION}/g, classItem.location || "") // 수요처명
      .replace(/{COURSE_NAME}/g, classItem.courseName || "") // 과정명
      .replace(/{STUDENT_COUNT}/g, classItem.studentCount ?? "") // 0명도 허용
      .replace(/{DATE}/g, this.formatDisplayDate(classItem.date)) // 수업일
      .replace(/{TIME}/g, classItem.classTime || "") // 수업 시간
      .replace(/{CLASS_NAME}/g, classItem.className || "") // 반명
      .replace(/{DAYS_BEFORE}/g, CONFIG.DAYS_BEFORE ?? "") // 0일도 허용
      .replace(/{ORGANIZATION}/g, tpl.ORGANIZATION || "") // 운영국 명
      .replace(/{CONTACT_LINK}/g, tpl.CONTACT_LINK || "") // 문의 채팅 링크
      .replace(/{EDUCATION_MANUAL_URL}/g, tpl.EDUCATION_MANUAL_URL || "") // 교육 메뉴얼 url (DS)
      .replace(/{TEACHER_CHECKLIST_URL}/g, tpl.TEACHER_CHECKLIST_URL || "") // 사전 체크리스트 url (DS)
  },


  // -------------------------------------------------------------
  // 5. 날짜 표시용 포맷 (M월 d일)
  // -------------------------------------------------------------
  formatDisplayDate: function(dateString) {

    if (!dateString) {
      return "";
    }

    const match =
      String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    // 이미 다른 형식의 날짜라면 원본 유지
    if (!match) {
      return dateString;
    }

    const month = Number(match[2]);
    const day = Number(match[3]);

    return `${month}월 ${day}일`;
  }
};


module.exports = TemplateService;