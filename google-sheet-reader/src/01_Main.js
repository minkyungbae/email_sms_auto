/**
 * @file 01_Main.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-14
 * @description
 * 설정된 발송 기준일의 교육 데이터를 조회하여 사업별 그룹화, 발송 대상 선정 및 통합 알림 발송 수행
 * 
 * 주요 기능 :
 * - Config.js를 통한 사업 유형 및 발송 기준일 관리
 * - SheetService를 통한 교육 데이터 수집
 * - 사업별(GW/DS) 교육 데이터 조회
 * - GroupService를 통한 교육 일정 그룹화
 * - NotificationTargetService를 통한 발송 대상 추출
 * - TemplateService를 통한 이메일 및 SMS 문구 생성
 * - NotificationService를 통한 통합 발송
 */


// =============================================================
// 모듈 불러오기
// =============================================================
const { TEST_PERSONAL_INFO } = require("../../security_info");

const CONFIG = require("./Configs/Config");

const SheetService = require("./Services/SheetService");
const GroupService = require("./Services/GroupService");
const NotificationTargetService = require("./Services/NotificationTargetService");
const NotificationService = require("./Services/NotificationService");
const TemplateService = require("./Services/TemplateService");


// =============================================================
// 발송 기준일 계산 261012 추가
// 반환 형식: YYYY-MM-DD
// =============================================================
function getTargetDate(daysBefore) {
    // 날짜 설정값 검증
    if (
        !Number.isInteger(daysBefore) ||
        daysBefore < 0
    ) {
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
// 사업 유형 목록 가져오기 // 261012 추가
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
// 메인 실행
// =============================================================
async function main() {

    try {

        // -----------------------------------------------------
        // 1. 설정 불러오기
        // -----------------------------------------------------
        const selectedBusinessTypes = getBusinessTypes(); // 261012 추가
        const daysBefore = CONFIG.DAYS_BEFORE;            // 261012 추가
        const targetDate = getTargetDate(daysBefore);     // 261012 추가

        // -----------------------------------------------------
        // 2. 테스트 발송 설정
        // -----------------------------------------------------
        const emailTestMode = CONFIG.EMAIL_TEST_MODE !== false;                 // 이메일 테스트 261012 추가
        const smsTestRecipientMode = CONFIG.SMS_TEST_RECIPIENT_MODE !== false; // SMS 수신번호 테스트 261012 추가
        const smsApiTestMode = CONFIG.TEST_MODE;                               // 뿌리오로 문자 발송 테스트 261012 추가

        // 이메일 수신자
        const testEmail = emailTestMode ? TEST_PERSONAL_INFO.TEST_EMAIL : null;

        // 문자 수신자
        const testPhone = smsTestRecipientMode ? TEST_PERSONAL_INFO.TEST_PHONE : null;


        // 테스트 이메일 확인
        if (
            selectedBusinessTypes.includes("GW") &&
            emailTestMode &&
            !testEmail
        ) {
            throw new Error("테스트용 이메일 주소가 설정되지 않았습니다.");
        }


        // 테스트 전화번호 확인
        if (
            smsTestRecipientMode &&
            !testPhone
        ) {
            throw new Error("테스트용 전화번호가 설정되지 않았습니다.");
        }


        // -----------------------------------------------------
        // 3. 실행 설정 출력
        // -----------------------------------------------------
        console.log("\n========================================");
        console.log("[프로그램 실행 설정]");
        console.log(`실행 사업: ${selectedBusinessTypes.join(", ")}`);
        console.log(`발송 기준: 수업일 ${daysBefore}일 전`);
        console.log(`조회 대상 교육일: ${targetDate}`);
        console.log(`이메일 테스트 모드: ${emailTestMode} ||  SMS 수신번호 테스트 모드: ${smsTestRecipientMode} ||  뿌리오 발송 테스트 모드: ${smsApiTestMode}`);
        console.log("========================================");


        // -----------------------------------------------------
        // 4. 사업별 처리 시작 261014 추가
        // -----------------------------------------------------
        for (const businessType of selectedBusinessTypes) {

            console.log(`\n[${businessType}] 사업 처리 시작`);

            // -----------------------------------------------------
            // 4-1. 교육 데이터 조회
            // -----------------------------------------------------
            console.log(`\n[${businessType}] ${targetDate} 교육 데이터 조회 시작`);

            const rows = await SheetService.getRowsByDate(targetDate, businessType);
            console.log(`[${businessType}] 조회된 데이터: ${rows.length}건`);

            if (rows.length === 0) {
                console.log(`[${businessType}] 조회 결과가 없습니다.`);
                continue;
            }

            // -----------------------------------------------------
            // 4-2. 교육 일정 그룹화
            // -----------------------------------------------------

            const groups = GroupService.groupClasses(
                rows,
                businessType
            );

            console.log(`[${businessType}] 교육 일정 그룹: ${groups.length}건`);


            // -----------------------------------------------------
            // 4-3. 발송 대상 생성
            // -----------------------------------------------------

            const targets = NotificationTargetService.createTargets(
                groups,
                businessType
            );

            console.log(`[${businessType}] 실제 발송 대상: ${targets.length}건`);

            if (targets.length === 0) {
                console.log(`[${businessType}] 발송 가능한 대상이 없습니다.`);
                continue;
            }


            // =====================================================
            // 4-4. DS 사업일 때
            // =====================================================
            if (businessType === "DS") {

                console.log("\n========================================");
                console.log("[DS] 역할별 문자 발송 시작");
                console.log("========================================");

                const sendResults = [];

                for (const target of targets) {

                    console.log("\n========================================");
                    console.log(`[학교] ${target.학교명}`);
                    console.log(`[과정] ${target.과정명}`);
                    console.log(`[교육일] ${target.근무날짜}`);
                    console.log(`[담당교사] ${target.담당교사명} / ${target.담당교사연락처}`);
                    console.log(`[주강사] ${target.주강사표기} / ${target.주강사연락처}`);
                    console.log(`[보조강사] ${target.보조강사표기} / ${target.보조강사연락처}`);


                    // -------------------------------------------------
                    // 4-4-1. 담당교사 템플릿 미리보기
                    // -------------------------------------------------
                    if (target.담당교사연락처) {

                        console.log("\n========================================");
                        console.log("\n[담당교사 SMS 제목]");
                        console.log(TemplateService.createDsTeacherSmsSubject());

                        console.log("\n[담당교사 SMS 본문]");
                        console.log(TemplateService.createDsTeacherSmsBody(target));
                        console.log("\n========================================");
                    }


                    // -------------------------------------------------
                    // 4-4-2. 주강사 템플릿 미리보기
                    // -------------------------------------------------
                    if (target.주강사연락처) {

                        console.log("\n========================================");
                        console.log("\n[주강사 SMS 제목]");
                        console.log(TemplateService.createDsInstructorSmsSubject());

                        console.log("\n[주강사 SMS 본문]");
                        console.log(TemplateService.createDsInstructorSmsBody(target));
                        console.log("\n========================================");                       
                    }


                    // -------------------------------------------------
                    // 4-4-3. 보조강사 템플릿 미리보기
                    // -------------------------------------------------
                    if (target.보조강사연락처) {

                        console.log("\n========================================");                        
                        console.log("\n[보조강사 SMS 제목]");
                        console.log(TemplateService.createDsInstructorSmsSubject());

                        console.log("\n[보조강사 SMS 본문]");
                        console.log(TemplateService.createDsInstructorSmsBody(target));
                        console.log("\n========================================");
                    }


                    // -------------------------------------------------
                    // 4-4-4. 대여 교구 확인 문자 미리보기
                    // -------------------------------------------------
                    if (
                        TemplateService.isRentalEquipmentCourse(target)
                    ) {
                        console.log("\n========================================");
                        console.log("\n[대여 교구 확인 SMS 제목]");
                        console.log(TemplateService.createRentalEquipmentSmsSubject());

                        console.log("\n[대여 교구 확인 SMS 본문]");
                        console.log(TemplateService.createRentalEquipmentSmsBody(target));
                        console.log("\n========================================");

                    } else {
                        console.log("\n[대여 교구 확인 문자] 대상 과정 아님");
                    }


                    // -------------------------------------------------
                    // 4-4-5. 실제 발송
                    // -------------------------------------------------
                    console.log("\n[DS 문자 발송 시작]");
                    console.log(`[수신번호 설정] ${testPhone || "각 역할의 실제 연락처"}`);

                    const result = await NotificationService.sendTarget(
                        target,
                        {
                            testPhone,
                        }
                    );
                    sendResults.push(result);
                }


                // -----------------------------------------------------
                // 4-4-6. DS 최종 발송 결과
                // -----------------------------------------------------
                console.log("\n========================================");
                console.log("[DS 최종 처리 결과]");
                console.log(`처리한 교육 일정: ${sendResults.length}건`);
                console.log("========================================");

                // DS 처리가 끝나면 다음 사업으로 이동
                continue;

            }


            // =====================================================
            // 4-5. GW 사업일 때
            // =====================================================
            if (businessType === "GW") {

                console.log("\n========================================");
                console.log("[GW] 이메일 및 문자 발송 시작");
                console.log("========================================");

                const sendResults = [];


                for (const target of targets) {

                    console.log("\n========================================");
                    console.log(`[강사] ${target.강사이름}`);
                    console.log(`[실제 이메일] ${target.이메일}`);
                    console.log(`[실제 연락처] ${target.연락처}`);

                    // -------------------------------------------------
                    // 4-5-1. 이메일 미리보기
                    // -------------------------------------------------
                    if (target.이메일발송가능) {
                        console.log("\n========================================");
                        console.log("\n[이메일 제목]");
                        console.log(TemplateService.createEmailSubject(target));

                        console.log("\n[이메일 본문]");
                        console.log(TemplateService.createEmailBody(target));
                        console.log("\n========================================");
                    }


                    // -------------------------------------------------
                    // 4-5-2. SMS 미리보기
                    // -------------------------------------------------
                    if (target.문자발송가능) {
                        console.log("\n========================================");
                        console.log("\n[SMS 제목]");
                        console.log(TemplateService.createSmsSubject());

                        console.log("\n[SMS 본문]");
                        console.log(TemplateService.createSmsBody(target));
                        console.log("\n========================================");
                    }


                    // -------------------------------------------------
                    // 4-5-3. 실제 발송 함수 호출
                    // -------------------------------------------------
                    console.log("\n[GW 통합 발송 시작]");

                    const result = await NotificationService.sendTarget(
                        target,
                        {
                            testEmail,
                            testPhone,
                        }
                    );

                    sendResults.push(result);

                }

                // -----------------------------------------------------
                // 4-5-4. GW 최종 발송 결과
                // -----------------------------------------------------
                console.log("\n========================================");
                console.log("[GW 최종 처리 결과]");
                console.log(`처리한 발송 대상: ${sendResults.length}건`);
                console.log("========================================");
            }

        } // 사업별 반복문 종료
    } catch (error) {
        console.error("\n프로그램 실행 실패");
        console.error(error.message);
        console.error(error.stack);
    }
}


main();