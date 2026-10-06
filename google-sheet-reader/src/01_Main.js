const SheetService = require("./Services/SheetService");
const GroupService = require("./Services/GroupService");

async function main() {
    try {
        const targetDate = "2026-10-02";

        console.log(`${targetDate} 교육 데이터 조회 시작`);

        const rows = await SheetService.getRowsByDate(targetDate);

        console.log(`조회된 데이터: ${rows.length}건`);

        // 2026-10-06 추가: 여러 행을 그룹화하여 교육 일정 그룹 생성
        const groups = GroupService.groupClasses(rows);
        console.log(`교육 일정 그룹: ${groups.length}건`);

        console.dir(groups, { depth: null });

    } catch (error) {
        console.error("조회 실패");
        console.error(error.message);
    }
}

main();