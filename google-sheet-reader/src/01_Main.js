const SheetService = require("./Services/SheetService");
const GroupService = require("./Services/GroupService");
const NotificationTargetService = require(
    "./Services/NotificationTargetService"
);

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

    } catch (error) {
        console.error("프로그램 실행 실패");
        console.error(error.message);
    }
}

main();