const SheetService = require("./Services/SheetService");
const GroupService = require("./Services/GroupService");
const NotificationTargetService = require(
    "./Services/NotificationTargetService"
);
const TemplateService = require("./Services/TemplateService");

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

    } catch (error) {
        console.error("프로그램 실행 실패");
        console.error(error.message);
    }
}

main();