/**
 * =================================================================
 * Utils.js
 * 공통 유틸리티 함수
 *
 * 1. 날짜 형식 정규화
 * 2. 디지털새싹(DS) 강사명 정제
 * 3. 디지털새싹(DS) 학교명 정제
 * =================================================================
 */

const CONFIG = require("../Configs/Config.js");


const Utils = {
  // -----------------------------------------------------------------
  // 1. 날짜 공통 처리
  // -----------------------------------------------------------------

  // 1-1. 현재 날짜/시간을 YYYY-MM-DD HH:mm 형식으로 반환
  getNowDateTimeString: function() {

    const parts = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }
    ).formatToParts(new Date());

    const getPart = function(type) {
      return parts.find(
        function(part) {
          return part.type === type;
        }
      ).value;
    };

    return [
      `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
      `${getPart("hour")}:${getPart("minute")}`
    ].join(" ");
  },
  

  // 1-2. 오늘 기준으로 지정된 일수만큼 더한 날짜를 YYYY-MM-DD 형식으로 반환
  getFutureDateString: function(daysToAdd) {

    const targetDate = new Date();

    targetDate.setDate(targetDate.getDate() + Number(daysToAdd || 0));

    return this.formatDate(targetDate);
  },


  /**  -----------------------------------------------------------------
  // 2. 다양한 날짜 형식을 YYYY-MM-DD 형식으로 정규화 
  // 지원 형식 : 
  // - Date 객체(구글 시트 날짜 형식)
  // - YYYYMMDD
  // - YYYY-MM-DD
  // - YYYY.MM.DD
  // - YYYY/MM/DD
  // - M/D
  // - MM/DD
  // 
  // 기간형 날짜(M/D~M/D)는 빈 문자열 반환
  ----------------------------------------------------------------- */
  formatDate: function(dateValue) {

    // 2-1. 빈 값 처리
    if (
      dateValue === null ||
      dateValue === undefined ||
      dateValue === ""
    ) {
      return "";
    }


    // 2-2. Date 객체 처리 (구글 시트의 날짜 서식)
    if (
      Object.prototype.toString.call(dateValue) === 
      "[object Date]"
    ) {

      if (
        isNaN(dateValue.getTime())
      ) {
        return "";
      }

      const parts =
        new Intl.DateTimeFormat(
          "en-US",
          {
            timeZone: "Asia/Seoul",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }
        ).formatToParts(dateValue);          

      const getPart = function(type) {
        return parts.find(
          function(part) {
            return part.type === type;
          }
        ).value;
      };

      return [
        getPart("year"),
        getPart("month"),
        getPart("day")
      ].join("-");
    }


    // 2-3. 문자열 전처리 (요일/괄호 내용 제거)
    const normalizedValue =
      String(dateValue)
        .replace(/\s*\([월화수목금토일]\)/g, "")
        .replace(/\s*\(.*?\)/g, "")
        .trim();

    
    // 2-4. 기간형 날짜 스킵
    if (
      !normalizedValue ||
      normalizedValue.includes("~")
    ) {
      return "";
    }


    // 2-5. YYYY-MM-DD
    //      YYYY.MM.DD
    //      YYYY/MM/DD
    const fullDateMatch = normalizedValue.match(
      /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/
    )

    if (fullDateMatch) {

      return this.buildDateString(
        Number(fullDateMatch[1]), // year
        Number(fullDateMatch[2]), // month
        Number(fullDateMatch[3]) // day
      );
    }


    // 2-6. YYYYMMDD
    const numericDate = normalizedValue.replace(/[^0-9]/g, "");

    if (numericDate.length === 8) {

      return this.buildDateString(
        Number(numericDate.substring(0, 4)),
        Number(numericDate.substring(4, 6)),
        Number(numericDate.substring(6, 8))
      );
    }


    // 2-7. M/D 또는 MM/DD
    // 연도가 없는 경우 현재 연도 사용
    const shortDateMatch = normalizedValue.match(
      /^(\d{1,2})\/(\d{1,2})$/
    );

    if (shortDateMatch) {

      return this.buildDateString(
        new Date().getFullYear(),  // year
        Number(shortDateMatch[1]), // month
        Number(shortDateMatch[2])  // day
      );
    }


    // 2-8. 그 외 지원하지 않는 날짜 형식 처리
    if (CONFIG.DEBUG_MODE) {

      console.warn(`[날짜 인식 실패] 원본값: ${normalizedValue}`);
    }
    return "";
  },


    // 2-9. 연/월/일을 YYYY-MM-DD 형식으로 생성
    // 실제 존재하지 않는 날짜도 검증 (예. 2월 31일)
    buildDateString: function(
      year,
      month,
      day
    ) {
      
      // 2-9-1. 기본 날짜 범위 검사
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        return "";
      }
      
      // 2-9-2. 실제 존재하는 날짜인지 검증
      const date = 
      new Date(
        year,
        month - 1,
        day
      ); 

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return "";

      }
      return [
        year,
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0")
      ].join("-");
    },


  // -----------------------------------------------------------------
  // 3. 디지털새싹(DS) 공통 처리
  // -----------------------------------------------------------------
    /**
     * 3-1. 강사명 정제
     *
     * 처리 내용
     * - 콤마/세미콜론/줄바꿈 기준으로 강사 분리
     * - 학교명 접두사 제거
     * - 앞뒤 공백 제거
     * - 빈 값 제거
     */
    cleanInstructorName: function(nameValue) {
      if (
        nameValue === null ||
        nameValue === undefined ||
        nameValue === ""
      ) {
        return "";
      }

      const names = 
        String(nameValue)
          .split(/[,;\n]/)
          .map(function(rawName) {

            const name = rawName
              .trim()
              .replace(/^.*?(초|중|고|학교)\s*/g, "")
              .trim();

            return name;
          }).filter(Boolean);

      return names.join(", ");
    },


    /** 
     * 3-2. 디지털새싹 학교명 정제
     *
     * 처리 내용
     * - 앞뒤 공백 제거
     * - 학교명 뒤의 -숫자 제거
     *
     * 예)
     * "OO초등학교-1" → "OO초등학교"
     * "OO중학교-2"   → "OO중학교"
     */

    cleanDsSchoolName: function(schoolName) {

      if (
        schoolName === null ||
        schoolName === undefined ||
        schoolName === ""
      ) {
        return "";
      }
      return String(schoolName).trim().replace(/-\d+$/, "");
    }
};

module.exports = {
  Utils
};