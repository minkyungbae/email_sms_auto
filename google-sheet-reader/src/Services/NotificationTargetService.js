/**
 * 교육 일정 그룹을 실제 발송 대상으로 변환
 *
 * 역할
 * - 연락처 매칭 상태 확인
 * - 이메일 발송 가능 여부 판단
 * - 문자 발송 가능 여부 판단
 * - 실제 발송 채널 결정
 */
function createTargets(groups) {
    return groups
        .map(createTarget)
        .filter(target => target.발송가능);
}


/**
 * 그룹 1개를 발송 대상으로 변환
 */
function createTarget(group) {
    const matched = isMatched(group);

    const 이메일발송가능 =
        matched &&
        Array.isArray(group.이메일목록) &&
        group.이메일목록.length > 0;

    const 문자발송가능 =
        matched &&
        Boolean(group.연락처);

    const 발송채널 = [];

    if (이메일발송가능) {
        발송채널.push("EMAIL");
    }

    if (문자발송가능) {
        발송채널.push("SMS");
    }

    return {
        강사이름: group.강사이름,

        연락처: group.연락처,

        이메일목록: Array.isArray(group.이메일목록)
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


/**
 * 연락처 매칭이 정상적으로 완료되었는지 확인
 *
 * 예:
 * 매칭(성명)
 * 매칭(지역+성명)
 * → 정상
 *
 * 미매칭
 * 중복
 * → 발송 제외
 */
function isMatched(group) {
    const status = String(
        group.연락처매칭상태 || ""
    );

    return status.startsWith("매칭(");
}


module.exports = {
    createTargets,
};