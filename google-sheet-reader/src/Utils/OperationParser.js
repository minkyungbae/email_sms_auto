/**
 * @file OperationParser.js
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 운영 데이터 시트(2차원 표시 값 배열)를 화면용 데이터로 변환
 *
 * 행·열 번호를 고정하지 않고 헤더 이름으로 표 위치를 찾음
 * (시트에 행/열이 추가되어도 헤더 이름이 같으면 그대로 동작)
 *
 * 대상 시트:
 * - 1.수요처정보_ROW     → parseDemand
 * - 1.운영인력정보_ROW   → parseStaff
 * - 2.강사배정           → parseAssignment
 * - 5.센터_강사비(연간)  → parseFeeAnnual
 * - 6.센터_강사비(지역)  → parseFeeRegion
 * - 7.센터_교구재        → parseMaterials
 */


// =============================================================
// 1. 민감 정보 (Apps Script 에서도 처리하지만 서버에서 한 번 더 제거)
// =============================================================
const REMOVED_FIELDS = ["주민번호", "주민등록번호", "생년월일"];
const MASKED_FIELDS = ["계좌번호"];

function maskAccount(value) {
    return String(value ?? "").replace(/\d(?=(?:\D*\d){4})/g, "*");
}


// =============================================================
// 2. 공통 도우미
// =============================================================

// 비교용: 공백·줄바꿈 제거
function compact(value) {
    return String(value ?? "").replace(/\s+/g, "");
}

// 화면 표시용 헤더: 줄바꿈 제거, 연속 공백 정리
function cleanHeader(value) {
    return String(value ?? "").replace(/\s*\n\s*/g, "").replace(/\s+/g, " ").trim();
}

function cell(grid, row, col) {
    return String(grid[row]?.[col] ?? "").trim();
}

// 텍스트가 정확히 일치하는 셀 위치 목록
function findCells(grid, text) {
    const target = compact(text);
    const found = [];

    grid.forEach((row, rowIndex) => {
        (row ?? []).forEach((value, colIndex) => {
            if (compact(value) === target) found.push({ row: rowIndex, col: colIndex });
        });
    });

    return found;
}

// 모든 헤더 이름이 들어 있는 첫 행 번호
function findHeaderRow(grid, requiredHeaders) {
    const targets = requiredHeaders.map(compact);

    return grid.findIndex((row) => {
        const values = (row ?? []).map(compact);
        return targets.every((target) => values.includes(target));
    });
}

// 헤더 행의 열 구간 읽기 (startCol 부터 빈 칸 전까지)
function readHeaderSpan(grid, row, startCol, endCol = Infinity) {
    const headers = [];

    for (let col = startCol; col < Math.min(endCol, grid[row]?.length ?? 0); col += 1) {
        const header = cleanHeader(grid[row][col]);
        if (!header) break;
        headers.push({ col, header });
    }

    return headers;
}

// 헤더 행 아래 데이터를 객체 배열로 변환
// keyHeader 칸이 비어 있는 행은 제외
function readRecords(grid, headerRow, headers, keyHeader, { stopAtBlank = false } = {}) {
    const keyCol = headers.find((item) => compact(item.header) === compact(keyHeader))?.col;
    const records = [];

    for (let row = headerRow + 1; row < grid.length; row += 1) {
        const key = keyCol === undefined ? "" : cell(grid, row, keyCol);

        if (!key) {
            if (stopAtBlank) break;
            continue;
        }

        records.push(toRecord(grid, row, headers));
    }

    return records;
}

function toRecord(grid, row, headers) {
    const record = { 행: String(row + 1) }; // 시트 행 번호

    headers.forEach(({ col, header }) => {
        if (REMOVED_FIELDS.some((field) => compact(field) === compact(header))) return;

        const value = cell(grid, row, col);

        record[header] = MASKED_FIELDS.some((field) => compact(field) === compact(header))
            ? maskAccount(value)
            : value;
    });

    return record;
}

function publicHeaders(headers) {
    return headers
        .map((item) => item.header)
        .filter((header) => !REMOVED_FIELDS.some((field) => compact(field) === compact(header)));
}

// 목록형 시트 공통 (헤더 1행 + 데이터)
function parseListSheet(grid, requiredHeaders, keyHeader, label) {
    const headerRow = findHeaderRow(grid, requiredHeaders);

    if (headerRow === -1) {
        throw new Error(`${label} 시트에서 헤더(${requiredHeaders.join(", ")})를 찾을 수 없습니다.`);
    }

    const headers = readAllHeaders(grid, headerRow);

    return {
        title: findTitle(grid, headerRow),
        headerRow: headerRow + 1,
        headers: publicHeaders(headers),
        records: readRecords(grid, headerRow, headers, keyHeader),
    };
}

