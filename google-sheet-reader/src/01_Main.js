/**
 * @file 01_Main.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-26
 * @description
 * 설정된 발송 기준일의 교육 데이터를 조회하여 사업별 그룹화, 발송 대상 선정 및 통합 알림 발송 수행
 *
 * 주요 기능:
 * - 사업 유형 및 발송 기준일 관리
 * - SheetService를 통한 교육 데이터 수집
 * - 사업별(GW/DS) 교육 데이터 조회 및 그룹화
 * - NotificationTargetService를 통한 발송 대상 추출
 * - NotificationService를 통한 문자 및 이메일 발송
 * - LogService를 통한 발송 로그 자동 저장
 * 
 * 20261117 수정: 불필요한 로그 삭제 및 수정 작업함
 * 20261119 수정: Express 서버가 기존 발송 자동화 프로그램을 호출하도록 수정
 * 20261123 수정: 한국 시간 기준 날짜 계산 (트리거를 위해서)
 * 20261124 추가: 웹에서 발송 기준일 변경 기능 추가
 * 20261125 추가: 발송 로그 화면 개별 발송(runManualSend) 기능 추가
 * 20261126 추가: runDispatch에 사업(businessTypes) 지정 옵션 추가 (웹 GW / DS 워크스페이스 분리)
 * 20261126 수정: 발송 기준일(DAYS_BEFORE)을 사업별(GW / DS)로 분리하여 저장·적용
 */


// =============================================================
// 1. 모듈 불러오기
// =============================================================
const { TEST_PERSONAL_INFO } = require("../../security_info");

const CONFIG = require("./Configs/Config");


// 20261124 추가: 발송 기준일 설정 파일 관리
const fs = require("fs");
const path = require("path");

// 20261124 추가: 웹에서 변경한 발송 기준일을 저장하는 파일
const DISPATCH_SETTINGS_PATH = path.join(
    __dirname,
    "Configs",
    "dispatch-settings.json"
);


const SheetService = require("./Services/SheetService");
const GroupService = require("./Services/GroupService");
const NotificationTargetService = require("./Services/NotificationTargetService");
const NotificationService = require("./Services/NotificationService");
const TemplateService = require("./Services/TemplateService");
const LogService = require("./Services/LogService");
const ManualSendService = require("./Services/ManualSendService"); // 20261125 추가: 개별 발송


