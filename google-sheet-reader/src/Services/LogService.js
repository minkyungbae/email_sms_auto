
/**
 * @file LogService.js
 * @author 배민경
 * @created 2026-10-28
 * @updated 2026-10-29
 * @description
 * 문자/이메일 발송 결과를 Google Sheets 로그 시트에 기록
 *
 * 주요 기능:
 * - GW / DS 발송 결과 수집
 * - 문자 / 이메일 발송 이력 개별 생성
 * - 테스트 발송과 실제 발송 구분
 * - 로그 데이터 검증 및 변환
 * - Apps Script 웹 앱을 통한 로그 일괄 저장
 */

require("dotenv").config();

const { randomUUID } = require("crypto");

const SHEET_CONFIG = require("../Configs/SheetConfig");
const CONFIG = require("../Configs/Config");
const EMAIL_CONFIG = require("../Configs/GmailConfig");
const MESSAGE_CONFIG = require("../Configs/MessageConfig");
const TemplateService = require("./TemplateService");


// =============================================================
// 1. 로그 데이터 생성
// =============================================================
function BuildRecords({
    businessType,
    target,
    result,
    options = {},
}) {
    const type = String(businessType || "").trim().toUpperCase();

    console.log(`[LogService] ${type} 로그 데이터 생성 시작`);

    if (!target || !result) {
        console.warn(`[LogService] ${type} 로그 생성 실패: target 또는 result가 없습니다.`);
        return [];
    }

    let records = [];

    if (type === "GW") {
        records = buildGwRecords(target, result, options);

    } else if (type === "DS") {
        records = buildDsRecords(target, result, options);

    } else {

        throw new Error(`지원하지 않는 로그 유형입니다: ${type}`);

    }

    // 생성 결과 확인
    console.log(`[LogService] ${type} 로그 생성: ${records.length}건`);

    return records;
}


// =============================================================
// 2. GW 로그 생성
// 이메일과 문자를 각각 별도 행으로 생성
// =============================================================
function buildGwRecords(target, result, options) {

    const records = [];


    // ---------------------------------------------------------
    // 2-1. 이메일 로그
    // ---------------------------------------------------------
    const email = result.EMAIL;

    if (email && !email.skipped) {

        records.push(
            createDispatchRecord({
                businessType: "GW",
                target,
                channel: "EMAIL",
                detail: email,

                subject: email.subject || "", // 20261029 수정: 실제 발송 메시지 제목 사용

                recipientName: target.강사이름,
                recipientPhone: target.연락처,
                recipientEmail: target.이메일,

                role: "강사",
                options,
            })
        );
    }


    // ---------------------------------------------------------
    // 2-2. 문자 로그
    // ---------------------------------------------------------
    const sms = result.SMS;

    if (sms && !sms.skipped) {

        records.push(
            createDispatchRecord({
                businessType: "GW",
                target,
                channel: "SMS",
                detail: sms,

                subject: sms.subject || "", // 20261029 수정: 실제 발송 메시지 제목 사용

                recipientName: target.강사이름,
                recipientPhone: target.연락처,
                recipientEmail: target.이메일,

                role: "강사",
                options,
            })
        );
    }
    return records;
}


// =============================================================
// 3. DS 로그 생성
// 담당교사 / 주강사 / 보조강사
// =============================================================
function buildDsRecords(target, result, options) {

    const records = [];


    // ---------------------------------------------------------
    // 3-1. 역할별 교육 안내 문자
    // ---------------------------------------------------------
    const roleResults = result.역할별안내 || {};

    Object.entries(roleResults).forEach(([role, detail]) => {

        if (!detail || typeof detail !== "object") {
            return;
        }
        records.push(
            createDsSmsRecord({
                target,
                role,
                detail,
                isRental: false,
                options,
            })
        );
    });


    // ---------------------------------------------------------
    // 3-2. 대여 교구 확인 문자
    // ---------------------------------------------------------
    const rentalResults = result.대여교구확인 || {};

    Object.entries(rentalResults).forEach(([role, detail]) => {

        // 대여 교구 대상 과정이 아닌 경우 제외
        if (
            !detail ||
            typeof detail !== "object" ||
            !detail.role
        ) {
            return;
        }

        records.push(
            createDsSmsRecord({
                target,
                role: detail.role || role,
                detail,
                isRental: true,
                options,
            })
        );
    });
    return records;
}


