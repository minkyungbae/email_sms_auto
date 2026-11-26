/**
 * @file LogService.js
 * @author 배민경
 * @created 2026-10-28
 * @updated 2026-11-26
 * @description
 * 문자/이메일 발송 결과를 Google Sheets 로그 시트에 기록
 *
 * 주요 기능:
 * - GW / DS 발송 결과 수집
 * - GW 문자 / 이메일 발송 결과를 한 행으로 통합 기록
 * - 테스트 발송과 실제 발송 구분
 * - 로그 데이터 검증 및 변환
 * - Apps Script 웹 앱을 통한 로그 일괄 저장
 * - 로그 저장 실패 시 상세 오류 메시지 제공
 * - 한국 시간 기준 발송 시각 기록
 * - 발송 대상 교육 정보 추출 및 정규화
 * - DS 강사 역할별 소속기관명 정규화
 * - 발송 상태 구분: 스킵, 실패, 테스트, 성공
 * 
 * 20261117 수정: 불필요한 로그 삭제 작업함
 * 20261125 추가: 발송 로그 화면 개별 발송 로그 생성(BuildManualRecord)
 * 20261126 추가: 로그 저장 후 웹 화면용 발송 로그 캐시 비우고 다시 불러오기
 */

require("dotenv").config();

const { randomUUID } = require("crypto");

const SHEET_CONFIG = require("../Configs/SheetConfig");
const CONFIG = require("../Configs/Config");
const EMAIL_CONFIG = require("../Configs/GmailConfig");
const MESSAGE_CONFIG = require("../Configs/MessageConfig");
const TemplateService = require("./TemplateService");
const DataQueryService = require("./DataQueryService"); // 20261126 추가: 발송 로그 캐시 갱신


// 상수
const BUSINESS_TYPES = {
    GW: "GW",
    DS: "DS",
};

const CHANNELS = {
    EMAIL: "EMAIL",
    SMS: "SMS",
};

const LOG_PREFIX = "[LogService.js]";

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

    if (!target || !result) {
        console.warn(`${LOG_PREFIX} ${type} 로그 생성 실패: 대상 또는 결과 없음`);
        return [];
    }

    let records = [];

    switch (type) {
        case BUSINESS_TYPES.GW:
            records = buildGwRecords(target, result, options);
            break;

        case BUSINESS_TYPES.DS:
            records = buildDsRecords(target, result, options);
            break;

        default:
            throw new Error(`지원하지 않는 로그 유형입니다: ${type}`);
    }

    return records;
}


// =============================================================
// 2. GW 로그 생성
// 이메일과 문자를 각각 별도 행으로 생성
// 20261117 함수 전체 수정
// =============================================================
function buildGwRecords(target, result, options) {

    const smsDetail = result.SMS || null;
    const emailDetail = result.EMAIL || null;

    // 결과가 없거나 스킵된 채널은 기록 대상에서 제외
    const hasSmsRecord = Boolean(smsDetail && !smsDetail.skipped);
    const hasEmailRecord = Boolean(emailDetail && !emailDetail.skipped);

    // 문자와 이메일 모두 기록 대상이 아니면 로그를 생성하지 않음
    if (!hasSmsRecord && !hasEmailRecord) {
        return [];
    }

    // 문자 발송 결과가 있으면 문자 정보를 공통 정보 기준으로 사용
    // 문자 결과가 없으면 이메일 정보를 기준으로 사용
    const baseChannel = hasSmsRecord
        ? CHANNELS.SMS
        : CHANNELS.EMAIL;

    const baseDetail = hasSmsRecord
        ? smsDetail
        : emailDetail;

    // 채널별 발송 상태를 각각 추출
    const smsStatus = hasSmsRecord
        ? getDispatchStatus(CHANNELS.SMS, smsDetail, options)
        : "";

    const emailStatus = hasEmailRecord
        ? getDispatchStatus(CHANNELS.EMAIL, emailDetail, options)
        : "";

    // 제목은 이메일 제목을 우선 사용하고, 없으면 문자 제목 사용
    const subject = (hasEmailRecord && emailDetail.subject) ||
        (hasSmsRecord && smsDetail.subject) ||
        "";

    // 문자와 이메일 결과를 하나의 로그 객체로 생성
    return [
        createDispatchRecord({
            businessType: BUSINESS_TYPES.GW,
            target,
            channel: baseChannel,
            detail: baseDetail,
            subject,
            recipientName: target.강사이름,
            recipientPhone: target.연락처,
            recipientEmail: target.이메일,
            role: "강사",
            options,
            smsStatus,
            emailStatus,
            smsDetail: hasSmsRecord ? smsDetail : null,
            emailDetail: hasEmailRecord ? emailDetail : null,
        }),
    ];
}


