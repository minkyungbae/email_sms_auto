/**
 * @file GroupService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * 사업별 교육 데이터를 일정 기준으로 그룹화하고 시작 시간 순으로 정렬
 * 
 * 주요 기능 :
 * - GW / DS 사업별 교육 데이터 그룹화
 * - 동일 일정의 교육 데이터를 하나의 그룹으로 묶음
 * - 그룹 내 세부 교육 목록 구성
 * - 교육 시작 시간 기준 오름차순 정렬
 */


// 메인 그룹화
function groupClasses(rows, businessType = "GW") {

    const type = String(businessType)
        .trim()
        .toUpperCase();

    if (type === "GW") {
        return groupGwClasses(rows);
    }

    if (type === "DS") {
        return groupDsClasses(rows);
    }
    throw new Error(`지원하지 않는 사업 유형입니다: ${businessType}`);
}


// GW 그룹화
function groupGwClasses(rows) {

    const groupedMap = new Map();

    rows.forEach(row => {

        const key = createGwGroupKey(row);

        if (!groupedMap.has(key)) {
            groupedMap.set(
                key,
                createGwGroup(row)
            );
        }
        const group = groupedMap.get(key);

        group.교육목록.push({
            반명: row["반명"],
            근무시간: row["근무시간"],
        });
        updateContactInfo(group, row);
    });


    const groups = Array.from(groupedMap.values());

    groups.forEach(group => {

        group.교육목록.sort((a, b) => {

            return (
                getStartMinutes(a.근무시간) -
                getStartMinutes(b.근무시간)
            );
        });
    });
    return groups;
}


// GW 그룹 키
function createGwGroupKey(row) {

    return [
        row["지역"],
        row["근무유형"],
        row["강사이름"],
        row["근무날짜"],
        row["내용(수요처명)"],
    ].join("|");
}


// GW 그룹 생성
function createGwGroup(row) {

    return {
        사업구분: "GW",
        지역: row["지역"],
        월: row["월"],
        강사유형: row["강사유형"],
        강사이름: row["강사이름"],
        강사시급: row["강사시급"],
        근무유형: row["근무유형"],
        수요처명: row["내용(수요처명)"],
        근무날짜: row["근무날짜"],
        연락처: row["연락처"] || "",
        이메일목록:
            Array.isArray(row["이메일목록"])
                ? row["이메일목록"]
                : [],
        연락처매칭상태: row["연락처매칭상태"] || "미매칭",
        교육목록: [],
    };
}


// GW 연락처 정보 보완
function updateContactInfo(group, row) {

    if (
        !group.연락처 &&
        row["연락처"]
    ) {
        group.연락처 = row["연락처"];
    }

    if (
        group.이메일목록.length === 0 &&
        Array.isArray(row["이메일목록"]) &&
        row["이메일목록"].length > 0
    ) {
        group.이메일목록 = row["이메일목록"];
    }

    if (
        group.연락처매칭상태 === "미매칭" &&
        row["연락처매칭상태"] &&
        row["연락처매칭상태"] !== "미매칭"
    ) {
        group.연락처매칭상태 = row["연락처매칭상태"];
    }
}


// ===============================================================
// DS 그룹화
// ===============================================================
function groupDsClasses(rows) {

    const groupedMap = new Map();

    rows.forEach(row => {

        const key = createDsGroupKey(row);

        if (!groupedMap.has(key)) {

            groupedMap.set(
                key,
                createDsGroup(row)
            );
        }
        const group = groupedMap.get(key);

        group.교육목록.push({
            수업일차: row["수업일차"],
            근무시간: row["시간"],
            수업차시: row["수업차시"],
        });
    });

    const groups = Array.from(groupedMap.values());

    groups.forEach(group => {

        group.교육목록.sort((a, b) => {

            return (
                getStartMinutes(a.근무시간) -
                getStartMinutes(b.근무시간)
            );
        });
    });

    return groups;
}


// DS 그룹 키
function createDsGroupKey(row) {
    return [
        row["학교명"],
        row["근무날짜"],
        row["과정명"],
    ].join("|");
}


// DS 그룹 생성
function createDsGroup(row) {

    return {
        사업구분: "DS",
        학교명: row["학교명"],
        학생수: row["학생수"],
        과정명: row["과정명"],

        담당교사명: row["담당교사명"],
        담당교사연락처: row["담당교사연락처"],
        담당교사이메일: row["담당교사이메일"],

        주강사명: row["주강사명"],
        주강사연락처: row["주강사연락처"],
        주강사학교급: row["주강사학교급"],
        주강사구분: row["주강사구분"],
        주강사표기: row["주강사표기"],

        보조강사명: row["보조강사명"],
        보조강사연락처: row["보조강사연락처"],
        보조강사학교급: row["보조강사학교급"],
        보조강사구분: row["보조강사구분"],
        보조강사표기: row["보조강사표기"],

        근무날짜: row["근무날짜"],
        수업일차: row["수업일차"],
        학교주소: row["학교주소"],
        
        교육목록: [],
    };
}

// 시간 → 분
function getStartMinutes(timeRange) {

    const startTime = String(timeRange)
        .split("~")[0]
        .trim();

    const [hour, minute] = startTime
        .split(":")
        .map(Number);

    return hour * 60 + minute;
}


module.exports = {
    groupClasses,
};