// =============================================================
// 4. DS 문자 로그 생성
// =============================================================
function createDsSmsRecord({
    target,
    role,
    detail,
    isRental,
    options,
}) {

    const normalizedRole = String(role || "");
    const isTeacher = normalizedRole === "담당교사"; // 20261029 수정: 역할명 정확히 비교

    // ---------------------------------------------------------
    // 4-1. 발송 유형별 제목 결정
    // ---------------------------------------------------------
    let subject;

    if (isRental) {
        subject = TemplateService.createRentalEquipmentSmsSubject();

    } else if (isTeacher) {
        subject = TemplateService.createDsTeacherSmsSubject();

    } else {
        subject = TemplateService.createDsInstructorSmsSubject();
    }


    // ---------------------------------------------------------
    // 4-2. 수신자 정보
    // ---------------------------------------------------------
    const recipientInfo = getDsRecipientInfo(
        target,
        normalizedRole
    );


    // ---------------------------------------------------------
    // 4-3. 로그 객체 생성
    // ---------------------------------------------------------
    return createDispatchRecord({
        businessType: "DS",
        target,
        channel: "SMS",
        detail,

        subject,

        recipientName: detail.name || recipientInfo.name,
        recipientPhone: recipientInfo.phone,
        recipientEmail: recipientInfo.email,

        role: normalizedRole,
        options,
    });
}


// =============================================================
// 5. DS 역할별 연락처 조회
// =============================================================
function getDsRecipientInfo(target, role) {

    const normalizedRole = String(role || "").trim();

    if (normalizedRole === "담당교사") { // 20261029 수정

        return {
            name: target.담당교사명 || "",
            phone: target.담당교사연락처 || "",
            email: target.담당교사이메일 || "",
        };
    }

    if (normalizedRole === "주강사") { // 20261029 수정

        return {
            name: target.주강사명 || "",
            phone: target.주강사연락처 || "",
            email: "",
        };
    }
    if (normalizedRole === "보조강사") { // 20261029 수정

        return {
            name: target.보조강사명 || "",
            phone: target.보조강사연락처 || "",
            email: "",
        };
    }
    return {
        name: "",
        phone: "",
        email: "",
    };
}


// =============================================================
// 6. 공통 발송 로그 객체 생성
// =============================================================
function createDispatchRecord({
    businessType,
    target,
    channel,
    detail,
    subject,
    recipientName,
    recipientPhone,
    recipientEmail,
    role,
    options,
}) {

    const isSms = channel === "SMS";

    // ---------------------------------------------------------
    // 6-1. 교육 정보
    // ---------------------------------------------------------
    const educationInfo = getEducationInfo(
        businessType,
        target
    );


    // ---------------------------------------------------------
    // 6-2. 발송 결과 상태
    // ---------------------------------------------------------
    const messageStatus = getDispatchStatus(
        channel,
        detail,
        options
    );


    // ---------------------------------------------------------
    // 6-3. 발송인 정보
    // ---------------------------------------------------------
    const senderName = isSms ? MESSAGE_CONFIG[businessType].SENDER_NAME : EMAIL_CONFIG.SENDER_NAME;
    const senderPhone = isSms ? CONFIG.PPURIO?.SENDER_NUMBER || "" : "";
    const senderEmail = isSms ? "" : EMAIL_CONFIG.USER || "";


    // ---------------------------------------------------------
    // 6-4. 발송 시각
    // ---------------------------------------------------------
    const now = getKoreaDateTime();

    const dispatchDateTime = detail.recipient ? now : ""; // 20261030 추가


    // ---------------------------------------------------------
    // 6-5. 발송 본문 추출 20261030 추가
    // GW 이메일 / 문자, DS 문자 공통 처리
    // ---------------------------------------------------------
    const messageBody = detail.bodyText || "";


    // ---------------------------------------------------------
    // 6-6. 실제 수신 정보 20261030 추가
    // ---------------------------------------------------------
    const actualRecipientPhone = isSms ? detail.recipient || "" : "";
    const actualRecipientEmail = !isSms ? detail.recipient || "" : "";


    // ---------------------------------------------------------
    // 6-7. 최종 로그 객체 20261030 수정
    // B열 No. / 차시 제외
    // ---------------------------------------------------------
    return {
        "ID": randomUUID(),                         // A열
        "교육과정명": educationInfo.courseName,      // C열
        "교육기관명": educationInfo.institutionName, // D열
        "반명": educationInfo.className,            // E열
        "교육일": educationInfo.dates,              // G열
        "요일": educationInfo.weekdays,             // H열
        "교육시간": educationInfo.times,            // I열        
        "역할": role || "",                         // J열        
        "성명": recipientName || "",                // K열
        "소속기관명": educationInfo.affiliationName, // L열
        "연락처": recipientPhone || "",             // M열
        "이메일": recipientEmail || "",             // N열
        "발송구분": isSms ? "문자" : "이메일",        // O열     
        "발송상태": messageStatus,                  // P열
        "발송일시": dispatchDateTime,               // Q열
        "발송인": senderName,                       // R열
        "발송연락처": senderPhone,                  // S열
        "발송이메일": senderEmail,                  // T열        
        "수신인": recipientName || "",              // U열        
        "실제수신연락처": actualRecipientPhone,      // V열
        "실제수신이메일": actualRecipientEmail,      // W열
        "제목": subject || "",                     // X열
        "본문": messageBody,                       // Y열
    };
}


