const SheetService = require("./Services/SheetService.js");

async function main() {
    try {
        console.log("Google Sheet 데이터 조회 시작");

        const row = await SheetService.getOneRow();

        console.log("조회 성공");
        console.log(row);

    } catch (error) {
        console.error("조회 실패");
        console.error(error.message);
    }
}

main();