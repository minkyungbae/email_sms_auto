/**
 * 동일한 교육 일정을 하나의 그룹으로 묶음
 *
 * 그룹 기준
 * - 지역
 * - 근무유형
 * - 강사이름
 * - 근무날짜
 * - 수요처명
 */
function groupClasses(rows) {
    const groupedMap = new Map();

    rows.forEach(row => {
        const key = createGroupKey(row);

        if (!groupedMap.has(key)) {
            groupedMap.set(key, createGroup(row));
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


/**
 * 동일 교육 일정인지 판단하는 그룹 키
 */
function createGroupKey(row) {
    return [
        row["지역"],
        row["근무유형"],
        row["강사이름"],
        row["근무날짜"],
        row["내용(수요처명)"],
    ].join("|");
}


/**
 * 새로운 교육 일정 그룹 생성
 */
function createGroup(row) {
    return {
        지역: row["지역"],
        월: row["월"],
        강사유형: row["강사유형"],
        강사이름: row["강사이름"],
        강사시급: row["강사시급"],
        근무유형: row["근무유형"],
        수요처명: row["내용(수요처명)"],
        근무날짜: row["근무날짜"],

        연락처: row["연락처"] || "",

        이메일목록: Array.isArray(row["이메일목록"])
            ? row["이메일목록"]
            : [],

        연락처매칭상태:
            row["연락처매칭상태"] || "미매칭",

        교육목록: [],
    };
}


/**
 * 그룹에 연락처 정보 보완
 */
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
        group.연락처매칭상태 =
            row["연락처매칭상태"];
    }
}


/**
 * 근무시간 시작 시간을 분 단위로 변환
 *
 * 예:
 * "09:10~10:40" → 550
 */
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