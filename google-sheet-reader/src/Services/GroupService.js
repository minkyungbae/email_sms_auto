/**
 * @file GroupService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-12
 * @description
 * 사업별 교육 데이터를 발송 기준에 맞게 그룹화하고 교육 시작 시간 순으로 정렬
 * 
 * 주요 기능 :
 * - GW / DS 사업별 교육 데이터 그룹화
 * - GW : 기존 그룹화 기준 유지
 * - DS : 학교 / 과정 / 담당교사 / 주강사 / 보조강사 구성이 같은 일정끼리 그룹화
 * - DS : 동일 학교에서 동일 강사진으로 진행하는 여러 날짜의 일정을 하나로 구성
 * - DS : 학교 또는 강사진 구성이 다르면 별도 그룹으로 유지
 */


// 메인 그룹화
function groupClasses(rows, businessType = "GW") {
    const type = String(businessType).trim().toUpperCase();

    if (!Array.isArray(rows)) {
        throw new Error("그룹화할 데이터가 배열 형태가 아닙니다.");
    }

    if (type === "GW") {
        return groupGwClasses(rows);
    }

    if (type === "DS") {
        return groupDsClasses(rows);
    }

    throw new Error(`지원하지 않는 사업 유형입니다: ${businessType}`);
}


// =============================================================
// GW 그룹화
// 기존 기준 유지
// =============================================================
function groupGwClasses(rows) {
    const groupedMap = new Map();

    rows.forEach(row => {
        const key = createGwGroupKey(row);

        if (!groupedMap.has(key)) {
            groupedMap.set(key, createGwGroup(row));
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

            return getStartMinutes(a.근무시간) - getStartMinutes(b.근무시간);
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
        이메일목록: Array.isArray(row["이메일목록"]) ? row["이메일목록"] : [],
        연락처매칭상태: row["연락처매칭상태"] || "미매칭",
        교육목록: [],
    };
}


// GW 연락처 정보 보완
function updateContactInfo(group, row) {
    if (!group.연락처 && row["연락처"]) {
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


// =============================================================
// DS 그룹화
//
// 그룹화 기준:
// - 학교명 + 과정명 + 담당교사 + 주강사 + 보조강사
// - 근무날짜는 그룹 키에서 제외
// - 동일 학교/과정/강사진으로 여러 날짜 수업 시 한 그룹에 누적
// - 학교나 강사진 구성이 달라지면 별도 그룹 생성
// =============================================================
function groupDsClasses(rows) {
    const groupedMap = new Map();

    rows.forEach(row => {
        const key = createDsGroupKey(row);

        if (!groupedMap.has(key)) {
            groupedMap.set(key, createDsGroup(row));
        }

        const group = groupedMap.get(key);

        addUniqueValue(group.근무날짜목록, row["근무날짜"]);
        addUniqueValue(group.수업일차목록, row["수업일차"]);
        addDsEducationItem(group, row);
    });

    const groups = Array.from(groupedMap.values());

    groups.forEach(group => {

        // 날짜순 정렬 후, 같은 날짜 안에서는 시작 시간순 정렬
        group.교육목록.sort((a, b) => {
            const dateDifference = getDateSortValue(a.근무날짜) - getDateSortValue(b.근무날짜);

            if (dateDifference !== 0) {
                return dateDifference;
            }

            return getStartMinutes(a.근무시간) - getStartMinutes(b.근무시간);
        });

        // 문자 템플릿에서 사용할 날짜/수업일차 표시 문자열
        group.근무날짜 = group.근무날짜목록
            .map(formatDsDate)
            .join(", ");

        group.수업일차 = group.수업일차목록.join(", ");
    });

    return groups;
}


// DS 그룹 키: 날짜 제외, 역할 배정 조합 포함
function createDsGroupKey(row) {
    return JSON.stringify([
        normalizeGroupValue(row["학교명"]),
        normalizeGroupValue(row["과정명"]),
        createPersonKey(row["담당교사명"], row["담당교사연락처"]),
        createPersonKey(row["주강사명"], row["주강사연락처"]),
        createPersonKey(row["보조강사명"], row["보조강사연락처"]),
    ]);
}


// DS 그룹 생성
function createDsGroup(row) {
    return {
        사업구분: "DS",

        // 교육 정보
        학교명: row["학교명"],
        학생수: row["학생수"],
        과정명: row["과정명"],
        근무날짜: "",
        근무날짜목록: [],
        수업일차: "",
        수업일차목록: [],
        학교주소: row["학교주소"],

        // 담당교사
        담당교사명: row["담당교사명"],
        담당교사연락처: row["담당교사연락처"],
        담당교사이메일: row["담당교사이메일"],

        // 주강사
        주강사명: row["주강사명"],
        주강사연락처: row["주강사연락처"],
        주강사학교급: row["주강사학교급"],
        주강사구분: row["주강사구분"],
        주강사표기: row["주강사표기"],

        // 보조강사
        보조강사명: row["보조강사명"],
        보조강사연락처: row["보조강사연락처"],
        보조강사학교급: row["보조강사학교급"],
        보조강사구분: row["보조강사구분"],
        보조강사표기: row["보조강사표기"],

        교육목록: [],
    };
}


// DS 교육 일정 항목 추가
function addDsEducationItem(group, row) {
    const item = {
        근무날짜: row["근무날짜"] || "",
        수업일차: row["수업일차"] || "",
        근무시간: row["시간"] || "",
        수업차시: row["수업차시"] || "",
    };

    // 동일한 일정 데이터 중복 방지
    const itemKey = JSON.stringify(item);
    const alreadyExists = group.교육목록.some(existing => {
        return JSON.stringify(existing) === itemKey;
    });

    if (!alreadyExists) {
        group.교육목록.push(item);
    }
}


// 배열에 값 중복 없이 추가
function addUniqueValue(array, value) {
    const normalized = String(value ?? "").trim();

    if (!normalized) return;

    if (!array.some(item => String(item).trim() === normalized)) {
        array.push(value);
    }
}


// 인물 식별 키: 연락처 우선, 연락처가 없으면 이름 사용
function createPersonKey(name, phone) {
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone) {
        return `PHONE:${normalizedPhone}`;
    }

    const normalizedName = normalizeGroupValue(name);
    return normalizedName ? `NAME:${normalizedName}` : "";
}


// 그룹 키 비교용 문자열 정규화
function normalizeGroupValue(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, "");
}


// 전화번호 정규화
function normalizePhone(phone) {
    return String(phone ?? "").replace(/\D/g, "");
}


// DS 날짜 표시: YYYY-MM-DD → M월 D일, 그 외 형식은 원본 유지
function formatDsDate(date) {
    const value = String(date ?? "").trim();
    const match = value.match(/^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})$/);

    if (match) {
        return `${Number(match[2])}월 ${Number(match[3])}일`;
    }

    return value;
}


// 날짜 정렬용 숫자 반환
function getDateSortValue(date) {
    const value = String(date ?? "").trim();
    let match = value.match(/^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})$/);

    if (match) {
        const [, year, month, day] = match;

        return Number(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`);
    }

    match = value.match(/^(\d{1,2})[-./]\s*(\d{1,2})$/);

    if (match) {
        const [, month, day] = match;
        const year = new Date().getFullYear();
        return Number(
            `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`
        );
    }
    match = value.match(/^(\d{1,2})월\s*(\d{1,2})일$/);

    if (match) {
        const [, month, day] = match;
        const year = new Date().getFullYear();

        return Number(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`);
    }

    return Number.MAX_SAFE_INTEGER;
}


// 공통 시간 처리
function getStartMinutes(timeRange) {
    const match = String(timeRange ?? "").match(/(\d{1,2}):(\d{2})/);

    if (!match) {
        return Number.MAX_SAFE_INTEGER;
    }

    return Number(match[1]) * 60 + Number(match[2]);
}


module.exports = {
    groupClasses,
};