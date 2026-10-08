/**
 * @file NotificationTargetService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * 사업별 그룹화된 교육 데이터를 기반으로 실제 알림 발송 대상 생성
 * 
 * 주요 기능 :
 * - GW / DS 사업별 발송 대상 생성
 * - GW : 이메일 및 SMS 발송 가능 여부 판별
 * - DS : 교육 일정 단위의 SMS 발송 대상 생성
 * - DS : 담당교사 / 주강사 / 보조강사 중 동일 인물 중복 제거
 */


// 메인
function createTargets(groups, businessType = "GW") {

    const type = String(businessType)
        .trim()
        .toUpperCase();

    if (type === "GW") {
        return groups
            .map(createGwTarget)
            .filter(target => target.발송가능);
    }

    if (type === "DS") {
        return groups
            .map(createDsTarget)
            .filter(target => target.발송가능);
    }
    throw new Error(`지원하지 않는 사업 유형입니다: ${businessType}`);
}


// GW 발송 대상
function createGwTarget(group) {

    const matched = isMatched(group);

    // 이메일 목록 중 첫 번째 이메일만 발송 대상으로 사용
    const primaryEmail =
        Array.isArray(group.이메일목록) &&
        group.이메일목록.length > 0
            ? group.이메일목록[0]
            : "";

    const 이메일발송가능 = matched && primaryEmail !== "";
    const 문자발송가능 = matched && Boolean(group.연락처);
    const 발송채널 = [];

    if (이메일발송가능) {
        발송채널.push("EMAIL");
    }

    if (문자발송가능) {
        발송채널.push("SMS");
    }


    return {

        사업구분: "GW",

        강사이름: group.강사이름,

        연락처: group.연락처,

        이메일: primaryEmail,

        이메일목록:
            Array.isArray(group.이메일목록)
                ? group.이메일목록
                : [],

        연락처매칭상태: group.연락처매칭상태,

        근무날짜: group.근무날짜,

        지역: group.지역,

        근무유형: group.근무유형,

        수요처명: group.수요처명,

        교육목록: group.교육목록,

        이메일발송가능,

        문자발송가능,

        발송채널,

        발송가능: 발송채널.length > 0,
    };
}


// DS 발송 대상
function createDsTarget(group) {

    // 1. 교육 일정의 수신자 목록 생성
    const 수신자목록 = createDsRecipients(group);


    // 2. SMS 발송 가능 여부
    const 문자발송가능 = 수신자목록.length > 0;
    const 발송채널 = 문자발송가능 ? ["SMS"] : [];


    // 3. 최종 Target
    return {

        사업구분: "DS",
        // 교육 정보
        학교명: group.학교명,
        학생수: group.학생수,
        과정명: group.과정명,
        근무날짜: group.근무날짜,
        수업일차: group.수업일차,
        학교주소: group.학교주소,
        교육목록: group.교육목록,


        // 담당교사
        담당교사명: group.담당교사명,
        담당교사연락처: group.담당교사연락처,
        담당교사이메일: group.담당교사이메일,


        // 주강사
        주강사명: group.주강사명,
        주강사연락처: group.주강사연락처,
        주강사학교급: group.주강사학교급,
        주강사구분: group.주강사구분,
        주강사표기: group.주강사표기,


        // 보조강사
        보조강사명: group.보조강사명,
        보조강사연락처: group.보조강사연락처,
        보조강사학교급: group.보조강사학교급,
        보조강사구분: group.보조강사구분,
        보조강사표기: group.보조강사표기,


        // 실제 SMS 수신자
        수신자목록,

        이메일발송가능: false,

        문자발송가능,

        발송채널,

        발송가능:
            발송채널.length > 0,
    };
}


// DS 수신자 목록 생성
function createDsRecipients(group) {

    const recipients = [];

    addDsRecipient(
        recipients,
        "담당교사",
        group.담당교사명,
        group.담당교사연락처
    );

    addDsRecipient(
        recipients,
        "주강사",
        group.주강사명,
        group.주강사연락처
    );

    addDsRecipient(
        recipients,
        "보조강사",
        group.보조강사명,
        group.보조강사연락처
    );

    return recipients;
}


// DS 수신자 추가 및 중복 제거
function addDsRecipient(
    recipients,
    role,
    name,
    phone
) {
    const normalizedName = normalizeValue(name);
    const normalizedPhone = normalizePhone(phone);

    // 이름과 전화번호가 모두 없으면 수신자로 추가하지 않음
    if (
        !normalizedName &&
        !normalizedPhone
    ) {
        return;
    }

    // 동일 인물인지 확인
    //
    // 1순위 : 전화번호
    // 2순위 : 이름
    const existing = recipients.find(recipient => {

        // 전화번호가 둘 다 존재하면 전화번호 비교
        if (
            normalizedPhone &&
            recipient.연락처
        ) {
            return (
                normalizePhone(recipient.연락처) ===
                normalizedPhone
            );
        }

        // 전화번호가 없을 경우 이름 비교
        if (
            normalizedName &&
            recipient.이름
        ) {
            return (
                normalizeValue(recipient.이름) ===
                normalizedName
            );
        }

        return false;
    });

    // 동일 인물이 이미 존재하는 경우 역할만 추가
    if (existing) {
        if (!existing.역할.includes(role)) {
            existing.역할.push(role);
        }
        return;
    }

    // 새로운 수신자
    recipients.push({
        이름: name || "",
        연락처: phone || "",
        역할: [
            role
        ],
    });
}


// 값 정규화
function normalizeValue(value) {

    return String(value || "")
        .trim()
        .replace(/\s+/g, "");

}


// 전화번호 정규화
function normalizePhone(phone) {

    return String(phone || "")
        .replace(/\D/g, "");

}


// GW 연락처 매칭 확인
function isMatched(group) {

    const status = String(group.연락처매칭상태 || "");

    return status.startsWith("매칭(");
}


module.exports = {
    createTargets,
};