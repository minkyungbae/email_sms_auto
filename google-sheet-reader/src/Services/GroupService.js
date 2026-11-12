/**
 * @file GroupService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-11-12
 * @description
 * 사업별 교육 데이터를 발송 기준에 맞게 그룹화하고 정렬
 * 
 * 주요 기능:
 * - GW / DS 사업별 교육 데이터 그룹화
 * - GW: 지역, 근무유형, 강사, 근무날짜, 수요처 기준 그룹화
 * - DS: 학교, 과정, 담당교사, 주강사, 보조강사 기준 그룹화
 * - DS: 동일 조건의 여러 날짜 교육 일정 통합
 * - 교육 일정 중복 제거 및 날짜·시간순 정렬
 */


// =============================================================
// 1. 메인 그룹화
// 사업 유형에 따라 교육 데이터를 그룹화
// =============================================================
function groupClasses(rows, businessType = "GW") {
    const type = String(businessType).trim().toUpperCase();

    if (!Array.isArray(rows)) {
        throw new Error("그룹화할 데이터가 배열 형태가 아닙니다.");
    }

    switch (type) {
        case "GW":
            return groupGwClasses(rows);

        case "DS":
            return groupDsClasses(rows);

        default:
            throw new Error(`지원하지 않는 사업 유형입니다: ${businessType}`);
    }
}


// =============================================================
// 2. GW 그룹화
// 그룹화 기준:
// - 지역 + 근무유형 + 강사 + 근무날짜 + 수요처명
// - 동일 조건의 교육 일정은 한 그룹에 누적
// - 연락처 및 이메일 정보는 그룹 내에서 보완
// =============================================================
function groupGwClasses(rows) {
    const groupedMap = new Map();

    rows.forEach(row => {
        const key = createGwGroupKey(row);

        if (!groupedMap.has(key)) {
            groupedMap.set(key, createGwGroup(row));
        }

        const group = groupedMap.get(key);

        // 교육 일정 누적
        group.교육목록.push({
            반명: row["반명"],
            근무시간: row["근무시간"],
        });

        // 연락처 및 이메일 정보 보완
        updateContactInfo(group, row);
    });

    const groups = Array.from(groupedMap.values());

    // 교육 시작 시간순 정렬
    groups.forEach(group => {
        group.교육목록.sort((a, b) => {
            return getStartMinutes(a.근무시간) - getStartMinutes(b.근무시간);
        });
    });

    return groups;
}


// GW 그룹 식별 키 생성
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


// GW 그룹의 연락처 정보 보완
// 최초 그룹 생성 시 정보가 누락된 경우 이후 동일 그룹 데이터에서 연락처 정보를 보완
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
// 3. DS - 디지털새싹 그룹화
//
// 그룹화 기준:
// - 학교명 + 과정명 + 담당교사 + 주강사 + 보조강사
//
// 처리 방식:
// - 근무날짜는 그룹 키에서 제외
// - 동일 조건의 여러 날짜 교육 일정을 하나로 통합
// - 학교 또는 강사진 구성이 다르면 별도 그룹 생성
// =============================================================
function groupDsClasses(rows) {
    const groupedMap = new Map();

    rows.forEach(row => {
        const key = createDsGroupKey(row);

        if (!groupedMap.has(key)) {
            groupedMap.set(key, createDsGroup(row));
        }

        const group = groupedMap.get(key);

        // 교육 날짜 및 수업일차 누적
        addUniqueValue(group.근무날짜목록, row["근무날짜"]);
        addUniqueValue(group.수업일차목록, row["수업일차"]);

        // 교육 일정 추가
        addDsEducationItem(group, row);
    });

    const groups = Array.from(groupedMap.values());

    groups.forEach(group => {

        // 날짜순 정렬 후 동일 날짜 내 시작 시간순 정렬
        group.교육목록.sort((a, b) => {
            const dateDifference = 
                getDateSortValue(a.근무날짜) - getDateSortValue(b.근무날짜);

            if (dateDifference !== 0) {
                return dateDifference;
            }

            return getStartMinutes(a.근무시간) - getStartMinutes(b.근무시간);
        });

        // 메시지 템플릿에서 사용할 날짜 문자열
        group.근무날짜 = group.근무날짜목록
            .map(formatDsDate)
            .join(", ");

        // 메시지 템플릿에서 사용할 수업일차 문자열
        group.수업일차 = group.수업일차목록.join(", ");
    });

    return groups;
}