// =============================================================
// 3. DS 로그 생성
// 담당교사 / 주강사 / 보조강사
// 교육 안내 및 대여 교구 확인 로그 공통 처리
// =============================================================
function buildDsRecords(target, result, options) {

    const records = [];

    // 교육 안내 문자
    appendDsRecords({
        records,
        target,
        results: result.역할별안내,
        isRental: false,
        options,
    });

    // 대여 교구 확인 문자
    appendDsRecords({
        records,
        target,
        results: result.대여교구확인,
        isRental: true,
        options,
    });

    return records;
}


// =============================================================
// 3-1. DS 역할별 로그 공통 생성
// 교육 안내 / 대여 교구 확인 공통 처리
// =============================================================
function appendDsRecords({
    records,
    target,
    results,
    isRental,
    options,
}) {
    if (!results || typeof results !== "object") {
        return;
    }

    Object.entries(results).forEach(([role, detail]) => {

        if (!detail || typeof detail !== "object") {
            return;
        }

        // 대여 교구 확인 결과 중 역할 정보가 없는 항목 제외
        if (isRental && !detail.role) {
            return;
        }

        records.push(
            createDsSmsRecord({
                target,
                role: detail.role || role,
                detail,
                isRental,
                options,
            })
        );
    });
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

    // 발송 유형에 따른 제목 결정
    let subject;

    if (isRental) {
        subject = TemplateService.createRentalEquipmentSmsSubject();

    } else if (isTeacher) {
        subject = TemplateService.createDsTeacherSmsSubject();

    } else {
        subject = TemplateService.createDsInstructorSmsSubject();
    }

    // 역할별 수신자 정보
    const recipientInfo = getDsRecipientInfo(
        target,
        normalizedRole
    );

    return createDispatchRecord({
        businessType: BUSINESS_TYPES.DS,
        target,
        channel: CHANNELS.SMS,
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

    const recipientMap = {
        "담당교사": {
            name: target.담당교사명 || "",
            phone: target.담당교사연락처 || "",
            email: target.담당교사이메일 || "",
        },

        "주강사": {
            name: target.주강사명 || "",
            phone: target.주강사연락처 || "",
            email: "",
        },

        "보조강사": {
            name: target.보조강사명 || "",
            phone: target.보조강사연락처 || "",
            email: "",
        },
    };

    return recipientMap[normalizedRole] || {
        name: "",
        phone: "",
        email: "",
    };
}


// =============================================================
// 6. 공통 발송 로그 객체 생성
// GW 이메일 / GW 문자 / DS 문자 공통 처리
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
    smsStatus = null, // 20261117 추가: GW 문자 발송 상태
    emailStatus = null, // 20261117 추가: GW 이메일 발송 상태
    smsDetail = null, // 20261117 추가: GW 문자 발송 상세
    emailDetail = null, // 20261117 추가: GW 이메일 발송 상세
}) {

    const isSms = channel === CHANNELS.SMS;

    // ---------------------------------------------------------
    // 6-1. 교육 정보
    // ---------------------------------------------------------
    const educationInfo = getEducationInfo(
        businessType,
        target,
        role // 20261030 추가 : DS 역할별 소속기관명 구분
    );


    // ---------------------------------------------------------
    // 6-2. 발송 결과 상태
    // ---------------------------------------------------------
    const messageStatus = getDispatchStatus(
        channel,
        detail,
        options
    );

    const finalSmsStatus = smsStatus !== null // 20261117 추가
        ? smsStatus
        : (isSms ? messageStatus : "");

    const finalEmailStatus = emailStatus !== null // 20261117 추가
        ? emailStatus
        : (!isSms ? messageStatus : "");


    // ---------------------------------------------------------
    // 6-3. 발송인 정보
    // ---------------------------------------------------------
    const senderName = isSms 
        ? MESSAGE_CONFIG[businessType].SENDER_NAME 
        : EMAIL_CONFIG.SENDER_NAME;

    const senderPhone = (isSms || smsDetail) // 20261117 추가
        ? CONFIG.PPURIO?.SENDER_NUMBER || ""
        : "";

    const senderEmail = (!isSms || emailDetail) // 20261117 추가
        ? EMAIL_CONFIG.USER || ""
        : "";


    // ---------------------------------------------------------
    // 6-4. 발송 시각
    // ---------------------------------------------------------
    const now = getKoreaDateTime();

    // GW는 문자 또는 이메일 중 실제 수신 대상이 확인되면 발송 시각 기록
    // DS는 기존 단일 문자 수신 정보 사용
    const hasRecipient = Boolean( // 20261117 추가
        (smsDetail && smsDetail.recipient) ||
        (emailDetail && emailDetail.recipient) ||
        (!smsDetail && !emailDetail && detail.recipient)
    );

    const dispatchDateTime = hasRecipient ? now : ""; // 20261117 수정


    // ---------------------------------------------------------
    // 6-5. 발송 본문 추출 20261030 추가
    // GW 이메일 / 문자, DS 문자 공통 처리
    // ---------------------------------------------------------
    const smsBody = smsDetail // 20261117 추가
        ? smsDetail.bodyText || ""
        : (isSms ? detail.bodyText || "" : "");

    const emailBody = emailDetail // 20261117 추가
        ? emailDetail.bodyText || ""
        : (!isSms ? detail.bodyText || "" : "");


    // ---------------------------------------------------------
    // 6-6. 실제 수신 정보 20261030 추가
    // ---------------------------------------------------------
    const actualRecipientPhone = smsDetail // 20261117 수정
        ? smsDetail.recipient || ""
        : (isSms ? detail.recipient || "" : "");

    const actualRecipientEmail = emailDetail // 20261117 수정
        ? emailDetail.recipient || ""
        : (!isSms ? detail.recipient || "" : "");


    // ---------------------------------------------------------
    // 6-7. 최종 로그 객체
    // B열 No. / 차시 제외
    // 20261030 수정
    // 20261116 수정: O, P열에 채널별 발송 상태 기록
    // ---------------------------------------------------------
    return {
        "ID": randomUUID(),
        "교육과정명": educationInfo.courseName,
        "교육기관명": educationInfo.institutionName,
        "반명": educationInfo.className,
        "교육일": educationInfo.dates,
        "요일": educationInfo.weekdays,
        "교육시간": educationInfo.times,
        "역할": role || "",
        "성명": recipientName || "",
        "소속기관명": educationInfo.affiliationName,
        "연락처": recipientPhone || "",
        "이메일": recipientEmail || "",

        // 20261116 수정: 문자는 O, 이메일은 P열에 상태 기록
        // 20261117 수정: 통합 로그의 채널별 상태값 사용
        "문자발송상태": finalSmsStatus, // 20261117 수정
        "이메일발송상태": finalEmailStatus, // 20261117 수정

        "발송일시": dispatchDateTime,
        "발송인": senderName,
        "발송연락처": senderPhone,
        "발송이메일": senderEmail,
        "수신인": recipientName || "",
        "실제수신연락처": actualRecipientPhone,
        "실제수신이메일": actualRecipientEmail,
        "제목": subject || "",
        "문자본문내용": smsBody, // 20261117 수정
        "이메일본문내용": emailBody, // 20261117 추가
    };
}