// 헤더 행 전체 (중간 빈 칸 허용)
function readAllHeaders(grid, row) {
    return (grid[row] ?? [])
        .map((value, col) => ({ col, header: cleanHeader(value) }))
        .filter((item) => item.header !== "");
}

// 시트 제목: 헤더 위쪽에서 "[" 로 시작하는 첫 셀
function findTitle(grid, beforeRow) {
    for (let row = 0; row < beforeRow; row += 1) {
        const title = (grid[row] ?? []).map((value) => String(value ?? "").trim()).find((value) => value.startsWith("["));
        if (title) return title;
    }
    return "";
}


// =============================================================
// 3. 1.수요처정보_ROW
// =============================================================
function parseDemand(grid) {
    return parseListSheet(grid, ["수요처명", "반명"], "수요처명", "수요처정보");
}


// =============================================================
// 4. 1.운영인력정보_ROW
// =============================================================
function parseStaff(grid) {
    return parseListSheet(grid, ["성명", "연락처"], "성명", "운영인력정보");
}


// =============================================================
// 5. 2.강사배정
// =============================================================
function parseAssignment(grid) {
    return parseListSheet(grid, ["성명", "수요처명", "교육일"], "성명", "강사배정");
}


// =============================================================
// 6. 5.센터_강사비(연간)
// - 항목별 월 합계 (항목 / 01월 ~ 12월 / 총합계)
// - 예산 현황 (전체인건비 / 사용총액 / 잔액 / 예산대비사용률)
// - 강사별 월 지급 상세 (강의월 / 강사명 ...)
// =============================================================
const BUDGET_LABELS = ["전체인건비 (A)", "사용총액 (B)", "잔액 (A-B)", "예산대비사용률"];

function parseFeeAnnual(grid) {
    // 6-1. 항목별 월 합계
    const itemCell = findCells(grid, "항목")[0];
    let months = [];
    let items = [];
    let notes = [];

    if (itemCell) {
        // 항목 칸이 병합(B:C)이라 바로 오른쪽이 비어 있음 → 첫 월 칸부터 읽기
        const isValueHeader = (header) => /^\d{1,2}월$/.test(compact(header)) || compact(header) === "총합계";
        const firstMonthCol = (grid[itemCell.row] ?? [])
            .findIndex((value, col) => col > itemCell.col && isValueHeader(value));
        const valueHeaders = firstMonthCol === -1
            ? []
            : readHeaderSpan(grid, itemCell.row, firstMonthCol).filter((item) => isValueHeader(item.header));

        months = valueHeaders.map((item) => item.header);

        for (let row = itemCell.row + 1; row < grid.length; row += 1) {
            const label = cell(grid, row, itemCell.col);
            if (!label) break;

            items.push({
                항목: label,
                values: Object.fromEntries(valueHeaders.map(({ col, header }) => [header, cell(grid, row, col)])),
            });
        }

        // 헤더 바로 위 행의 메모 (예: "3월 교육수강비: 진흥원 지급")
        notes = (grid[itemCell.row - 1] ?? []).map((value) => String(value ?? "").trim()).filter(Boolean);
    }

    // 6-2. 예산 현황 (라벨 셀 바로 아래 값)
    const budget = BUDGET_LABELS.map((label) => {
        const position = findCells(grid, label)[0];
        return {
            label,
            value: position ? cell(grid, position.row + 1, position.col) : "",
        };
    });

    // 6-3. 강사별 월 지급 상세
    const detailRow = findHeaderRow(grid, ["강의월", "강사명"]);
    const detailHeaders = detailRow === -1 ? [] : readAllHeaders(grid, detailRow);

    return {
        title: findTitle(grid, itemCell?.row ?? grid.length),
        notes,
        months,
        items,
        budget,
        detail: {
            headers: publicHeaders(detailHeaders),
            records: detailRow === -1 ? [] : readRecords(grid, detailRow, detailHeaders, "강사명"),
        },
    };
}


