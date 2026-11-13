
/**
 * @file 01_Main.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-13
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

        console.log(`[${businessType}] 로그 ${records.length}건 생성 / 누적 ${pendingLogRecords.length}건`);

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
        console.log(`[담당교사] ${target.담당교사명} / ${target.담당교사연락처}`);
        console.log(`[주강사] ${target.주강사표기} / ${target.주강사연락처}`);
        console.log(`[보조강사] ${target.보조강사표기} / ${target.보조강사연락처}`);

        // 메시지 미리보기
        previewDsMessages(target);

        // 실제 발송
        console.log(`\n[DS 문자 발송] 수신번호: ${testOptions.testPhone || "각 역할의 실제 연락처"}`);

        const result = await NotificationService.sendTarget(
            target,
            {
                testPhone: testOptions.testPhone,
            }
        );

        // 기존 발송 결과 유지
        sendResults.push(result);

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

    logSection("DS 최종 처리 결과");
    console.log(`처리한 교육 일정: ${sendResults.length}건`);

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

    logSection("GW 최종 처리 결과");
    console.log(`처리한 발송 대상: ${sendResults.length}건`);

    return sendResults;
}

// =============================================================
// 11. 메인 함수
// =============================================================
async function main() {

    // 사업별 발송 로그 누적 배열
    const pendingLogRecords = [];

    try {

        // -----------------------------------------------------
        // 11-1. 실행 설정
        // -----------------------------------------------------
        const selectedBusinessTypes = getBusinessTypes();
        const daysBefore = CONFIG.DAYS_BEFORE;
        const targetDate = getTargetDate(daysBefore);

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

            logSection(`${businessType} 사업 처리 시작`);

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

    } finally {

        // -----------------------------------------------------
        // 11-3. 발송 로그 일괄 저장
        // -----------------------------------------------------
        logSection("LogService 최종 로그 저장");
        console.log(`누적 로그: ${pendingLogRecords.length}건`);

        if (pendingLogRecords.length > 0) {

            try {
                await LogService.AppendLogs(pendingLogRecords);

                // AppendLogs의 반환값은 성공 시 "success" 문자열이므로 실제 누적한 로그 건수를 기준으로 출력
                console.log(`[LogService] 최종 저장 완료: ${pendingLogRecords.length}건`);

            } catch (logError) {

                console.error(`[01_Main.js] 로그 저장 실패: ${logError.message}`);
                console.error(logError.stack);

            }

        } else {

            console.warn("[LogService] 저장할 로그 데이터가 없습니다.");

        }
    }
}

// 프로그램 실행
main();