// =============================================================
// 7. 교육 정보 추출
// =============================================================
function getEducationInfo(businessType, target) {

    const educationItems = Array.isArray(target.교육목록) ? target.교육목록 : [];

    // ---------------------------------------------------------
    // 7-1. 교육일
    // ---------------------------------------------------------
    const dates = getUniqueValues(
        educationItems
            .map(item => item.근무날짜)
            .filter(Boolean)
    );

    // GW는 교육목록 안에 근무날짜가 없으므로 대상 날짜 사용
    if (
        dates.length === 0 && target.근무날짜
    ) {
        dates.push(target.근무날짜);
    }


    // ---------------------------------------------------------
    // 7-2. 요일
    // ---------------------------------------------------------
    const weekdays = getUniqueValues(
        dates
            .map(getKoreanWeekday)
            .filter(Boolean)
    );

    // ---------------------------------------------------------
    // 7-3. 교육 시간
    // ---------------------------------------------------------
    const times = getUniqueValues(
        educationItems
            .map(item => item.근무시간 || item.시간)
            .filter(Boolean)
    );


    // ---------------------------------------------------------
    // 7-4. 과정명 20261030 수정
    // GW: 공란
    // DS: 과정명
    // --------------------------------------------------------- 
        const courseName = businessType === "GW"
        ? ""
        : target.과정명 || "";


    // ---------------------------------------------------------
    // 7-5. 교육기관명 20261030 추가
    // GW: 수요처명
    // DS: 학교명
    // --------------------------------------------------------- 
    const institutionName = businessType === "GW"
        ? target.수요처명 || ""
        : target.학교명 || "";
    

    // ---------------------------------------------------------
    // 7-6. 반명 20261030 추가
    // GW: 반명
    // DS: LMS번호&반을 우선으로 하고, 반명이 있으면 반명 사용
    // --------------------------------------------------------- 
    const className = businessType === "GW"
        ? target.반명 || ""
        : target.반명 || target.LMS번호반 || "";


    // ---------------------------------------------------------
    // 7-7. 소속기관명 20261030 추가
    // GW: 센터명 또는 기존 소속기관명
    // DS: 기존 소속기관명 또는 학교명
    // ---------------------------------------------------------
    const affiliationName = target.소속기관명 ||
        (
            businessType === "GW"
                ? target.센터명 || ""
                : target.학교명 || ""
        );

    return {
        courseName,
        institutionName,
        className,
        affiliationName,

        dates: dates.join(", "),

        weekdays: weekdays
            .map(day => `${day}요일`)
            .join(", "),

        times: times.join("\n"),
    };
}

// =============================================================
// 8. 발송 상태 구분
// =============================================================
function getDispatchStatus(channel, detail, options = {}) {

    const label = channel === "SMS" ? "문자" : "이메일";

    // ---------------------------------------------------------
    // 8-1. 발송 스킵
    // ---------------------------------------------------------
    if (detail.skipped) {
        return `${label} 스킵: ${detail.reason || "발송 대상 아님"}`;
    }


    // ---------------------------------------------------------
    // 8-2. 발송 실패
    // ---------------------------------------------------------
    if (!detail.success) {

        const errorMessage = detail.error || detail.result?.error || "";

        return errorMessage ? `${label} 발송실패: ${errorMessage}` : `${label} 발송실패`;
    }


    // ---------------------------------------------------------
    // 8-3. 뿌리오 TEST_MODE
    // 실제 문자를 발송하지 않음
    // ---------------------------------------------------------
    if (
        channel === "SMS" && detail.result?.testMode
    ) {
        return "테스트(실제 미발송)";
    }


    // ---------------------------------------------------------
    // 8-4. 테스트 수신번호 발송
    // ---------------------------------------------------------
    if (
        channel === "SMS" && options.smsTestRecipientMode
    ) {
        return "테스트 수신번호 발송완료";
    }


    // ---------------------------------------------------------
    // 8-5. 테스트 이메일 발송
    // ---------------------------------------------------------
    if (
        channel === "EMAIL" &&
        options.emailTestMode
    ) {
        return "테스트 수신주소 발송완료";
    }
    return `${label} 발송완료`;
}


