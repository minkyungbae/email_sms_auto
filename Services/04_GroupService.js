/**
 * 04_GroupService.js
 *
 * 동일 교육 일정 그룹화
 *
 * 그룹 기준
 * - 사업 유형
 * - 센터 Sheet ID
 * - 강사명
 * - 교육 날짜
 * - 수요처명
 *
 * 주요 역할
 * 1. 여러 강사명 분리
 * 2. 동일 교육 일정 그룹화
 * 3. 사업 유형(DS/GW) 보존
 * 4. 그룹별 반명 / 근무시간 중복 제거
 * 5. 이메일 / 전화번호 정보 병합
 * 6. DS 전용 정보 병합
 * 7. 메일 / 문자 발송용 최종 데이터 생성
 */


/**
 * 1. 동일 교육 묶기
 * - 강사명이 "홍길동, 김철수" 또는 "홍길동/김철수"처럼 여러 명으로 들어온 경우 각각 별도의 발송 대상으로 분리
 */
function groupClassesForMail(classes) {

  if (!Array.isArray(classes) || classes.length === 0) {
    return [];
  }

  const groupedMap = Object.create(null);

  classes.forEach(function(item) {

    const instructors = splitInstructors(item.instructorName);

    if (instructors.length === 0) { return; }

    instructors.forEach(function(instructorName) {

      const businessType = normalizeBusinessType(item.businessType || item.type);
      const groupKey = createGroupKey(
        businessType,
        item.sheetId,
        instructorName,
        item.date,
        item.location
      );

      // 1-1. 그룹이 없으면 새로 생성
      if (!groupedMap[groupKey]) {
        groupedMap[groupKey] = createGroup(
          item,
          instructorName,
          businessType
        );
      }

      // 1-2. 기존 그룹에 데이터 병합
      mergeIntoGroup(groupedMap[groupKey], item);
    });
  });

  return Object.keys(groupedMap).map(function(key) {
    return formatGroupedClass(groupedMap[key]);
  });
}


/**
 * 2. 여러 강사명을 개별 강사명으로 분리
 *
 * 지원 형식
 * - 홍길동, 김철수
 * - 홍길동/김철수
 * - 홍길동,김철수
 * - 홍길동 / 김철수
 */
function splitInstructors(rawInstructor) {

  const instructor = String(rawInstructor || "").trim();

  if (!instructor) { return []; }

  return instructor.split(/[,/]+/).map(function(name) { return name.trim(); }).filter(Boolean);
}

/**
 * 3. 그룹 Key 생성
 *
 * 그룹 기준
 * - 사업 유형
 * - 센터 Sheet ID
 * - 강사명
 * - 교육 날짜
 * - 수요처명
 */
function createGroupKey(
  businessType,
  sheetId,
  instructorName,
  date,
  location
) {

  return [
    normalizeGroupValue(businessType),
    normalizeGroupValue(sheetId),
    normalizeGroupValue(instructorName),
    normalizeGroupValue(date),
    normalizeGroupValue(location)
  ].join("||");
}

// -----------------------------------------------------------------
// 4. 그룹 객체 생성
// -----------------------------------------------------------------
function createGroup(item, instructorName, businessType) {
  const normalizedBusinessType = normalizeBusinessType(
    businessType || item.businessType || item.type
  );

  return {
    ids: [],

    // 사업 유형 확인
    businessType: normalizedBusinessType,
    type: normalizedBusinessType,

    sheetId: normalizeGroupValue(item.sheetId),
    date: normalizeGroupValue(item.date),
    instructorName: normalizeGroupValue(instructorName),

    email: item.email || "",
    phone: item.phone || "",
    location: normalizeGroupValue(item.location),

    classNames: [],
    classTimes: [],

    // DS 전용 필드
    courseNames: [],
    studentCounts: [],
    assistantInstructors: []
  };
}

// -----------------------------------------------------------------
// 5. 기존 그룹에 수업 데이터 병합
// -----------------------------------------------------------------
function mergeIntoGroup(group, item) {

  // 5-1. 수업 ID
  if (
    item.id !== undefined &&
    item.id !== null &&
    item.id !== ""
  ) {
    group.ids.push(item.id);
  }

  // 5-2. 이메일
  if (!group.email && item.email) {
    group.email = item.email;
  }

  // 5-3. 전화번호
  if (!group.phone && item.phone) {
    group.phone = item.phone;
  }

  // 5-4. 반명 / 근무시간 중복 제거
  addUniqueValue(group.classNames, item.className);
  addUniqueValue(group.classTimes, item.classTime);

  // 5-5. DS 전용 데이터
  addUniqueValue(group.courseNames, item.courseName); // 수업명
  addUniqueValue(group.studentCounts, item.studentCount); // 학생수
  addUniqueValue(
    // 보조강사명
    group.assistantInstructors,
    item.assistantInstructor
  );
}

// -----------------------------------------------------------------
// 6. 그룹 데이터를 최종 발송 데이터 형태로 변환
// -----------------------------------------------------------------
function formatGroupedClass(group) {

  return {
    ids: group.ids,

    // 6-1. 사업 유형 확인
    businessType: group.businessType,
    type: group.type,

    sheetId: group.sheetId,
    date: group.date,
    instructorName: group.instructorName,

    email: group.email,
    phone: group.phone,
    location: group.location,

    classNames: group.classNames,
    classTimes: group.classTimes,

    // 6-2. DS 전용 데이터
    courseNames: group.courseNames,
    studentCounts: group.studentCounts,
    assistantInstructors: group.assistantInstructors,
    //----------------------------------------------

    courseName: group.courseNames.join(", "),
    studentCount: group.studentCounts.join(", "),
    assistantInstructor: group.assistantInstructors.join(", "),

    className: group.classNames.join(", "),
    classTime: group.classTimes.join(", "),

    id: group.ids.join("+"),

    logKey: [
      group.businessType,
      group.sheetId,
      group.instructorName,
      group.date,
      group.location
    ].join("_")
  };
}

// -----------------------------------------------------------------
// 7. 사업 유형 정규화
// -----------------------------------------------------------------
function normalizeBusinessType(value) {

  const type = String(value || "").trim().toUpperCase();

  if (type === "DS") { return "DS"; }
  return "GW";
}

// -----------------------------------------------------------------
// 8. 그룹 Key에 사용할 값 정규화
// -----------------------------------------------------------------
function normalizeGroupValue(value) {
  return String(value || "").trim();
}

// -----------------------------------------------------------------
// 9. 배열에 중복 없이 값 추가
// -----------------------------------------------------------------
function addUniqueValue(array, value) {

  if (!Array.isArray(array)) { return; }
  const normalized = normalizeGroupValue(value);

  if (!normalized) { return; }

  if (array.indexOf(normalized) === -1) {
    array.push(normalized);
  }
}

module.exports = {
    groupClassesForMail,
    splitInstructors,
    createGroupKey,
    createGroup,
    mergeIntoGroup,
    formatGroupedClass,
    normalizeBusinessType,
    normalizeGroupValue,
    addUniqueValue
};