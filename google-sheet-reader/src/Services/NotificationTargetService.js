/**
 * @file NotificationTargetService.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * 그룹화된 교육 데이터를 기반으로 연락처 매칭 상태 및 수신 정보 유무를 검증하여 실제 알림 발송 대상 생성
 * 
 * 주요 기능 :
 * - 연락처 매칭 상태 검증을 통한 발송 대상 부적합 데이터(미매칭, 중복 등) 필터링
 * - 그룹 데이터에서 첫 번째 항목 이메일 및 대표 연락처 추출
 * - 수신 수단 유무 및 매칭 결과에 따른 채널별 발송 가능 여부 판별
 * - 최종 발송 가능 채널이 1개 이상 존재하는 유효 발송 대상 목록 생성
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
        강사이름: group.강사이름,

        연락처: group.연락처,

        이메일: primaryEmail,

        이메일목록: Array.isArray(group.이메일목록) ? group.이메일목록 : [],

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
    const status = String(group.연락처매칭상태 || "");

    return status.startsWith("매칭(");
}


module.exports = {
    createTargets,
};