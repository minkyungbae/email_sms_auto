/**
 * @file 01_Main.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-19
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
 */


// =============================================================
// 1. 모듈 불러오기
// =============================================================
const { TEST_PERSONAL_INFO } = require("../../security_info");

const CONFIG = require("./Configs/Config");

const SheetService = require("./Services/SheetService");
const GroupService = require("./Services/GroupService");
const NotificationTargetService = require("./Services/NotificationTargetService");
const NotificationService = require("./Services/NotificationService");
const TemplateService = require("./Services/TemplateService");
const LogService = require("./Services/LogService");


// =============================================================
// 2. 발송 기준일 계산
// 반환 형식: YYYY-MM-DD
// =============================================================
function getTargetDate(daysBefore) {

    // 날짜 설정값 검증
    if (!Number.isInteger(daysBefore) || daysBefore < 0) {
        throw new Error("DAYS_BEFORE는 0 이상의 정수로 설정해야 합니다.");
    }

    // 현재 날짜 기준 계산
    const today = new Date();

    const targetDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + daysBefore
    );

    // YYYY-MM-DD 형식 변환
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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
function getDispatchSettings() {

    const businessTypes = getBusinessTypes();
    const daysBefore = CONFIG.DAYS_BEFORE;
    const testOptions = getTestOptions(businessTypes);

    return {
        businessTypes,
        daysBefore,
        targetDate: getTargetDate(daysBefore),

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
// =============================================================
async function runDispatch() {

    // 사업별 발송 로그 누적 배열
    const pendingLogRecords = [];

    // 20261119 추가: 실행 결과 요약
    const runSummary = {
        businessTypes: [],
        targetDate: "",
        logCount: 0,
    };

    // 20261119 추가: 실행 및 로그 저장 오류 관리
    let executionError = null;

    try {

        // -----------------------------------------------------
        // 11-1. 실행 설정
        // -----------------------------------------------------
        const selectedBusinessTypes = getBusinessTypes();
        const daysBefore = CONFIG.DAYS_BEFORE;
        const targetDate = getTargetDate(daysBefore);

        // 20261119 추가: 웹 API에 전달할 실행 정보
        runSummary.businessTypes = selectedBusinessTypes;
        runSummary.targetDate = targetDate;

        const testOptions = getTestOptions(selectedBusinessTypes);

        logSection("프로그램 실행 설정");

        console.log(`실행 사업: ${selectedBusinessTypes.join(", ")}`);
        console.log(`발송 기준: 수업일 ${daysBefore}일 전`);
        console.log(`조회 대상 교육일: ${targetDate}`);

        console.log( // 20261113 수정
            `이메일 미리보기 모드: ${testOptions.emailTestMode} / ` +
            `이메일 테스트 수신자 모드: ${testOptions.emailTestRecipientMode} / ` +
            `SMS 수신번호 테스트: ${testOptions.smsTestRecipientMode} / ` +
            `뿌리오 API 테스트: ${testOptions.smsApiTestMode}`
        );


        // -----------------------------------------------------
        // 11-2. 사업별 처리
        // -----------------------------------------------------
        for (const businessType of selectedBusinessTypes) {

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


// 20261119 추가: 메인 실행 함수 외부 공개
module.exports = {
    runDispatch,
    getDispatchSettings,
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
