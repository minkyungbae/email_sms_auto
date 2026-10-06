const SheetService = require("./Services/SheetService");

async function main() {
    try {
        const targetDate = "2026-10-02";

        console.log(
            `${targetDate} 교육 데이터 조회 시작`
        );

        const rows = await SheetService.getRowsByDate(
            targetDate
        );

        console.log(
            `조회된 데이터: ${rows.length}건`
        );

        console.log(rows);

    } catch (error) {
        console.error("조회 실패");
        console.error(error.message);
    }
}

main();