// =============================================================
// 7. 6.센터_강사비(지역)
// - 지역별 월별 현황 (지역 제목 아래 "해당월 / 강의시간 ..." 표, 지역마다 반복)
// - 지역별 연간 현황 ("년도 / 지역 ..." 표)
// - 월별 지역 현황 ("해당월 / 지역 ..." 표, 월 칸 병합)
// - 지역별 주유비 / 이동비 ("지급월 / 강릉 / 원주 ..." 표)
// =============================================================
// fallbackLabelCol: 첫 칸(월)이 비어 있으면 같은 행의 다른 칸 라벨 사용
function readUntilTotal(grid, headerRow, headers, fallbackLabelCol = null) {
    const labelCol = headers[0].col;
    const rows = [];

    for (let row = headerRow + 1; row < grid.length; row += 1) {
        const label = cell(grid, row, labelCol)
            || (fallbackLabelCol === null ? "" : cell(grid, row, fallbackLabelCol));
        if (!label) break;

        const record = toRecord(grid, row, headers);
        record[headers[0].header] = label;
        rows.push(record);
        if (compact(label) === "합계") break;
    }

    return rows;
}

// 병합된 첫 칸(년도/해당월)을 아래로 채우면서 읽기
function readGroupedRows(grid, headerRow, headers) {
    const [groupHeader, keyHeader] = headers;
    const rows = [];
    let group = "";

    for (let row = headerRow + 1; row < grid.length; row += 1) {
        const key = cell(grid, row, keyHeader.col);
        if (!key) break;

        group = cell(grid, row, groupHeader.col) || group;

        const record = toRecord(grid, row, headers);
        record[groupHeader.header] = group;
        rows.push(record);
    }

    return rows;
}

function parseFeeRegion(grid) {
    // 7-1. 지역별 월별 현황
    const regions = findCells(grid, "해당월")
        .filter(({ row, col }) => compact(cell(grid, row, col + 1)) === "강의시간")
        .map(({ row, col }) => {
            const headers = readHeaderSpan(grid, row, col);
            return {
                region: cell(grid, row - 1, col),
                headers: headers.map((item) => item.header),
                rows: readUntilTotal(grid, row, headers),
            };
        });

    // 7-2. 지역별 연간 현황 / 월별 지역 현황
    const readGroupedTable = (groupLabel) => {
        const position = findCells(grid, groupLabel)
            .find(({ row, col }) => compact(cell(grid, row, col + 1)) === "지역");

        if (!position) return { headers: [], rows: [] };

        const headers = readHeaderSpan(grid, position.row, position.col);
        return {
            headers: headers.map((item) => item.header),
            rows: readGroupedRows(grid, position.row, headers),
        };
    };

    // 7-3. 지역별 주유비 / 이동비
    const paymentCells = findCells(grid, "지급월");
    const paymentTables = paymentCells.map(({ row, col }) => {
        const headers = readHeaderSpan(grid, row, col);
        // 다음 "지급월" 칸 전까지만 사용
        const nextIndex = headers.findIndex((item, index) => index > 0 && compact(item.header) === "지급월");
        const ownHeaders = nextIndex === -1 ? headers : headers.slice(0, nextIndex);

        return {
            title: cell(grid, row - 1, col),
            headers: ownHeaders.map((item) => item.header),
            // 같은 행 왼쪽 표의 월 라벨을 함께 사용 (오른쪽 표의 지급월 칸이 비어 있는 경우)
            rows: readUntilTotal(grid, row, ownHeaders, paymentCells.find((item) => item.row === row)?.col ?? null),
        };
    });

    return {
        title: findTitle(grid, grid.length),
        regions,
        annual: readGroupedTable("년도"),
        monthly: readGroupedTable("해당월"),
        paymentTables,
    };
}


// =============================================================
// 8. 7.센터_교구재
// 한 행에 "교구 보유 현황" / "기자재 보유 현황" 표가 나란히 있음
// =============================================================
function parseMaterials(grid) {
    const headerRow = findHeaderRow(grid, ["지역", "교구재명"]);

    if (headerRow === -1) {
        throw new Error("교구재 시트에서 헤더(지역, 교구재명)를 찾을 수 없습니다.");
    }

    const starts = (grid[headerRow] ?? [])
        .map((value, col) => ({ value: compact(value), col }))
        .filter((item) => item.value === "지역")
        .map((item) => item.col);

    const tables = starts.map((startCol, index) => {
        const endCol = starts[index + 1] ?? Infinity;
        const headers = readHeaderSpan(grid, headerRow, startCol, endCol);

        return {
            title: cell(grid, headerRow - 1, startCol),
            headers: headers.map((item) => item.header),
            records: readRecords(grid, headerRow, headers, "교구재명"),
        };
    });

    return {
        title: findTitle(grid, headerRow),
        tables,
    };
}


module.exports = {
    parseDemand,
    parseStaff,
    parseAssignment,
    parseFeeAnnual,
    parseFeeRegion,
    parseMaterials,
};
