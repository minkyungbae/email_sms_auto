const { TEST_PERSONAL_INFO } = require("../../security_info")
const SheetService = require("./Services/SheetService");
const GroupService = require("./Services/GroupService");
const NotificationTargetService = require(
    "./Services/NotificationTargetService"
);
const TemplateService = require("./Services/TemplateService");
const GmailService = require("./Services/GmailService");
const SmsService = require("./Services/SmsService");


// ===============================================================
async function main() {
    try {
        const targetDate = "2026-10-06";
        console.log(`${targetDate} 교육 데이터 조회 시작`);

        const rows = await SheetService.getRowsByDate(targetDate);
        console.log(`조회된 데이터: ${rows.length}건`);

        const groups = GroupService.groupClasses(rows);
        console.log( `교육 일정 그룹: ${groups.length}건`);

        const targets = NotificationTargetService.createTargets(groups);
        console.log(`실제 발송 대상: ${targets.length}건`);

        console.dir(targets, { depth: null });


        // ---------------------------------------------------------
        // 템플릿 미리보기
        // ---------------------------------------------------------

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

        
        /** 실제 발송 테스트 */

        // 첫 번째 대상만 발송 테스트
        const target = targets[0];

        // // 이메일 발송 테스트
        // const subject = TemplateService.createEmailSubject(target);
        // const body = TemplateService.createEmailBody(target);

        // console.log("\n===== 테스트 메일 =====");
        // console.log("테스트 수신자: ", TEST_PERSONAL_INFO.TEST_EMAIL);
        // console.log("원래 수신 대상:", target.이메일);
        // console.log("제목:", subject);

        // const result = await GmailService.sendEmail({
        //     to: TEST_PERSONAL_INFO.TEST_EMAIL,
        //     subject,
        //     text: body,
        // });

        // console.log("테스트 메일 발송 성공");
        // console.log(result);


        // SMS 발송 테스트
        if (!target) {
            throw new Error("SMS 발송 대상이 없습니다.");
        }

        // 테스트용 수신 번호
        const testPhone = TEST_PERSONAL_INFO.TEST_PHONE;

        if(!testPhone) {
            throw new Error("테스트용 수신 번호가 설정되지 않았습니다.");
        }

        console.log("\n===== 테스트 문자 =====");
        console.log("테스트 수신 번호:", TEST_PERSONAL_INFO.TEST_PHONE);
        console.log("강사:", target.강사이름);
        console.log("실제 강사 번호:", target.연락처);

        const message = {
            subject: TemplateService.createSmsSubject(),
            bodyText: TemplateService.createSmsBody(target),
        };

        console.log("문자 제목:", message.subject);
        console.log("문자 본문:");
        console.log(message.bodyText);

        const result = await SmsService.send(
            testPhone,
            message
        );
        console.log("\n===== SMS 테스트 결과 =====");
        console.log(result);

    } catch (error) {
        console.error("프로그램 실행 실패");
        console.error("Gmail 연결 실패");
        console.error("뿌리오 연결 실패");
        console.error(error.message);
    }
}

main();