// =============================================================
// 9. 한국 시간
// =============================================================
function getKoreaDateTime() {

    return new Date().toLocaleString("sv-SE", {timeZone: "Asia/Seoul",});

}


// =============================================================
// 10. 날짜에서 요일 추출
// 지원 형식:
// YYYY-MM-DD
// YYYY/MM/DD
// M/D
// M월 D일
// =============================================================
function getKoreanWeekday(dateValue) {

    const text = String(dateValue || "").trim();

    let match = text.match(/^(?:(\d{4})[-./]\s*)?(\d{1,2})[-./]\s*(\d{1,2})$/);

    if (!match) {

        match = text.match(/^(\d{1,2})월\s*(\d{1,2})일$/);

        if (match) {
            match = [match[0], null, match[1], match[2]];
        }
    }

    if (!match) {
        return "";
    }

    const year = Number(match[1] || new Date().getFullYear());
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    // 유효한 날짜인지 확인
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return "";
    }

    const weekdays = ["일", "월", "화", "수", "목", "금", "토",];

    return weekdays[date.getUTCDay()];

}


// =============================================================
// 11. 중복값 제거
// =============================================================
function getUniqueValues(values) {

    return [
        ...new Set(
            values
                .map(value => String(value).trim())
                .filter(Boolean)
        ),
    ];
}


// =============================================================
// 12. Google Sheets 로그 전송
// =============================================================
async function AppendLogs(records) {

    if (!Array.isArray(records) || records.length === 0) {
        return {
            success: true,
            count: 0,
            message: "저장할 로그가 없습니다.",
        };

    }


    // ---------------------------------------------------------
    // 12-1. 설정 확인
    // ---------------------------------------------------------
    const logConfig = SHEET_CONFIG.LOG;

    const url = logConfig.APPS_SCRIPT_URL;
    const token = logConfig.TOKEN;
    const spreadsheetId = logConfig.SPREADSHEET.ID;  // 20261029 추가

    if (!url) {
        throw new Error("로그 Apps Script URL이 설정되지 않았습니다.");
    }

    if (!token) {
        throw new Error("로그 API 인증키가 설정되지 않았습니다.");
    }

    if (!spreadsheetId) {
        throw new Error("로그 스프레드시트 ID가 설정되지 않았습니다.");
    }

    if (typeof fetch !== "function") {
        throw new Error("현재 Node.js 환경에서 fetch를 사용할 수 없습니다.");
    }
    console.log("[LogService] Apps Script 로그 전송 시작");
    console.log(`전송 대상: ${records.length}건`);


    // ---------------------------------------------------------
    // 12-2. POST 요청
    // ---------------------------------------------------------
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 60000);

    let response;

    try {

        response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                token,
                spreadsheetId, // 20261029 추가
                records,
            }),
            redirect: "follow",
            signal: controller.signal,
        });
    } catch (error) {

        const cause = error.cause || error;

        if (error.name === "AbortError") {
            throw new Error("로그 API 요청 시간이 초과되었습니다.");
        }

        throw new Error(
            `로그 API 통신 실패: ${cause.code || cause.message || error.message}`
        );
    } finally {
        clearTimeout(timeoutId);
    }


    // ---------------------------------------------------------
    // 12-3. 응답 확인 및 JSON 파싱
    // ---------------------------------------------------------
    const responseText = await response.text();

    let responseData;

    try {
        responseData = JSON.parse(responseText);

    } catch (error) {
        throw new Error(`로그 API 응답 JSON 파싱 실패: HTTP ${response.status}`);
    }


    // ---------------------------------------------------------
    // 12-4. 저장 성공 여부 확인
    // ---------------------------------------------------------
    if (!response.ok || !responseData.success) {
        throw new Error(
            responseData.message || `로그 저장 실패: HTTP ${response.status}`
        );
    }
    console.log(`[LogService] Google Sheets 로그 저장 완료: ${responseData.count}건`);

    return responseData;

}


module.exports = {
    BuildRecords,
    AppendLogs,
};
