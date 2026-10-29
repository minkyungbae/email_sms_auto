
/**
 * @file LogService.js
 * @author 배민경
 * @created 2026-10-28
 * @updated 2026-10-28
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

    console.log("\n========================================");
    console.log(`[LogService] ${type} 로그 데이터 생성 시작`);

    if (!target || !result) {
        console.warn("[LogService] target 또는 result가 없습니다.");
        return [];
    }

    console.log("[LogService] target keys:", Object.keys(target));
    console.log("[LogService] result keys:", Object.keys(result));

    let records = [];

    if (type === "GW") {

        console.log("[LogService] GW EMAIL 결과:", {
            success: result.EMAIL?.success,
            skipped: result.EMAIL?.skipped,
            recipientExists: Boolean(result.EMAIL?.recipient),
        });

        console.log("[LogService] GW SMS 결과:", {
            success: result.SMS?.success,
            skipped: result.SMS?.skipped,
            recipientExists: Boolean(result.SMS?.recipient),
            testMode: result.SMS?.result?.testMode,
        });

        records = buildGwRecords(target, result, options);

    } else if (type === "DS") {

        console.log("[LogService] DS 역할별 안내:", Object.keys(result.역할별안내 || {}));
        console.log("[LogService] DS 대여 교구 확인:", Object.keys(result.대여교구확인 || {}));

        records = buildDsRecords(target, result, options);

    } else {

        throw new Error(`지원하지 않는 로그 유형입니다: ${type}`);

    }

    // 생성 결과 확인
    console.log(`[LogService] ${type} 생성된 로그: ${records.length}건`);

    if (records.length > 0) {

        console.table(
            records.map(record => ({
                ID: record["ID"]?.slice(0, 8),
                역할: record["역할"],
                구분: record["문자/이메일구분"],
                상태: record["문자발송상태"],
                제목: record["제목"],
            }))
        );
    }
    console.log(`[LogService] ${type} 로그 데이터 생성 완료`);
    console.log("========================================");

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

        const emailSubject = TemplateService.createEmailSubject(target);

        records.push(
            createDispatchRecord({
                businessType: "GW",
                target,
                channel: "EMAIL",
                detail: email,

                subject: emailSubject,

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

        const smsSubject = TemplateService.createSmsSubject();

        records.push(
            createDispatchRecord({
                businessType: "GW",
                target,
                channel: "SMS",
                detail: sms,

                subject: smsSubject,

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

        // 대여 교구 대상 과정이 아닌 경우 { skipped: true }로 반환되므로 제외
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
    const isTeacher = normalizedRole.startsWith("담당교사");

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


    // ---------------------------------------------------------
    // 6-5. 최종 로그 객체
    // B열 No. / D열 차시 / H열 교육상세장소는 제외
    // 본문 컬럼은 시트에서 제거되었으므로 기록하지 않음
    // ---------------------------------------------------------
    return {
        "ID": randomUUID(),                                     // A열: ID
        "과정명": educationInfo.courseName,                     // C열: 과정명
        "교육일": educationInfo.dates,                          // E열: 교육일
        "요일": educationInfo.weekdays,                        // F열: 요일
        "시간": educationInfo.times,                           // G열: 시간
        "역할": role || "",                                    // I열: 역할
        "성명": recipientName || "",                           // J열: 성명
        "소속기관명": target.소속기관명 || 
        (businessType === "DS" ? target.학교명 || "" : ""),    // K열: 소속기관명
        "연락처": recipientPhone || "",                        // L열: 연락처
        "이메일": recipientEmail || "",                       // M열: 이메일
        "문자발송상태": messageStatus,                         // N열: 문자발송상태
        "문자발송일": isSms && detail.recipient ? now : "",   // O열: 문자발송일
        "발송인": senderName,                                // P열: 발송인
        "발송번호": senderPhone,                             // Q열: 발송번호
        "발송이메일": senderEmail,                           // R열: 발송이메일
        "수신인": recipientName || "",                      // S열: 수신인
        "수신번호": isSms ? detail.recipient || "" : "",    // T열: 실제 수신번호
        "수신이메일": !isSms ? detail.recipient || "" : "", // U열: 실제 수신이메일
        "문자/이메일구분": isSms ? "문자" : "이메일",         // V열: 문자/이메일구분
        "제목": subject || "",                            // W열: 제목
    };
}


// =============================================================
// 7. 교육 정보 추출
// =============================================================
function getEducationInfo(businessType, target) {

    const educationItems = Array.isArray(target.교육목록)  ? target.교육목록 : [];

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
    // 7-4. 과정명
    // ---------------------------------------------------------
    // DS: target.과정명
    // GW: 원본 대상에 과정명이 없으므로 근무유형 사용
    const courseName = target.과정명 || (businessType === "GW" ? target.근무유형 : "") || "";

    return {
        courseName,
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

        console.log("[LogService] 저장할 로그가 없습니다.");

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

    console.log("\n========================================");
    console.log("[LogService] Apps Script 로그 전송 시작");
    console.log(`전송 대상: ${records.length}건`);
    console.log("========================================");


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

        console.error("[LogService] Apps Script 통신 실패");
        console.error("오류 유형:", error.name);
        console.error("오류 코드:", cause.code || "UNKNOWN");
        console.error("오류 내용:", cause.message || error.message);

        if (error.name === "AbortError") {
            throw new Error("로그 API 요청 시간이 초과되었습니다.");
        }

        throw new Error(`로그 API 통신 실패: ${cause.code || cause.message || error.message}`);

    } finally {

        clearTimeout(timeoutId);

    }


    // ---------------------------------------------------------
    // 12-3. 응답 확인
    // ---------------------------------------------------------
    const responseText = await response.text();

    console.log("[LogService] HTTP 상태:", response.status);
    console.log("[LogService] 응답 길이:", responseText.length);


    // ---------------------------------------------------------
    // 12-4. JSON 파싱
    // ---------------------------------------------------------
    let responseData;

    try {

        responseData = JSON.parse(responseText);

    } catch (error) {

        console.error("[LogService] 응답 JSON 파싱 실패");
        console.error("[LogService] 응답 앞부분:", responseText.slice(0, 500));

        throw new Error(`로그 API 응답을 JSON으로 변환하지 못했습니다. HTTP ${response.status}`);

    }


    // ---------------------------------------------------------
    // 12-5. 저장 성공 여부 확인
    // ---------------------------------------------------------
    if (!response.ok || !responseData.success) {

        console.error("[LogService] Apps Script 저장 실패");
        console.error("응답:", responseData);

        throw new Error(responseData.message || `로그 저장 실패: HTTP ${response.status}`);
    }

    console.log("\n[LogService] Apps Script 응답 확인");
    console.log("저장 건수:", responseData.count);
    console.log("시작 행:", responseData.startRow);
    console.log("마지막 행:", responseData.endRow);
    console.log("[LogService] 로그 저장 완료");
    console.log("========================================");

    return responseData;

}


module.exports = {
    BuildRecords,
    AppendLogs,
};
