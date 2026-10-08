/**
 * @file 01_Main.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * 특정 날짜의 교육 데이터를 조회하여 그룹화, 발송 대상 선정,
 * 템플릿 미리보기 및 통합 알림 발송을 총괄 실행하는 메인 엔트리 파일
 * 
 * 주요 기능 :
 * - SheetService를 통한 지정 날짜 교육 데이터 수집 및 객체화
 * - 사업별(GW/DS) 교육 데이터 조회
 * - GroupService 및 NotificationTargetService를 활용한 일정 그룹화 및 유효 발송 대상 추출
 * - TemplateService를 이용해 발송 대상별 이메일 및 SMS/LMS 발송 문구 미리보기 출력
 * - 테스트 수신 정보(TEST_PERSONAL_INFO) 기반으로 알림 통합 발송 수행 및 결과 확인
 */


const { TEST_PERSONAL_INFO } = require("../../security_info")

const SheetService = require("./Services/SheetService");
const GroupService = require("./Services/GroupService");
const NotificationTargetService = require("./Services/NotificationTargetService");
const NotificationService = require("./Services/NotificationService");
const TemplateService = require("./Services/TemplateService");


// 메인 실행
async function main() {

    try {
        const targetDate = "2026-10-10";

        // 사업 설정
        const businessType = "DS";
        // const businessType = "GW";

        console.log(`\n[${businessType}] ${targetDate} 교육 데이터 조회 시작`);

        // 교육 데이터 조회
        const rows = await SheetService.getRowsByDate(targetDate, businessType);
        console.log(`[${businessType}] 조회된 데이터: ${rows.length}건`);

        // 교육 일정 그룹화
        const groups = GroupService.groupClasses(rows, businessType);
        console.log(`[${businessType}] 교육 일정 그룹: ${groups.length}건`);

        // 발송 대상 생성
        const targets = NotificationTargetService.createTargets(groups, businessType);
        console.log(`[${businessType}] 실제 발송 대상: ${targets.length}건`);
        console.dir(
            targets,
            { depth: null }
        );


        // DS 데이터 확인용 출력
        if (businessType === "DS") {

            for (const target of targets) {
                console.log("\n========================================");
                console.log(`[학교] ${target.학교명}`);
                console.log(`[과정] ${target.과정명}`);
                console.log(`[교육일] ${target.근무날짜}`);
                console.log(`[담당교사] ${target.담당교사명} / ${target.담당교사연락처}`);
                console.log(`[주강사] ${target.주강사표기} / ${target.주강사연락처}`);
                console.log(`[보조강사] ${target.보조강사표기} / ${target.보조강사연락처}`);
                console.log("\n[SMS 수신자 목록]");

                console.dir(
                    target.수신자목록,
                    { depth: null }
                );
                console.log( `발송 채널: ${target.발송채널.join(", ")}`);
                console.log("========================================");
            }
            // 현재는 DS의 Target 생성까지만 테스트
            return;
        }


        // GW 템플릿 미리보기
        for (const target of targets) {
            console.log("\n========================================");
            console.log(`강사: ${target.강사이름}`);
            console.log(`이메일: ${target.이메일}`);
            console.log(`연락처: ${target.연락처}`);

            console.log("\n[이메일 제목]");
            console.log(TemplateService.createEmailSubject(target));
            console.log("\n[이메일 본문]");
            console.log(TemplateService.createEmailBody(target));

            console.log("\n[SMS 제목]");
            console.log(TemplateService.createSmsSubject());
            console.log("\n[SMS 본문]");
            console.log(TemplateService.createSmsBody(target));
            console.log("========================================");
        }

        // GW 실제 발송 테스트
        const target = targets[0];

        if (!target) {
            throw new Error("발송 대상이 없습니다.");
        }

        const testEmail = TEST_PERSONAL_INFO.TEST_EMAIL;
        const testPhone = TEST_PERSONAL_INFO.TEST_PHONE;

        if (!testEmail) {
            throw new Error("테스트용 이메일 주소가 설정되지 않았습니다.");
        }

        if (!testPhone) {
            throw new Error("테스트용 전화번호가 설정되지 않았습니다.");
        }


        // 통합 발송
        console.log("\n===== 통합 발송 테스트 =====");
        console.log("사업:", businessType);
        console.log("강사:", target.강사이름);
        console.log("실제 이메일:", target.이메일);
        console.log("실제 전화번호:", target.연락처);
        console.log("테스트 이메일:", testEmail);
        console.log("테스트 전화번호:", testPhone);
        console.log( "발송 채널:", target.발송채널);

        const result = await NotificationService.sendTarget(
            target,
            {
                testEmail,
                testPhone,
            }
        );

        console.log("\n===== 통합 발송 결과 =====");

        console.dir(
            result,
            { depth: null }
        );
    } catch (error) {
        console.error("프로그램 실행 실패");
        console.error(error.message);
    }
}


main();