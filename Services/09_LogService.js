/**
 * =================================================================
 * 09_LogService.js
 * 중복 발송 방지 및 발송 이력 기록
 *
 * 처리 흐름
 * 1. 실행 시작 → 기존 REAL 로그를 메모리에 로드
 * 2. 발송 성공 → 로그를 메모리에 적재
 * 3. 모든 발송 종료 → 센터별 로그를 일괄 저장
 *
 * 장점
 * - 발송마다 Sheet 접근하지 않음
 * - 센터별로 setValues() 1회 수행
 * - 동일 실행 내 중복 발송 방지
 * =================================================================
 */

const { google } = require("googleapis");

const CONFIG = require("../Configs/Config.js");
const {
  SHEET_CONFIG,
  SHEET_NAME_LOG
} = require("../Configs/SheetConfig.js");

const { Utils } = require("../Utils/Utils.js");

// ====================================================================
// Google Sheets API 인증
// ====================================================================
const auth = new google.auth.GoogleAuth({
  keyFile: "security_info.json",
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets"
  ]
})

const sheets = google.sheets({
  version: "v4",
  auth: auth
});


const LogService = {

  // 실행 중 발송된 로그
  _sentSet: null,

  // 센터별 대기 로그
  _pendingLogs: {},

  // 이미 조회한 Log Sheet 캐시
  _logSheets: {},


  // -----------------------------------------------------------------
  // 1. 로그 헤더 (컬럼명 정의)
  // -----------------------------------------------------------------
  LOG_HEADERS: [
    "LogKey",
    "강사명",
    "이메일/연락처",
    "수업일자",
    "수요처",
    "반명",
    "발송채널",
    "발송구분",
    "발송일시",
    "제목",
    "본문"
  ],


  // -----------------------------------------------------------------
  // 2. 초기화
  // -----------------------------------------------------------------

  // 2-1. 실행 시작 시 LogService 상태 초기화
  initialize: function() {
    this._sentSet = new Set();
    this._pendingLogs = {};
    this._logSheets = {};
  },


  // 2-2. 초기화 여부 확인
  ensureInitialized: function() {
    if (!this._sentSet) {
      this.initialize();
    }
  },


  // -----------------------------------------------------------------
  // 3. 기존 로그 캐시
  // -----------------------------------------------------------------
  /**
   * 기존 REAL 발송 로그를 메모리에 로드
   * 중복 발송 판단에 필요한 LogKey + Channel 정보만 캐시
   */
  async preloadSentLogs() {

    this.ensureInitialized();

    const logSheetIds = LOG_SHEET_IDS || [];

    for (const sheetId of logSheetIds) {
      await this._loadSentLogsFromSheet(sheetId);
    }

    console.log(`[로그 캐시] ${this._sentSet.size}건 로드`);
  },


  // 3-1. 특정 센터의 로그 시트에서 REAL 발송 이력을 읽어옴
  async _loadSentLogsFromSheet(sheetId) {

    try {

      const response =
        await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${SHEET_NAME_LOG}!A:H`,
          valueRenderOption: "UNFORMATTED_VALUE"
        });

      const values = response.data.values || [];

      // 헤더만 있거나 데이터가 없는 경우
      if (values.length < 2) {
        return;
      }


      // 헤더를 제외한 데이터만 처리
      const data = values.slice(1);

      data.forEach((row) => {

        const logKey = this._normalizeValue(row[0]); // A: LogKey
        const channel = this._normalizeChannel(row[6]); // G: 발송채널
        const sendType = this._normalizeValue(row[7]); // H: 발송구분

        if (
          !logKey ||
          !channel ||
          sendType !== "REAL"
        ) {
          return;
        }

        this._sentSet.add(this._createSentKey(logKey, channel));
      });
    } catch (error) {

      const status = error?.response?.status;

      if (status !== 400 && status !== 404) {
        console.error(`[로그 조회 실패] sheetId=${sheetId}, ${error}`);
      }
    }
  },


  // -----------------------------------------------------------------
  // 3-2. 중복 발송 체크
  // -----------------------------------------------------------------
  // 이미 발송된 이력이 있는지 확인 (EMAIL과 SMS는 각각 별도로 관리)
  isAlreadySent: function(
    logKey, 
    channel
  ) {
    this.ensureInitialized();

    const normalizedLogKey = this._normalizeValue(logKey);
    const normalizedChannel = this._normalizeChannel(channel);
    const key = this._createSentKey(
      normalizedLogKey,
      normalizedChannel);

    return this._sentSet.has(key);
  },


  // 3-2-1. 중복 체크용 Key 생성
  _createSentKey: function(logKey, channel) {
    return `${logKey}_${channel}`;
  },


  // -----------------------------------------------------------------
  // 4. 로그 적재
  // -----------------------------------------------------------------
  /**
   * 발송 로그를 메모리에 적재
   * 실제 Sheet 저장은 flushLogs()에서 일괄 처리
   */
  queueLog: function(
    logKey,
    classItem,
    recipient,
    subject,
    bodyText,
    channel
  ) {
    this.ensureInitialized();

    const sheetId = this._getLogSheetId(classItem);

    if (!sheetId) {
      console.error("[LogService Error] sheetId를 찾을 수 없습니다.");

      return;
    }

    // 4-1. 센터별 로그 배열 생성
    if (!this._pendingLogs[sheetId]) {
      this._pendingLogs[sheetId] = [];
    }

    const normalizedChannel = this._normalizeChannel(channel);
    const sendType = CONFIG.TEST_MODE ? "TEST" : "REAL";

    const row = 
      this._createLogRow(
        logKey,
        classItem,
        recipient,
        subject,
        bodyText,
        normalizedChannel,
        sendType
    );

    this._pendingLogs[sheetId].push(row);

    // REAL 발송만 중복 체크 캐시에 즉시 반영
    // 같은 실행 안에서 동일 대상에게 다시 발송되는 것을 방지
    if (sendType === "REAL") {

      this._sentSet.add(
        this._createSentKey(
          logKey, 
          normalizedChannel
        )
      );
    }
  },


  // -----------------------------------------------------------------
  // 5. 로그 저장 Sheet ID 결정
  // -----------------------------------------------------------------
  /**
   * 우선순위
   * 1. classItem.sheetId
   * 2. SheetConfig의 LOG_SHEET_IDS 첫 번째 값
   */
  _getLogSheetId: function(classItem) {

    if (
      classItem && 
      classItem.sheetId
    ) {
      return classItem.sheetId;
    }

    const logSheetIds = LOG_SHEET_IDS || [];

    if (logSheetIds.length > 0) {
      return logSheetIds[0];
    }

    return null;
  },


  // -----------------------------------------------------------------
  // 6. 로그 한 행 생성
  // -----------------------------------------------------------------
  _createLogRow: function(
    logKey,
    classItem,
    recipient,
    subject,
    bodyText,
    channel,
    sendType
  ) {

    return [
      logKey,
      this._getClassItemValue(classItem, "instructorName"),
      recipient || "",
      this._getClassItemValue(classItem, "date"),
      this._getClassItemValue(classItem, "location"),
      this._getClassItemValue(classItem, "className"),
      channel,
      sendType,
      this._getCurrentDateTime(),
      subject || "",
      bodyText || ""
    ];
  },


  // -----------------------------------------------------------------
  // 6-1. classItem 값 안전하게 조회
  // -----------------------------------------------------------------
  _getClassItemValue(
    classItem,
    key
  ) {
    if (!classItem) {
      return "";
    }
    
    return classItem[key] || "";
  },


  // -----------------------------------------------------------------
  // 7 . 현재 날짜/시간 반환
  // -----------------------------------------------------------------
  _getCurrentDateTime() {
    
    try {
      
      if (
        Utils &&
        typeof Utils.getNowDateTimeString === "function"
      ){
        return Utils.getNowDateTimeString();
      }
    } catch (error) {
      // Utils에 전용 함수가 있으면 사용하고, 없으면 Date 객체를 사용
    }
    return new Date();
  },


  // -----------------------------------------------------------------
  // 8. 로그 Sheet 관리
  // -----------------------------------------------------------------
  
  /** 이미 가져온 Sheet는 캐시하여 동일 실행에서 반복 조회하지 않음 */
  async getLogSheet(sheetId) {

    this.ensureInitialized();

    // 캐시된 Sheet가 있으면 재사용
    if (this._logSheets[sheetId]) {
      return this._logSheets[sheetId];
    }

    // 현재 스프레드시트의 Sheet 목록 조회
    const spreadsheetResponse = 
      await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: "sheets.properties"
      });

      const existingSheets =
        spreadsheetResponse.data.sheets || [];

      let sheet = 
        existingSheets.find((item) =>
          item.properties &&
          item.properties.title === SHEET_NAME_LOG
        );

      // 로그 Sheet가 없는 경우 생성
      if (!sheet) {

        const createResponse =
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,

            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: {
                      title: SHEET_NAME_LOG
                    }
                  }
                }
              ]
            }
          });

          sheet =
            createResponse.data.replies?.[0]?.addSheet;

          await this._initializeLogSheet(sheetId);
      }

      this._logSheets[sheetId] = sheet;

      return sheet;
  },


  // -----------------------------------------------------------------
  // 9. 새 로그 Sheet 초기화
  // -----------------------------------------------------------------
  async _initializeLogSheet(sheetId) {

    // 9-1. 헤더 입력
    await sheets.spreadsheets.values.update({

      spreadsheetId: sheetId,

      range: `${SHEET_NAME_LOG}!A1:K1`,

      valueInputOption: "RAW",

      requestBody: {
        values: [
          this.LOG_HEADERS
        ]
      }
    });


    // 9-2. 헤더 굵게 표시
    const response =
      await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: "sheets.properties"
      });

    const sheet =
      (response.data.sheets || [])
        .find((item) =>
          item.properties &&
          item.properties.title === SHEET_NAME_LOG
        );
    if (
      sheet &&
      sheet.properties &&
      sheet.properties.sheetId !== undefined
    ) {

      await sheets.spreadsheets.batchUpdate({

        spreadsheetId: sheetId,

        requestBody: {
          requests: [
            {
              repeatCell: {

                range: {
                  sheetId:
                    sheet.properties.sheetId,

                  startRowIndex: 0,
                  endRowIndex: 1,

                  startColumnIndex: 0,
                  endColumnIndex:
                    this.LOG_HEADERS.length
                },

                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true
                    }
                  }
                },

                fields:
                  "userEnteredFormat.textFormat.bold"
              }
            }
          ]
        }
      });
    }
  },


  // -----------------------------------------------------------------
  // 10. 로그 일괄 저장
  // -----------------------------------------------------------------

  /** 메모리에 쌓인 로그를 센터별로 한 번에 Sheet에 저장 */
  async flushLogs() {

    this.ensureInitialized();

    let totalCount = 0;

    const sheetIds = Object.keys(this._pendingLogs);

    for (const sheetId of sheetIds){
      totalCount += 
        await this._flushSheetLogs(sheetId);
    }

    // 저장 완료 후 대기 로그 초기화
    this._pendingLogs = {};

    console.log(`[로그 일괄 저장 완료] ${totalCount}건`);

    return totalCount;
  },


  // -----------------------------------------------------------------
  // 11. 특정 센터의 대기 로그 저장
  // -----------------------------------------------------------------
  async _flushSheetLogs(sheetId) {

    const rows = this._pendingLogs[sheetId];

    if (
      !rows ||
      rows.length === 0
    ) {
      return 0;
    }

    try {
      // 로그 sheet 확보
      await this.getLogSheet(sheetId);

      // 현재 로그 데이터 조회
      const response =
        await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `${SHEET_NAME_LOG}!A:K`,
          valueRenderOption: "UNFORMATTED_VALUE"
        });


      // 현재 마지막 행 확인
      const existingValues = response.data.values || [];

      // 기존 데이터 다음 행부터 기록
      const lastRow = existingValues.length;
      const startRow = lastRow + 1;
      const endRow = startRow + rows.length -1;

      // A:K 영역에 로그 일괄 저장
      await sheets.spreadsheets.values.update({

        spreadsheetId: sheetId,
        
        range: `${SHEET_NAME_LOG}!A${startRow}:K${endRow}`,

        valueInputOption: "RAW",

        requestBody: {
          values: rows
        }
      });
      return rows.length;

    } catch (error) {
      
      console.error(`[로그 저장 실패] sheetId=${sheetId}, ${error}`);

      return 0;
    }
  },


  // -----------------------------------------------------------------
  // 12. 값 정규화
  // -----------------------------------------------------------------

  // 12-1. 일반 문자열 정규화
  _normalizeValue: function(value) {
    return String(value || "").trim();
  },

  // 12-2. 발송 채널 정규화 (email → EMAIL, sms → SMS)
  _normalizeChannel: function(channel) {
    return this._normalizeValue(channel).toUpperCase();
  },

  
  // -----------------------------------------------------------------
  // 13. 에러 로그 출력
  // -----------------------------------------------------------------
  writeErrorLog: function(error) {
    if (!error) {
      console.error("[LogService Error] 알 수 없는 오류");
      return;
    }
    console.error(error.toString());
  }
};

module.exports = LogService;