// DS 그룹 식별 키 생성: 전화번호가 있으면 전화번호 우선, 없으면 이름을 기준으로 인물 식별
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

        // -----------------------------------------------------
        // 교육 정보
        LMS번호반: row["LMS번호반"] || "", // 20261112 추가: DS 반명 필드 우선순위 변경
        학교명: row["학교명"],
        학생수: row["학생수"],
        과정명: row["과정명"],

        근무날짜: "",
        근무날짜목록: [],

        수업일차: "",
        수업일차목록: [],

        학교주소: row["학교주소"],

        // -----------------------------------------------------
        // 담당교사
        담당교사명: row["담당교사명"],
        담당교사연락처: row["담당교사연락처"],
        담당교사이메일: row["담당교사이메일"],

        // -----------------------------------------------------
        // 주강사
        주강사명: row["주강사명"],
        주강사연락처: row["주강사연락처"],
        주강사학교명: row["주강사학교명"], // 20261112 추가: DS 주강사 학교명
        주강사학교급: row["주강사학교급"],
        주강사구분: row["주강사구분"],
        주강사표기: row["주강사표기"],

        // -----------------------------------------------------
        // 보조강사
        보조강사명: row["보조강사명"],
        보조강사연락처: row["보조강사연락처"],
        보조강사학교명: row["보조강사학교명"], // 20261112 추가: DS 보조강사 학교명
        보조강사학교급: row["보조강사학교급"],
        보조강사구분: row["보조강사구분"],
        보조강사표기: row["보조강사표기"],

        // -----------------------------------------------------
        // 교육 일정
        교육목록: [],
    };
}


// DS 교육 일정 항목 추가: 동일한 일정 데이터의 중복 추가 방지
function addDsEducationItem(group, row) {
    const item = {
        근무날짜: row["근무날짜"] || "",
        수업일차: row["수업일차"] || "",
        근무시간: row["시간"] || "",
        수업차시: row["수업차시"] || "",
    };

    const itemKey = JSON.stringify(item);

    const alreadyExists = group.교육목록.some(existing => {
        return JSON.stringify(existing) === itemKey;
    });

    if (!alreadyExists) {
        group.교육목록.push(item);
    }
}


// =============================================================
// 4. 공통 데이터 처리
// =============================================================

// 배열에 값 중복 없이 추가
function addUniqueValue(array, value) {
    const normalized = String(value ?? "").trim();

    if (!normalized) return;

    if (!array.some(item => String(item).trim() === normalized)) {
        array.push(value);
    }
}


// 인물 식별 키 생성: 연락처 우선, 연락처가 없으면 이름 사용
function createPersonKey(name, phone) {
    const normalizedPhone = normalizePhone(phone);

    if (normalizedPhone) {
        return `PHONE:${normalizedPhone}`;
    }

    const normalizedName = normalizeGroupValue(name);

    return normalizedName ? `NAME:${normalizedName}` : "";
}


// 그룹 키 비교용 문자열 정규화: 문자열 변환, 앞뒤 공백 제거, 문자열 내부 공백 제거
function normalizeGroupValue(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, "");
}


// 전화번호 정규화: 숫자 이외의 문자 제거
function normalizePhone(phone) {
    return String(phone ?? "").replace(/\D/g, "");
}


// =============================================================
// 5. 날짜 처리
// =============================================================

// DS 날짜 표시 형식 변환: YYYY-MM-DD → M월 D일, 그 외 형식은 원본 유지
function formatDsDate(date) {
    const value = String(date ?? "").trim();

    const match = value.match(/^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})$/);

    if (match) {
        return `${Number(match[2])}월 ${Number(match[3])}일`;
    }

    return value;
}


// 날짜 정렬용 숫자 반환
// 지원 형식:
// - YYYY-MM-DD
// - YYYY.MM.DD
// - YYYY/MM/DD
// - MM-DD
// - MM.DD
// - MM/DD
// - M월 D일
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

        return Number(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`);
    }

    match = value.match(/^(\d{1,2})월\s*(\d{1,2})일$/);

    if (match) {
        const [, month, day] = match;
        const year = new Date().getFullYear();

        return Number(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`);
    }

    return Number.MAX_SAFE_INTEGER;
}


// =============================================================
// 6. 시간 처리
// =============================================================

// 교육 시작 시간을 분 단위 숫자로 변환: 예: 09:30~11:00 → 570 (시간 형식을 확인할 수 없으면 가장 큰 값 반환)
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