// =============================================================
// 7. 교육 정보 추출
// =============================================================
function getEducationInfo(businessType, target, role) { // 20261030 수정: 역할 인자 추가

    const educationItems = Array.isArray(target.교육목록)
        ? target.교육목록
        : [];

    // ---------------------------------------------------------
    // 7-1. 교육일
    // ---------------------------------------------------------
    const dates = getUniqueValues(
        educationItems
            .map(item => item.근무날짜)
            .filter(Boolean)
    );

    // GW는 교육목록 안에 근무날짜가 없으므로 대상 날짜 사용
    if (dates.length === 0 && target.근무날짜) {
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
    // GW: 공란 / DS: 과정명
    // --------------------------------------------------------- 
        const courseName = businessType === BUSINESS_TYPES.GW
        ? ""
        : target.과정명 || "";


    // ---------------------------------------------------------
    // 7-5. 교육기관명 20261030 추가
    // GW: 수요처명 / DS: 학교명
    // --------------------------------------------------------- 
    const institutionName = businessType === BUSINESS_TYPES.GW
        ? target.수요처명 || ""
        : target.학교명 || "";
    

    // ---------------------------------------------------------
    // 7-6. 반명 20261112 수정
    // GW: 교육목록 반명 / DS: LMS\n번호 &\n반
    // --------------------------------------------------------- 
    const className = businessType === BUSINESS_TYPES.GW
        ? target.반명 || (target.교육목록 || [])
            .map(classInfo => classInfo.반명 || "")
            .filter(Boolean)
            .join(", ")
        : target.LMS번호반 || target.반명 || target["LMS\n번호 &\n반"] || ""; // 20261112 수정: DS 반명 필드 우선순위 변경


    // ---------------------------------------------------------
    // 7-7. 소속기관명 20261030 수정
    // GW: 지역 + 센터
    // DS 담당교사: 학교명
    // DS 주강사/보조강사: 해당 강사의 학교급 정규화 
    // ---------------------------------------------------------
    let affiliationName = "";

    if (businessType === BUSINESS_TYPES.GW) {
        affiliationName = target.소속기관명 || `${target.지역 || ""}센터`;

    } else if (role === "담당교사") {
        affiliationName = target.학교명 || "";

    } else if (role === "주강사") {
        affiliationName = getInstructorAffiliation(
            target.주강사표기,
            target.주강사명,
            target.주강사학교명, // 20261112 추가: DS 주강사 학교명
            target.주강사학교급
        );

    } else if (role === "보조강사") {
        affiliationName = getInstructorAffiliation(
            target.보조강사표기,
            target.보조강사명,
            target.보조강사학교명, // 20261112 추가: DS 보조강사 학교명
            target.보조강사학교급
        );

    } else {
        affiliationName = target.학교명 || "";
    }

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
// 8. DS 강사 소속기관명 추출 202611112 수정
//    1. 강사 표기에서 강사 이름을 제거한 학교명을 우선 반환
//    2. 표기에서 학교명을 추출할 수 없으면 학교명 + 학교급으로 구성
// =============================================================
function getInstructorAffiliation(
    instructorLabel,
    instructorName,
    schoolName,
    schoolLevel
) {
    const label = String(instructorLabel || "").trim();
    const name = String(instructorName || "").trim();

    // 강사 표기에서 강사 이름을 제거하여 학교명 추출
    if (label && name && label.includes(name)) {

        const prefix = label.slice(0, label.indexOf(name)).trim();

        if (prefix) {
            return prefix;
        }
    }

    // 표기값에서 학교명을 추출할 수 없는 경우 대체값 사용
    const fallbackSchoolName = String(schoolName || "").trim();
    const fallbackSchoolLevel = String(schoolLevel || "").trim();

    return `${fallbackSchoolName}${fallbackSchoolLevel}`;
}


// =============================================================
// 9. 발송 상태 구분
// =============================================================
function getDispatchStatus(channel, detail, options = {}) {

    const label = channel === CHANNELS.SMS
        ? "문자" 
        : "이메일";

    // ---------------------------------------------------------
    // 9-1. 발송 스킵
    // ---------------------------------------------------------
    if (detail.skipped) {
        return `${label} 스킵: ${detail.reason || "발송 대상 아님"}`;
    }


    // ---------------------------------------------------------
    // 9-2. 발송 실패
    // ---------------------------------------------------------
    if (!detail.success) {

        const errorMessage = detail.error || detail.result?.error || "";

        return errorMessage
            ? `${label} 발송실패: ${errorMessage}`
            : `${label} 발송실패`;
    }

    // ---------------------------------------------------------
    // 9-3. 이메일 테스트 모드 20261113 추가
    // 실제 이메일을 발송하지 않고 로그만 기록
    // ---------------------------------------------------------
    if (channel === CHANNELS.EMAIL && detail.previewOnly) {
        return "테스트(실제 미발송)";
    }

    // ---------------------------------------------------------
    // 9-4. 뿌리오 TEST_MODE
    // 실제 문자를 발송하지 않음
    // ---------------------------------------------------------
    if (channel === CHANNELS.SMS && detail.result?.testMode) {
        return "테스트(실제 미발송)";
    }


    // ---------------------------------------------------------
    // 9-5. 테스트 수신번호 발송
    // ---------------------------------------------------------
    if (channel === CHANNELS.SMS && options.smsTestRecipientMode) {
        return "테스트 수신번호 발송완료";
    }


    // ---------------------------------------------------------
    // 9-6. 테스트 이메일 발송
    // ---------------------------------------------------------
    if (channel === CHANNELS.EMAIL && options.emailTestRecipientMode) { // 20261113 수정
        return "테스트 수신주소 발송완료";
    }
    return `${label} 발송완료`;
}


// =============================================================
// 10. 한국 시간
// =============================================================
function getKoreaDateTime() {

    return new Date().toLocaleString("sv-SE", {timeZone: "Asia/Seoul",});

}


// =============================================================
// 11. 날짜에서 요일 추출
// 지원 형식:
//  YYYY-MM-DD
//  YYYY/MM/DD
//  M/D
//  M월 D일
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
// 12. 중복값 제거
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
// 12-1. 개별 발송 로그 생성
// 20261125 추가: 발송 로그 화면에서 선택/직접 입력한 수신자 개별 발송
//
// - 기존 로그 시트 컬럼 구조(A:AB)를 그대로 사용
// - 문자 / 이메일 결과를 한 행으로 통합 기록 (GW 로그와 동일 방식)
// - 발송 상태 뒤에 " · 개별발송"을 붙여 자동 발송 로그와 구분
// =============================================================
const MANUAL_STATUS_SUFFIX = " · 개별발송";

function BuildManualRecord({
    message,
    smsDetail = null,
    emailDetail = null,
    options = {},
}) {

    if (!message || (!smsDetail && !emailDetail)) {
        return null;
    }

    const businessType = BUSINESS_TYPES[message.businessType] || BUSINESS_TYPES.GW;
    const recipient = message.recipient || {};
    const education = message.education || {};

    // ---------------------------------------------------------
    // 12-1-1. 채널별 발송 상태
    // ---------------------------------------------------------
    const smsStatus = smsDetail
        ? `${getDispatchStatus(CHANNELS.SMS, smsDetail, options)}${MANUAL_STATUS_SUFFIX}`
        : "";

    const emailStatus = emailDetail
        ? `${getDispatchStatus(CHANNELS.EMAIL, emailDetail, options)}${MANUAL_STATUS_SUFFIX}`
        : "";

    // ---------------------------------------------------------
    // 12-1-2. 발송인 정보
    // ---------------------------------------------------------
    const senderName = smsDetail
        ? MESSAGE_CONFIG[businessType]?.SENDER_NAME || EMAIL_CONFIG.SENDER_NAME
        : EMAIL_CONFIG.SENDER_NAME;

    // 제목은 이메일 제목을 우선 사용하고, 없으면 문자 제목 사용
    const subject = (emailDetail && emailDetail.subject) ||
        (smsDetail && smsDetail.subject) ||
        "";

    return {
        "ID": randomUUID(),
        "교육과정명": education.교육과정명 || "",
        "교육기관명": education.교육기관명 || "",
        "반명": education.반명 || "",
        "교육일": education.교육일 || "",
        "요일": education.요일 || "",
        "교육시간": education.교육시간 || "",
        "역할": recipient.role || "",
        "성명": recipient.name || "",
        "소속기관명": recipient.affiliation || "",
        "연락처": recipient.phone || "",
        "이메일": recipient.email || "",
        "문자발송상태": smsStatus,
        "이메일발송상태": emailStatus,
        "발송일시": getKoreaDateTime(),
        "발송인": senderName,
        "발송연락처": smsDetail ? CONFIG.PPURIO?.SENDER_NUMBER || "" : "",
        "발송이메일": emailDetail ? EMAIL_CONFIG.USER || "" : "",
        "수신인": recipient.name || "",
        "실제수신연락처": smsDetail ? smsDetail.recipient || "" : "",
        "실제수신이메일": emailDetail ? emailDetail.recipient || "" : "",
        "제목": subject,
        "문자본문내용": smsDetail ? smsDetail.bodyText || "" : "",
        "이메일본문내용": emailDetail ? emailDetail.bodyText || "" : "",
    };
}


// =============================================================
// 13. Google Sheets 로그 전송
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
    // 13-1. 설정 확인
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


    // ---------------------------------------------------------
    // 13-2. POST 요청 20261030 수정: 요청 제한 시간 60초 -> 120초
    // ---------------------------------------------------------
    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 120000); // 20261030 수정: 60000 -> 120000

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

        throw new Error(`로그 API 통신 실패: ${cause.code || cause.message || error.message}`);

    } finally {
        clearTimeout(timeoutId);
    }


    // ---------------------------------------------------------
    // 13-3. 응답 확인 및 JSON 파싱 20261112 수정
    // ---------------------------------------------------------
    const responseText = await response.text();

    let responseData;

    try {
        responseData = JSON.parse(responseText);

    } catch (error) {

        console.error(`${LOG_PREFIX} 응답 파싱 실패 (HTTP ${response.status}, 
            ${response.headers.get("content-type") || "Content-Type 없음"})`);
        console.error(`${LOG_PREFIX} 응답 내용: ${responseText.slice(0, 500)}`);

        throw new Error(`로그 API 응답 JSON 파싱 실패: HTTP ${response.status}`);
    }


    // ---------------------------------------------------------
    // 13-4. 저장 성공 여부 확인
    // ---------------------------------------------------------
    if (!response.ok || !responseData.success) {

        throw new Error(
            responseData.message || `로그 저장 실패: HTTP ${response.status}`
        );
    }

    // 20261126 추가: 새 로그가 화면에 바로 보이도록 발송 로그 캐시 비우고 다시 불러오기
    DataQueryService.invalidateLogRecords();
    
    return "success";

}


module.exports = {
    BuildRecords,
    BuildManualRecord, // 20261125 추가: 개별 발송 로그 생성
    AppendLogs,
};
