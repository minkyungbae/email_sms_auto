/**
 * =================================================================
 * 03_SheetService.js
 * 시트 데이터 조회 및 처리 모듈
 * =================================================================
 */

const { google } = require("googleapis");

const {
  LOG_SHEET_IDS,
  MGMT_SHEET_IDS,
  SHEET_CONFIGS,
  SHEET_NAME_INSTRUCTOR,
  EXTRA_SHEET_HEADER_ROW,
  EXTRA_SHEET_DATA_START_ROW,
  COLUMN_CONFIG,
} = require("../Configs/SheetConfig.js");

console.log("[DEBUG] LOG_SHEET_IDS:", LOG_SHEET_IDS); // LOG_SHEET_IDS 확인

const { Utils } = require("../Utils/Utils.js");

// -----------------------------------------------------------------
// Google Sheets API 인증
// -----------------------------------------------------------------
const auth = new google.auth.GoogleAuth({
  keyFile: "security_info.js",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ 
  version: "v4",
  auth
});

const SheetService = {

  _spreadsheetCache: Object.create(null),

  // -----------------------------------------------------------------
  // 1. 스프레드시트 인스턴스 조회 (동일한 ID는 캐시된 인스턴스를 재사용)
  // -----------------------------------------------------------------
  getSpreadsheet: function(sheetId) {
    if (!SheetService._spreadsheetCache[sheetId]) {
      SheetService._spreadsheetCache[sheetId] = sheetId;
    }
    return SheetService._spreadsheetCache[sheetId];
  },

  // -----------------------------------------------------------------
  // 2. 헤더 Alias를 기준으로 컬럼 위치 탐색
  // -----------------------------------------------------------------
  findColumnIndices: function(headers, columnAliases) {
    const indices = Object.create(null);

    const normalizedHeaders = headers.map(function(header) {
      return SheetService.normalizeHeader(header);
    });

    Object.keys(columnAliases).forEach(function(key) {
      indices[key] = SheetService.findColumnIndex(
        normalizedHeaders,
        columnAliases[key]
      );
    });

    return indices;
  },

  // -----------------------------------------------------------------
  // 3. 헤더 문자열 정규화 (공백 제거 + 소문자 변환)
  // -----------------------------------------------------------------
  normalizeHeader: function(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  },

  // -----------------------------------------------------------------
  // 4. Alias 목록을 기준으로 컬럼 인덱스 탐색
  // -----------------------------------------------------------------
  findColumnIndex: function(normalizedHeaders, aliases) {
    for (const alias of aliases) {

      const normalizedAlias = 
        SheetService.normalizeHeader(alias);

      const index = normalizedHeaders.findIndex(function(header) {

        return header.includes(normalizedAlias);
      });

      if (index !== -1) {
        return index;
      }
    }

    return -1;
  },

  // -----------------------------------------------------------------
  // 5. 값을 문자열로 변환하고 양쪽 공백 제거
  // -----------------------------------------------------------------
  toTrimmedString: function(value) {
    return String(value || "").trim();
  },

  // -----------------------------------------------------------------
  // 6. 컬럼 인덱스 조회 (Alias 탐색에 실패하면 기존 기본 컬럼 위치 사용)
  // -----------------------------------------------------------------
  getActivityColumnIndices: function(headers) {
    const indices = 
      SheetService.findColumnIndices(
        headers,
        COLUMN_CONFIG.ACTIVITY
      );

    return {
      instructor: indices.INSTRUCTOR !== -1 
        ? indices.INSTRUCTOR 
        : 5,
      location: indices.LOCATION !== -1 
        ? indices.LOCATION 
        : 7,
      className: indices.CLASS_NAME !== -1
        ? indices.CLASS_NAME
        : 8,
      classTime: indices.CLASS_TIME !== -1
        ? indices.CLASS_TIME
        : 9,
      date: indices.DATE !== -1
        ? indices.DATE 
        : 10,
      email: indices.EMAIL,
      phone: indices.PHONE,
      assistantInstructor: indices.ASSISTANT_INSTRUCTOR,
      courseName: indices.COURSE_NAME,
      studentCount: indices.STUDENT_COUNT
    };
  },

  // -----------------------------------------------------------------
  // 7. DS 전용 컬럼 인덱스 적용 (GW에서는 DS 전용 컬럼을 사용하지 않음)
  // -----------------------------------------------------------------
  getDsColumnIndices: function(indices, isDs) {
    return {
      assistantInstructor: isDs
        ? indices.assistantInstructor
        : -1,
      courseName: isDs
        ? indices.courseName
        : -1,
      studentCount: isDs
        ? indices.studentCount
        : -1
    };
  },

  // -----------------------------------------------------------------
  // 8. 강사명 → 이메일 / 연락처 매핑
  // -----------------------------------------------------------------
  getInstructorContactMap: async function() {

    const contactMap = Object.create(null);

    for (const sheetId of MGMT_SHEET_IDS) {
      try {

        await SheetService.collectInstructorContacts(
          sheetId,
          contactMap
        );
      } catch (error) {
        console.error(`[강사 연락처 조회 실패] ${sheetId}: ${error}`);
      }
    }

    return contactMap;
  },

  // -----------------------------------------------------------------
  // 9. 특정 관리 시트에서 강사 연락처 수집
  // -----------------------------------------------------------------
  collectInstructorContacts: async function(
    sheetId,
    contactMap
  ) {
    const spreadsheetId = 
      SheetService.getSpreadsheet(sheetId);

    const range = 
      `${SHEET_NAME_INSTRUCTOR}!A:ZZ`;

    const response = 
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: "FORMATTED_VALUE",
    });

    const data = response.data.values || [];
    const headerIndex = EXTRA_SHEET_HEADER_ROW - 1;

    if (data.length <= headerIndex) {
      return;
    }

    const headers = data[headerIndex];

    const indices = SheetService.findColumnIndices(
      headers,
      COLUMN_CONFIG.INSTRUCTOR_MGMT
    );

    const nameIndex = indices.INSTRUCTOR !== -1
      ? indices.INSTRUCTOR
      : 5;

    const emailIndex = indices.EMAIL;
    const phoneIndex = indices.PHONE;
    const startIndex = EXTRA_SHEET_DATA_START_ROW - 1;

    for (
        let i = startIndex;
        i < data.length;
        i++
      ) {
      SheetService.mergeInstructorContact(
        data[i],
        nameIndex,
        emailIndex,
        phoneIndex,
        contactMap
      );
    }
  },

  // -----------------------------------------------------------------
  // 10. 한 행의 강사 연락처 정보를 contactMap에 누적
  // -----------------------------------------------------------------
  mergeInstructorContact: function(
    row,
    nameIndex,
    emailIndex,
    phoneIndex,
    contactMap
  ) {
    const name = 
      SheetService.toTrimmedString(
        row[nameIndex]
      );

    if (!name) {
      return;
    }

    const email = emailIndex !== -1
      ? SheetService.toTrimmedString(row[emailIndex])
      : "";
    const phone = phoneIndex !== -1
      ? SheetService.toTrimmedString(row[phoneIndex])
      : "";

    if (!contactMap[name]) {contactMap[name] = {email: "", phone: ""};}
    if (email) {contactMap[name].email = email;}
    if (phone) {contactMap[name].phone = phone;}
  },

  // -----------------------------------------------------------------
  // 11. 특정 날짜의 수업 목록 조회
  // -----------------------------------------------------------------
  getClassesByDate: async function(targetDateStr) {

    const results = [];

    for (const sheetId of LOG_SHEET_IDS) {

      try {
        const sheetConfig = SHEET_CONFIGS[sheetId];

        if (!sheetConfig) {
          console.warn(`[경고] SHEET_CONFIGS에 등록되지 않은 ID입니다: ${sheetId}`);

          continue;
        }
        const classes = 
          await SheetService.getClassesFromSheet(
            sheetId,
            sheetConfig,
            targetDateStr
          );

        if (Array.isArray(classes)) {
          results.push.apply(results, classes);
        }

      } catch (error) {
        console.error(`[수업 조회 실패] ${sheetId}: ${error}`);
      }
    }

    return results;
  },

  // -----------------------------------------------------------------
  // 12. 특정 시트에서 대상 날짜의 수업 조회
  // -----------------------------------------------------------------
  getClassesFromSheet: async function(
    sheetId,
    sheetConfig,
    targetDateStr
  ) {
    const isDs = sheetConfig.type === "DS";
    const spreadsheetId = SheetService.getSpreadsheet(sheetId);
    const range = `${sheetConfig.sheetName}!A:ZZ`;

    // 원본 값
    const valuesResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: "UNFORMATTED_VALUE",
    });

    // 표시 값
    const displayResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: "FORMATTED_VALUE",
    });

    const values =
      valuesResponse.data.values || [];

    const displayValues =
      displayResponse.data.values || [];

    const headerRowIndex =
      sheetConfig.headerRow - 1;

    const startRowIndex =
      sheetConfig.dataStartRow - 1;

    if (values.length <= headerRowIndex) {
      return [];
    }
  
    const indices = SheetService.getActivityColumnIndices(
      values[headerRowIndex]
    );

    const dsIndices = SheetService.getDsColumnIndices(
      indices,
      isDs
    );

    const results = [];

    // 데이터 시작 행부터 순회
    for (let i = startRowIndex;
      i < values.length;
      i++
    ) {

      const classRecord = SheetService.createClassRecord(
        values[i],
        displayValues[i] || [],
        i,
        sheetId,
        sheetConfig,
        indices,
        dsIndices
      );
      
      if (!classRecord) {
        continue;
      }

      if (
        classRecord.date !== targetDateStr
      ) {
        continue;
      }
    }
    return results;
  },
  // -----------------------------------------------------------------
  // 13. 한 행을 수업 데이터 객체로 변환 (대상 날짜가 아니면 null 반환)
  // -----------------------------------------------------------------
  createClassRecord: function(
    row,
    displayRow,
    rowIndex,
    sheetId,
    sheetConfig,
    indices,
    dsIndices
  ) {
    const rawDate = 
      SheetService.toTrimmedString(
        displayRow[indices.date]
      );

    const classDate = Utils.formatDate(rawDate);

    if (!classDate) { return null; }

    const isDs = sheetConfig.type === "DS";
    const location = isDs
      ? Utils.cleanDsSchoolName(row[indices.location])
      : SheetService.toTrimmedString(row[indices.location]);

    return {
      id: `R${rowIndex + 1}`,
      date: classDate,
      classTime: SheetService.toTrimmedString(
        displayRow[indices.classTime]
      ),

      location: location,
      className: SheetService.toTrimmedString(
        displayRow[indices.className]
      ),

      instructorName: SheetService.toTrimmedString(
        row[indices.instructor]
      ),

      email: indices.email !== -1
        ? SheetService.toTrimmedString(row[indices.email])
        : "",

      phone: indices.phone !== -1
        ? SheetService.toTrimmedString(row[indices.phone])
        : "",

      sheetId: sheetId,
      businessType: sheetConfig.type,


      // 디지털새싹(DS) 전용 데이터
      courseName: dsIndices.courseName !== -1
        ? SheetService.toTrimmedString(row[dsIndices.courseName])
        : "",

      studentCount: dsIndices.studentCount !== -1
        ? SheetService.toTrimmedString(
            displayRow[dsIndices.studentCount] || row[dsIndices.studentCount])
            : "",

      assistantInstructor: dsIndices.assistantInstructor !== -1
        ? SheetService.toTrimmedString(
          row[dsIndices.assistantInstructor]
        )
        : ""
    };
  }
};

module.exports = {
  SheetService
};