// =============================================================
// 2. 발송 기준일 계산
// 반환 형식: YYYY-MM-DD
// 20261123 수정: 한국 시간 기준 날짜 계산
// =============================================================
function getTargetDate(daysBefore) {

    // 날짜 설정값 검증
    if (!Number.isInteger(daysBefore) || daysBefore < 0) {
        throw new Error("DAYS_BEFORE는 0 이상의 정수로 설정해야 합니다.");
    }

    // 20261123 수정: 서버 시간대와 관계없이 한국 날짜 기준으로 계산
    const todayParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());

    const today = {};

    todayParts.forEach((part) => {
        if (part.type !== "literal") {
            today[part.type] = part.value;
        }
    });

    // 기준일 + DAYS_BEFORE
    const targetDate = new Date(
        Date.UTC(
            Number(today.year),
            Number(today.month) - 1,
            Number(today.day) + daysBefore
        )
    );

    // YYYY-MM-DD 형식 변환
    const year = targetDate.getUTCFullYear();
    const month = String(targetDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// =======================================
// 2-1. 발송 기준일 설정 파일 읽기
// 20261124 추가
// 20261126 수정: 사업별 설정 구조로 변경
//   { "businesses": { "GW": { "daysBefore": 1, "updatedAt": "..." }, "DS": { ... } } }
//   기존 형식 { "daysBefore": 1 }은 모든 사업의 기본값으로 계속 인식
// =======================================
function readDispatchSettingsFile() {

    if (!fs.existsSync(DISPATCH_SETTINGS_PATH)) {
        return { legacyDaysBefore: null, businesses: {} };
    }

    try {
        const savedSettings = JSON.parse(
            fs.readFileSync(DISPATCH_SETTINGS_PATH, "utf8")
        );

        const businesses = savedSettings && typeof savedSettings.businesses === "object"
            && savedSettings.businesses !== null
            ? savedSettings.businesses
            : {};

        const legacyDaysBefore = Number.isInteger(savedSettings?.daysBefore)
            ? savedSettings.daysBefore
            : null;

        return { legacyDaysBefore, businesses };

    } catch (error) {
        throw new Error(
            `발송 기준 설정 파일을 읽지 못했습니다: ${error.message}`
        );
    }
}


// =======================================
// 2-2. 사업별 저장된 발송 기준일 조회
// 20261124 추가
// 20261126 수정: 사업별 조회
// 우선순위: 사업별 저장값 → 기존(공통) 저장값 → Config.js DAYS_BEFORE
//          (Config.js는 숫자 또는 { GW: 1, DS: 2 } 형식 모두 지원)
// =======================================
function getDaysBefore(businessType) {

    const type = String(businessType || "").trim().toUpperCase();
    const { legacyDaysBefore, businesses } = readDispatchSettingsFile();

    const savedDaysBefore = businesses[type]?.daysBefore;

    if (savedDaysBefore !== undefined) {

        if (!Number.isInteger(savedDaysBefore) || savedDaysBefore < 0) {
            throw new Error(`저장된 ${type} 발송 기준일은 0 이상의 정수여야 합니다.`);
        }

        return savedDaysBefore;
    }

    if (legacyDaysBefore !== null) {
        return legacyDaysBefore;
    }

    // 저장된 설정이 없으면 Config.js의 기본값 사용
    const configured = CONFIG.DAYS_BEFORE;
    const defaultDaysBefore = configured !== null && typeof configured === "object"
        ? configured[type]
        : configured;

    if (!Number.isInteger(defaultDaysBefore) || defaultDaysBefore < 0) {
        throw new Error(
            `Config.js의 DAYS_BEFORE(${type})는 0 이상의 정수로 설정해야 합니다.`
        );
    }

    return defaultDaysBefore;
}


// =======================================
// 2-3. 사업별 발송 기준일 설정 저장
// 20261124 추가
// 20261126 수정: 사업별 저장 (다른 사업 설정은 유지)
// =======================================
function updateDispatchSettings(businessType, daysBefore) {

    const type = String(businessType || "").trim().toUpperCase();

    if (!getBusinessTypes().includes(type)) {
        throw new Error(`발송 설정(BUSINESS_TYPE)에 없는 사업입니다: ${type || "(빈 값)"}`);
    }

    if (!Number.isInteger(daysBefore) || daysBefore < 0) {
        throw new Error("발송 기준일은 0 이상의 정수로 입력해야 합니다.");
    }

    // 기존 공통 설정이 있으면 다른 사업 값으로 옮겨서 유지
    const { legacyDaysBefore, businesses } = readDispatchSettingsFile();
    const nextBusinesses = { ...businesses };

    if (legacyDaysBefore !== null) {
        getBusinessTypes().forEach((otherType) => {
            if (!nextBusinesses[otherType]) {
                nextBusinesses[otherType] = { daysBefore: legacyDaysBefore };
            }
        });
    }

    nextBusinesses[type] = {
        daysBefore,
        updatedAt: new Date().toISOString(),
    };

    const settingsDirectory = path.dirname(DISPATCH_SETTINGS_PATH);

    // 설정 폴더가 없는 경우 생성
    fs.mkdirSync(settingsDirectory, { recursive: true });

    fs.writeFileSync(
        DISPATCH_SETTINGS_PATH,
        JSON.stringify({ businesses: nextBusinesses }, null, 2),
        "utf8"
    );

    return getDispatchSettings();
}


// =============================================================
// 3. 사업 유형 목록 가져오기
// Config.js의 BUSINESS_TYPE을 배열로 변환
// =============================================================
function getBusinessTypes() {

    const configuredTypes = CONFIG.BUSINESS_TYPE;

    // 문자열 또는 배열 모두 지원
    const businessTypes = Array.isArray(configuredTypes)
        ? configuredTypes
        : [configuredTypes];

    // 공백 제거 및 대문자 변환
    const selectedTypes = businessTypes
        .map(type => String(type).trim().toUpperCase())
        .filter(Boolean);


    // 사업 유형 설정 확인
    if (selectedTypes.length === 0) {
        throw new Error("실행할 사업 유형이 설정되지 않았습니다.");
    }

    // 중복 사업 유형 제거
    return [...new Set(selectedTypes)];
}


// =============================================================
// 3-1. 요청한 사업 유형만 선택
// 20261126 추가: 웹 워크스페이스(GW / DS)별 발송 실행
// requested가 없으면 Config 설정 전체 사용
// =============================================================
function filterBusinessTypes(configuredTypes, requested) {

    if (requested === undefined || requested === null) {
        return configuredTypes;
    }

    const requestedTypes = (Array.isArray(requested) ? requested : [requested])
        .map(type => String(type).trim().toUpperCase())
        .filter(Boolean);

    const notConfigured = requestedTypes.filter(type => !configuredTypes.includes(type));

    if (notConfigured.length > 0) {
        throw new Error(
            `발송 설정(BUSINESS_TYPE)에 없는 사업입니다: ${notConfigured.join(", ")}`
        );
    }

    if (requestedTypes.length === 0) {
        throw new Error("실행할 사업 유형이 지정되지 않았습니다.");
    }

    return [...new Set(requestedTypes)];
}


// =============================================================
// 4. 테스트 발송 설정
// =============================================================
function getTestOptions(selectedBusinessTypes) {

    const emailTestMode = CONFIG.EMAIL_TEST_MODE !== false;
    const emailTestRecipientMode = CONFIG.EMAIL_TEST_RECIPIENT_MODE === true; // 20261113 추가
    const smsTestRecipientMode = CONFIG.SMS_TEST_RECIPIENT_MODE !== false;
    const smsApiTestMode = CONFIG.TEST_MODE;

    // 이메일 테스트 수신자 모드에 따라 테스트 주소 결정
    const testEmail = emailTestRecipientMode  // 20261113 수정
        ? TEST_PERSONAL_INFO.TEST_EMAIL
        : null;

    const testPhone = smsTestRecipientMode
        ? TEST_PERSONAL_INFO.TEST_PHONE
        : null;

    // 테스트 이메일 확인
    if (
        selectedBusinessTypes.includes("GW") &&
        !emailTestMode &&
        emailTestRecipientMode &&  // 20261113 추가
        !testEmail
    ) {
        throw new Error("테스트용 이메일 주소가 설정되지 않았습니다.");
    }

    // 테스트 전화번호 확인
    if (smsTestRecipientMode && !testPhone) {
        throw new Error("테스트용 전화번호가 설정되지 않았습니다.");
    }

    return {
        emailTestMode,
        emailTestRecipientMode, // 20261113 추가
        smsTestRecipientMode,
        smsApiTestMode,
        testEmail,
        testPhone,
    };
}


// =============================================================
// 4-1. 웹 화면용 발송 설정 조회
// 20261119 추가
// =============================================================
// 20261126 수정: 사업별 발송 기준일 / 대상 교육일 반환
//   businesses: { GW: { daysBefore, targetDate }, DS: { daysBefore, targetDate } }
function getDispatchSettings() {

    const businessTypes = getBusinessTypes();
    const testOptions = getTestOptions(businessTypes);

    const businesses = {};

    businessTypes.forEach((type) => {
        const daysBefore = getDaysBefore(type);

        businesses[type] = {
            daysBefore,
            targetDate: getTargetDate(daysBefore),
        };
    });

    return {
        businessTypes,
        businesses,

        // 20261119 추가: 수신자 정보는 제외하고 테스트 설정만 반환
        modes: {
            emailPreviewMode: testOptions.emailTestMode,
            emailTestRecipientMode: testOptions.emailTestRecipientMode,
            smsTestRecipientMode: testOptions.smsTestRecipientMode,
            smsApiTestMode: Boolean(testOptions.smsApiTestMode),
        },
    };
}


// =============================================================
// 5. 공통 출력 함수
// =============================================================

// 실행 단계 구분 출력
function logSection(title) {
    console.log(`\n========================================`);
    console.log(`[${title}]`);
    console.log(`========================================`);
}

// 메시지 템플릿 미리보기
function logMessagePreview(title, subject, body) {
    console.log(`\n[${title} 제목]`);
    console.log(subject);

    console.log(`\n[${title} 본문]`);
    console.log(body);
}


// =============================================================
// 6. DS 메시지 미리보기
// =============================================================
 function previewDsMessages(target) {

    // 담당교사 안내
    if (target.담당교사연락처) {
        logMessagePreview(
            "담당교사 SMS",
            TemplateService.createDsTeacherSmsSubject(),
            TemplateService.createDsTeacherSmsBody(target)
        );
    }

    // 주강사 안내
    if (target.주강사연락처) {
        logMessagePreview(
            "주강사 SMS",
            TemplateService.createDsInstructorSmsSubject(),
            TemplateService.createDsInstructorSmsBody(target)
        );
    }

    // 보조강사 안내
    if (target.보조강사연락처) {
        logMessagePreview(
            "보조강사 SMS",
            TemplateService.createDsInstructorSmsSubject(),
            TemplateService.createDsInstructorSmsBody(target)
        );
    }

    // 대여 교구 확인 안내
    if (TemplateService.isRentalEquipmentCourse(target)) {
        logMessagePreview(
            "대여 교구 확인 SMS",
            TemplateService.createRentalEquipmentSmsSubject(),
            TemplateService.createRentalEquipmentSmsBody(target)
        );
    } else {
        console.log("[대여 교구 확인 문자] 대상 과정 아님");
    }
}

// =============================================================
// 7. GW 메시지 미리보기
// =============================================================
function previewGwMessages(target) {

    // 이메일 미리보기
    if (target.이메일발송가능) {
        logMessagePreview(
            "이메일",
            TemplateService.createEmailSubject(target),
            TemplateService.createEmailBody(target)
        );
    }

    // SMS 미리보기
    if (target.문자발송가능) {
        logMessagePreview(
            "SMS",
            TemplateService.createSmsSubject(),
            TemplateService.createSmsBody(target)
        );
    }
}


// =============================================================
// 8. 발송 결과 로그 생성 및 누적
// =============================================================
function collectLogRecords({
    businessType,
    target,
    result,
    options,
    pendingLogRecords,
}) {

    try {

        const records = LogService.BuildRecords({
            businessType,
            target,
            result,
            options,
        });

        pendingLogRecords.push(...records);

        console.log(`[${businessType}] 로그 누적: ${pendingLogRecords.length}건`); // 20261117 수정

    } catch (error) {
        // 로그 생성 오류가 기존 발송 흐름을 중단시키지 않도록 처리
        console.error(`[${businessType}] 로그 데이터 생성 실패: ${error.message}`);
    }
}


// =============================================================
// 9. DS 발송 처리
// =============================================================
async function processDsTargets({
    targets,
    testOptions,
    pendingLogRecords,
}) {

    const sendResults = [];

    logSection("DS 역할별 문자 발송 시작");

    for (const target of targets) {

        console.log(`\n[DS] ${target.학교명} / ${target.과정명} / ${target.근무날짜}`);

        // 메시지 미리보기
        previewDsMessages(target);

        // 실제 발송
        const result = await NotificationService.sendTarget(
            target,
            {
                testPhone: testOptions.testPhone,
            }
        );

        // 기존 발송 결과 유지
        sendResults.push(result);

        // 20261117 추가: DS 역할별 발송 결과 출력
        console.log("\n[DS 발송 결과]");

        for (const [role, delivery] of Object.entries(result.역할별안내 || {})) {
            const name = delivery.name || "이름 없음";
            const phone = delivery.recipient || "번호 없음";
            const status = delivery.skipped
                ? `스킵 (${delivery.reason})`
                : delivery.success
                    ? delivery.result?.testMode ? "테스트 성공" : "성공"
                    : `실패 (${delivery.error || delivery.result?.error || "발송 실패"})`;

            console.log(`${role}: ${name} | ${phone} | ${status}`);
        }

        // 발송 결과 로그 생성
        collectLogRecords({
            businessType: "DS",
            target,
            result,
            options: {
                smsTestRecipientMode: testOptions.smsTestRecipientMode,
            },
            pendingLogRecords,
        });
    }

    return sendResults;
}

// =============================================================
// 10. GW 발송 처리
// =============================================================
async function processGwTargets({
    targets,
    testOptions,
    pendingLogRecords,
}) {

    const sendResults = [];

    logSection("GW 이메일 및 문자 발송 시작");

    for (const target of targets) {

        console.log(`\n[GW] ${target.강사이름}`);
        console.log(`[실제 이메일] ${target.이메일}`);
        console.log(`[실제 연락처] ${target.연락처}`);

        // 메시지 미리보기
        previewGwMessages(target);

        // 실제 발송
        console.log("\n[GW 통합 발송 시작]");

        // 이메일 발송 대상 출력 20261113 추가
        if (target.이메일발송가능) {

            if (testOptions.emailTestMode) {
                console.log("[이메일 발송] 미리보기 모드 - 실제 발송하지 않음");

            } else if (testOptions.emailTestRecipientMode) {
                console.log(`[이메일 발송] 테스트 수신주소: ${testOptions.testEmail}`);

            } else {
                console.log(`[이메일 발송] 실제 수신주소: ${target.이메일}`);
            }
        }

        const result = await NotificationService.sendTarget(
            target,
            {
                testEmail: testOptions.testEmail,
                testPhone: testOptions.testPhone,
            }
        );

        // 기존 발송 결과 유지
        sendResults.push(result);

        // 발송 결과 로그 생성
        collectLogRecords({
            businessType: "GW",
            target,
            result,
            options: {
                emailTestMode: testOptions.emailTestMode,
                emailTestRecipientMode: testOptions.emailTestRecipientMode, // 20261113 추가
                smsTestRecipientMode: testOptions.smsTestRecipientMode,
            },
            pendingLogRecords,
        });
    }

    return sendResults;
}

// =============================================================
// 11. 메인 함수
// 20261119 수정: 웹 API에서도 호출할 수 있도록 함수명 변경
// 20261126 수정: options.businessTypes 지정 시 Config 설정 중 해당 사업만 실행
//               (웹 워크스페이스 GW / DS 분리용, 미지정 시 기존과 동일)
// =============================================================
async function runDispatch(options = {}) {

    // 사업별 발송 로그 누적 배열
    const pendingLogRecords = [];

    // 20261119 추가: 실행 결과 요약
    const runSummary = {
        businessTypes: [],
        targetDate: "",
        targetDates: {}, // 20261126 추가: 사업별 대상 교육일
        logCount: 0,
    };

    // 20261119 추가: 실행 및 로그 저장 오류 관리
    let executionError = null;

    try {

        // -----------------------------------------------------
        // 11-1. 실행 설정
        // -----------------------------------------------------
        const selectedBusinessTypes = filterBusinessTypes(
            getBusinessTypes(),
            options.businessTypes,
        ); // 20261126 수정: 요청한 사업만 실행

        // 20261126 수정: 사업별 발송 기준일 / 대상 교육일 계산
        const businessPlans = selectedBusinessTypes.map((businessType) => {
            const daysBefore = getDaysBefore(businessType);

            return {
                businessType,
                daysBefore,
                targetDate: getTargetDate(daysBefore),
            };
        });

        // 20261119 추가: 웹 API에 전달할 실행 정보
        runSummary.businessTypes = selectedBusinessTypes;
        businessPlans.forEach((plan) => {
            runSummary.targetDates[plan.businessType] = plan.targetDate;
        });
        runSummary.targetDate = [...new Set(businessPlans.map(plan => plan.targetDate))].join(", ");

        const testOptions = getTestOptions(selectedBusinessTypes);

        logSection("프로그램 실행 설정");

        console.log(`실행 사업: ${selectedBusinessTypes.join(", ")}`);
        businessPlans.forEach((plan) => {
            console.log(
                `[${plan.businessType}] 발송 기준: 수업일 ${plan.daysBefore}일 전 / 조회 대상 교육일: ${plan.targetDate}`
            );
        });

        console.log( // 20261113 수정
            `이메일 미리보기 모드: ${testOptions.emailTestMode} / ` +
            `이메일 테스트 수신자 모드: ${testOptions.emailTestRecipientMode} / ` +
            `SMS 수신번호 테스트: ${testOptions.smsTestRecipientMode} / ` +
            `뿌리오 API 테스트: ${testOptions.smsApiTestMode}`
        );


        // -----------------------------------------------------
        // 11-2. 사업별 처리
        // -----------------------------------------------------
        for (const { businessType, targetDate } of businessPlans) { // 20261126 수정: 사업별 대상 교육일

            // 교육 데이터 조회
            console.log(`[${businessType}] ${targetDate} 교육 데이터 조회`);

            const rows = await SheetService.getRowsByDate(targetDate, businessType);

            console.log(`[${businessType}] 조회 데이터: ${rows.length}건`);

            if (rows.length === 0) {
                console.log(`[${businessType}] 조회 결과가 없습니다.`);
                continue;
            }

            // 교육 일정 그룹화
            const groups = GroupService.groupClasses(rows, businessType);
            console.log(`[${businessType}] 교육 일정 그룹: ${groups.length}건`);

            // 발송 대상 생성
            const targets = NotificationTargetService.createTargets(groups, businessType);
            console.log(`[${businessType}] 발송 대상: ${targets.length}건`);

            if (targets.length === 0) {
                console.log(`[${businessType}] 발송 가능한 대상이 없습니다.`);

                continue;
            }

            // 사업별 발송 처리
            if (businessType === "DS") {

                await processDsTargets({
                    targets,
                    testOptions,
                    pendingLogRecords,
                });

                continue;
            }

            if (businessType === "GW") {

                await processGwTargets({
                    targets,
                    testOptions,
                    pendingLogRecords,
                });
            }
        }
    } catch (error) {

        console.error("\n프로그램 실행 실패");
        console.error(error.message);
        console.error(error.stack);

        executionError = error; // 20261119 수정

    } finally {

        // -----------------------------------------------------
        // 11-3. 발송 로그 일괄 저장
        // -----------------------------------------------------
        if (pendingLogRecords.length > 0) {

            try {
                await LogService.AppendLogs(pendingLogRecords);

                // 20261119 추가: 로그 저장 건수 반환
                runSummary.logCount = pendingLogRecords.length;

            } catch (logError) {
                console.error(`[01_Main.js] 로그 저장 실패: ${logError.message}`);
                console.error(logError.stack);

                // 20261119 추가: 로그 저장 오류도 API에 전달
                executionError = executionError || logError;
            }
        } else {
            console.warn("[LogService] 저장할 로그 데이터가 없습니다.");
        }
    }

    // 20261119 추가: 실행 실패를 호출한 API에 전달
    if (executionError) {
        throw executionError;
    }

    // 20261119 추가: 실행 결과 반환
    return runSummary;
}


// =============================================================
// 12. 개별 발송 실행
// 20261125 추가: 발송 로그 화면에서 선택/직접 입력한 수신자에게
//               웹에서 수정한 문자·이메일 내용을 개별 발송
//
// messages: ManualSendService.normalizeManualMessages()로 검증된 배열
// =============================================================
async function runManualSend(messages) {

    const pendingLogRecords = [];

    const runSummary = {
        type: "manual",
        total: Array.isArray(messages) ? messages.length : 0,
        logCount: 0,
        summary: {
            smsSuccess: 0,
            smsFailure: 0,
            emailSuccess: 0,
            emailFailure: 0,
        },
        results: [],
    };

    let executionError = null;

    try {

        // -----------------------------------------------------
        // 12-1. 테스트 설정 확인 (자동 발송과 동일 기준 적용)
        // -----------------------------------------------------
        const testOptions = getTestOptions(getBusinessTypes());

        logSection("개별 발송 시작");

        console.log(`발송 대상: ${runSummary.total}명`);
        console.log(
            `이메일 미리보기 모드: ${testOptions.emailTestMode} / ` +
            `이메일 테스트 수신자 모드: ${testOptions.emailTestRecipientMode} / ` +
            `SMS 수신번호 테스트: ${testOptions.smsTestRecipientMode} / ` +
            `뿌리오 API 테스트: ${testOptions.smsApiTestMode}`
        );

        // -----------------------------------------------------
        // 12-2. 수신자별 개별 발송
        // -----------------------------------------------------
        for (const [index, message] of messages.entries()) {

            const { smsDetail, emailDetail } = await ManualSendService.sendManualMessage(
                message,
                testOptions
            );

            const logOptions = {
                emailTestRecipientMode: testOptions.emailTestRecipientMode,
                smsTestRecipientMode: testOptions.smsTestRecipientMode,
            };

            // 발송 결과 로그 생성
            try {
                const record = LogService.BuildManualRecord({
                    message,
                    smsDetail,
                    emailDetail,
                    options: logOptions,
                });

                if (record) {
                    pendingLogRecords.push(record);
                }

            } catch (error) {
                console.error(`[개별 발송] 로그 데이터 생성 실패: ${error.message}`);
            }

            // 화면 표시용 결과 요약
            const toChannelResult = (detail) => detail
                ? {
                    success: Boolean(detail.success),
                    previewOnly: Boolean(detail.previewOnly),
                    testMode: Boolean(detail.result?.testMode),
                    recipient: detail.recipient || "",
                    error: detail.success ? "" : (detail.error || "발송 실패"),
                }
                : null;

            const smsResult = toChannelResult(smsDetail);
            const emailResult = toChannelResult(emailDetail);

            if (smsResult) {
                runSummary.summary[smsResult.success ? "smsSuccess" : "smsFailure"] += 1;
            }

            if (emailResult) {
                runSummary.summary[emailResult.success ? "emailSuccess" : "emailFailure"] += 1;
            }

            runSummary.results.push({
                index,
                sourceLogId: message.sourceLogId || "",
                name: message.recipient.name || "",
                sms: smsResult,
                email: emailResult,
            });

            console.log(
                `[개별 발송] ${message.recipient.name || `${index + 1}번째`} | ` +
                `문자: ${smsResult ? (smsResult.success ? "성공" : `실패(${smsResult.error})`) : "-"} | ` +
                `이메일: ${emailResult ? (emailResult.success ? "성공" : `실패(${emailResult.error})`) : "-"}`
            );
        }

    } catch (error) {

        console.error("\n개별 발송 실행 실패");
        console.error(error.message);

        executionError = error;

    } finally {

        // -----------------------------------------------------
        // 12-3. 개별 발송 로그 일괄 저장
        // -----------------------------------------------------
        if (pendingLogRecords.length > 0) {

            try {
                await LogService.AppendLogs(pendingLogRecords);
                runSummary.logCount = pendingLogRecords.length;

            } catch (logError) {
                console.error(`[01_Main.js] 개별 발송 로그 저장 실패: ${logError.message}`);

                executionError = executionError || new Error(
                    `발송은 처리되었으나 로그 저장에 실패했습니다: ${logError.message}`
                );
            }
        }
    }

    if (executionError) {
        throw executionError;
    }

    return runSummary;
}


// 20261119 추가: 메인 실행 함수 외부 공개
module.exports = {
    runDispatch,
    runManualSend, // 20261125 추가: 개별 발송 실행
    getDispatchSettings,
    updateDispatchSettings, // 20261124 추가: 웹 발송 기준일 설정 저장
};

// 20261119 수정: 직접 실행할 때만 프로그램 시작
if (require.main === module) {

    runDispatch()
        .then((result) => {
            console.log("\n프로그램 실행 완료");
            console.log(result);
        })
        .catch((error) => {
            console.error("\n프로그램 실행 실패:", error.message);
            process.exitCode = 1;
        });
}
