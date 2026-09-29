/**
 * =================================================================
 * 08_TemplateService.gs
 * 사업별(GW/DS) 및 채널별(EMAIL/SMS) 문구 템플릿 치환 모듈
 * 교육 날짜: YYYY-MM-DD → M월 d일
 * =================================================================
 */

const TemplateService = {

  // -------------------------------------------------------------
  // 1. 수업 정보와 채널에 알맞은 메시지 생성
  // -------------------------------------------------------------
  createMessage: function(classItem, channel) {

    const normalizedChannel = this.normalizeChannel(channel);
    const businessType = this.getBusinessType(classItem);

    console.log(`[템플릿 선택] 사업=${businessType} | 채널=${normalizedChannel}`);

    const templateConfig = MESSAGE_CONFIG[businessType];

    if (!templateConfig) {
      throw new Error(`[템플릿 오류] 지원하지 않는 사업 유형: ${businessType}`);
    }

    let rawSubject = "";

    if (normalizedChannel === "EMAIL") {
      rawSubject = templateConfig.EMAIL_SUBJECT || "";
    } else if (normalizedChannel === "SMS") {
      rawSubject = templateConfig.SMS_SUBJECT || "";
    } else {
      throw new Error(`[템플릿 오류] 지원하지 않는 채널: ${normalizedChannel}`);
    }

    const rawBody = templateConfig.BODY || "";
    const subject = this.replacePlaceholders(rawSubject, classItem, templateConfig);
    const bodyText = this.replacePlaceholders(rawBody, classItem, templateConfig);

    console.log(`[템플릿 생성 완료] 사업=${businessType} | 채널=${normalizedChannel}`);

    return {
      subject: subject,
      bodyText: bodyText
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

    if (!classItem) { return "GW"; }

    const rawType =
      classItem.businessType ||
      classItem.type ||
      "GW";

    const businessType = String(rawType).trim().toUpperCase();

    if (businessType === "DS") { return "DS"; }

    return "GW";
  },


  // -------------------------------------------------------------
  // 3. 채널명 정규화
  // -------------------------------------------------------------
  normalizeChannel: function(channel) {
    if (!channel) { return ""; }
    return String(channel).trim().toUpperCase();
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
      .replace( /{INSTRUCTOR}/g, classItem.instructorName || "")
      .replace( /{ASSISTANT_INSTRUCTOR}/g, classItem.assistantInstructor || "")
      .replace(/{LOCATION}/g, classItem.location || "")
      .replace(/{COURSE_NAME}/g, classItem.courseName || "")
      .replace(/{STUDENT_COUNT}/g, classItem.studentCount || "")
      .replace(/{DATE}/g, this.formatDisplayDate(classItem.date))
      .replace(/{TIME}/g, classItem.classTime || "")
      .replace(/{CLASS_NAME}/g, classItem.className || "")
      .replace(/{DAYS_BEFORE}/g, CONFIG.DAYS_BEFORE)
      .replace(/{ORGANIZATION}/g, tpl.ORGANIZATION || "")
      .replace(/{CONTACT_LINK}/g, tpl.CONTACT_LINK || "");
  },


  // -------------------------------------------------------------
  // 5. 날짜 표시용 포맷 (M월 d일)
  // -------------------------------------------------------------
  formatDisplayDate: function(dateString) {
    if (!dateString) { return ""; }

    const match = String(dateString).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    // 이미 다른 형식의 날짜라면 원본 유지
    if (!match) { return dateString; }

    const month = Number(match[2]);
    const day = Number(match[3]);

    return `${month}월 ${day}일`;
  }
};