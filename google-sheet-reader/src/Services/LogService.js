
/**
 * @file LogService.js
 * @author 배민경
 * @created 2026-10-28
 * @updated 2026-10-28
 * @description
 * 문자/이메일 발송 결과를 Google Sheets 로그 시트에 기록
 *
 * 주요 기능:
 * - GW / DS 발송 결과를 로그 객체로 변환
 * - 문자 / 이메일 발송 이력 개별 생성
 * - 테스트 발송과 실제 발송 구분
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
    const type = String(businessType || "")
        .trim()
        .toUpperCase();

    if (!target || !result) {
        return [];
    }

    if (type === "GW") {
        return buildGwRecords(target, result, options);
    }

    if (type === "DS") {
        return buildDsRecords(target, result, options);
    }

    throw new Error(`지원하지 않는 로그 유형입니다: ${type}`);
}


// =============================================================
// 2. GW 로그 생성
// 이메일과 문자를 별도 행으로 생성
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

                subject: TemplateService.createEmailSubject(target),
                bodyText: TemplateService.createEmailBody(target),

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

                subject: TemplateService.createSmsSubject(),
                bodyText: TemplateService.createSmsBody(target),

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
// 대여 교구 확인 문자까지 각각 별도 행 생성
// =============================================================
function buildDsRecords(target, result, options) {
    const records = [];

    // ---------------------------------------------------------
    // 3-1. 역할별 교육 안내 문자
    // ---------------------------------------------------------
    const roleResults = result.역할별안내 || {};

    Object.entries(roleResults).forEach(([role, detail]) => {

        if (!detail) return;

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

        // 대여 교구 확인 대상 과정이 아닌 경우 제외 단, 연락처가 없어서 스킵된 역할별 결과는 기록
        if (!detail || !detail.role) return;

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
    const isTeacher = String(role).startsWith("담당교사");
    const isRentalRole = isRental ||
        String(role).includes("대여 교구 확인");

    // 담당교사 / 주강사 / 보조강사 메시지 구분
    let subject;
    let bodyText;

    if (isRentalRole) {

        subject = TemplateService.createRentalEquipmentSmsSubject();
        bodyText = TemplateService.createRentalEquipmentSmsBody(target);

    } else if (isTeacher) {

        subject = TemplateService.createDsTeacherSmsSubject();
        bodyText = TemplateService.createDsTeacherSmsBody(target);

    } else {

        subject = TemplateService.createDsInstructorSmsSubject();
        bodyText = TemplateService.createDsInstructorSmsBody(target);

    }


    // 원래 수신자의 연락처 정보
    const recipientInfo = getDsRecipientInfo(target, role);

    return createDispatchRecord({
        businessType: "DS",
        target,
        channel: "SMS",
        detail,

        subject,
        bodyText,

        recipientName: detail.name || recipientInfo.name,
        recipientPhone: recipientInfo.phone,
        recipientEmail: recipientInfo.email,

        role,
        options,
    });
}


// =============================================================
// 5. DS 역할별 연락처 조회
// =============================================================
function getDsRecipientInfo(target, role) {
    const normalizedRole = String(role || "").trim();

    if (normalizedRole.startsWith("담당교사")) {
        return {
            name: target.담당교사명 || "",
            phone: target.담당교사연락처 || "",
            email: target.담당교사이메일 || "",
        };
    }

    if (normalizedRole.startsWith("주강사")) {
        return {
            name: target.주강사명 || "",
            phone: target.주강사연락처 || "",
            email: "",
        };
    }

    if (normalizedRole.startsWith("보조강사")) {
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
    bodyText,
    recipientName,
    recipientPhone,
    recipientEmail,
    role,
    options,
}) {
    const isSms = channel === "SMS";

    // 교육 정보
    const educationInfo = getEducationInfo(
        businessType,
        target
    );

    // 발송 결과 상태
    const messageStatus = getDispatchStatus(
        channel,
        detail,
        options
    );

    // 발송인 정보
    const senderName = isSms ? MESSAGE_CONFIG[businessType].SENDER_NAME : EMAIL_CONFIG.SENDER_NAME;
    const senderPhone = isSms ? CONFIG.PPURIO?.SENDER_NUMBER || "" : "";
    const senderEmail = isSms ? "" : EMAIL_CONFIG.USER || "";

    // 발송 시간
    const now = getKoreaDateTime();

    return {

        "ID": randomUUID(),
        "과정명": educationInfo.courseName,
        "교육일": educationInfo.dates,
        "요일": educationInfo.weekdays,
        "시간": educationInfo.times,

        // 수신자 정보
        "역할": role || "",
        "성명": recipientName || "",
        "소속기관명": target.소속기관명 || (businessType === "DS" ? target.학교명 || "" : ""),
        "연락처": recipientPhone || "",
        "이메일": recipientEmail || "",

        // 발송 결과
        "문자발송상태": messageStatus,
        "문자발송일": isSms && detail.recipient ? now : "",

        // 발송인
        "발송인": senderName,
        "발송번호": senderPhone,
        "발송이메일": senderEmail,

        // 실제 발송한 수신자
        "수신인": recipientName || "",
        "수신번호": isSms ? detail.recipient || "" : "",
        "수신이메일":!isSms ? detail.recipient || "" : "",
        "문자/이메일구분": isSms ? "문자" : "이메일",
        "제목": subject || "",
        "본문": bodyText || "",
    };
}


// =============================================================
// 7. 교육 정보 추출
// =============================================================
function getEducationInfo(businessType, target) {
    const educationItems = Array.isArray(target.교육목록)
        ? target.교육목록
        : [];

    // 교육일
    const dates = getUniqueValues(
        educationItems
            .map(item => item.근무날짜)
            .filter(Boolean)
    );

    // 교육일이 교육목록에 없으면 대상의 근무날짜 사용
    if (dates.length === 0 && target.근무날짜) {
        dates.push(target.근무날짜);
    }

    // 요일
    const weekdays = getUniqueValues(dates.map(getKoreanWeekday).filter(Boolean));

    // 교육 시간
    const times = getUniqueValues(
        educationItems
            .map(item => item.근무시간 || item.시간)
            .filter(Boolean)
    );

    return {
        courseName: target.과정명 || "",
        dates: dates.join(", "),
        weekdays: weekdays.map(day => `${day}요일`).join(", "),
        times: times.join("\n"),
    };
}


// =============================================================
// 8. 발송 상태 구분
// =============================================================
function getDispatchStatus(channel, detail, options = {}) {
    const label = channel === "SMS" ? "문자" : "이메일";

    // 연락처 등의 문제로 발송하지 않은 경우
    if (detail.skipped) {
        return `${label} 스킵: ${detail.reason || "발송 대상 아님"}`;
    }

    // 발송 실패
    if (!detail.success) {
        const errorMessage =
            detail.error ||
            detail.result?.error ||
            "";

        return errorMessage
            ? `${label} 발송실패: ${errorMessage}`
            : `${label} 발송실패`;
    }

    // 뿌리오 TEST_MODE
    // 실제 문자는 발송하지 않은 상태
    if (
        channel === "SMS" &&
        detail.result?.testMode
    ) {
        return "테스트(실제 미발송)";
    }

    // 테스트 수신번호로 실제 문자 발송
    if (
        channel === "SMS" &&
        options.smsTestRecipientMode
    ) {
        return "테스트 수신번호 발송완료";
    }

    // 테스트 이메일 주소로 이메일 발송
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
    return new Date().toLocaleString("sv-SE", {
        timeZone: "Asia/Seoul",
    });
}


// =============================================================
// 10. 날짜에서 요일 추출
// YYYY-MM-DD 형식만 처리
// =============================================================
function getKoreanWeekday(dateValue) {
    const match = String(dateValue || "").match(
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

    if (!match) {
        return "";
    }

    const [, year, month, day] = match;

    const date = new Date(
        Date.UTC(
            Number(year),
            Number(month) - 1,
            Number(day)
        )
    );

    const weekdays = [
        "일","월", "화", "수", "목", "금", "토",];

    return weekdays[date.getUTCDay()];
}


// =============================================================
// 11. 중복값 제거
// =============================================================
function getUniqueValues(values) {
    return [
        ...new Set(values.map(value => String(value).trim()).filter(Boolean)),
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

    const logConfig = SHEET_CONFIG.LOG;

    const url = logConfig.APPS_SCRIPT_URL;
    const token = logConfig.TOKEN;

    if (!url) {
        throw new Error("로그 Apps Script URL이 설정되지 않았습니다.");
    }

    if (!token) {
        throw new Error("로그 API 인증키가 설정되지 않았습니다.");
    }

    if (typeof fetch !== "function") {
        throw new Error("현재 Node.js 환경에서 fetch를 사용할 수 없습니다.");
    }


    // POST 요청
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            token,
            records,
        }),
    });


    // 응답 확인
    const responseText = await response.text();

    let responseData;

    try {
        responseData = JSON.parse(responseText);

    } catch (error) {
        throw new Error(`로그 API 응답을 JSON으로 변환하지 못했습니다. HTTP ${response.status}`);
    }

    if (!response.ok || !responseData.success) {
        throw new Error(responseData.message || `로그 저장 실패: HTTP ${response.status}`);
    }

    return responseData;
}


// =============================================================
// 모듈 내보내기
// =============================================================
module.exports = {
    BuildRecords,
    AppendLogs,
};
