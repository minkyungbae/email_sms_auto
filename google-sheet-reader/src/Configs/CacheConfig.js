/**
 * @file CacheConfig.js
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 조회 데이터 서버 캐시 및 미리 불러오기 설정
 *
 * 20261126 추가: 데이터 로드 속도 개선
 * - 교육 일정 / 발송 로그 / 수료 실적 조회 결과를 서버 메모리에 보관
 * - 주기적으로 자주 쓰는 데이터를 미리 불러와 화면 진입 시 대기 시간 최소화
 * - 화면의 새로고침 버튼은 캐시를 무시하고 시트를 다시 조회
 * - 발송 자동화(문자·이메일 발송)는 캐시를 사용하지 않고 항상 시트를 직접 조회
 */

const CACHE_CONFIG = {

    // 캐시 보관 시간 (분)
    // 미리 불러오기가 실패했을 때도 이 시간까지는 기존 데이터를 사용
    TTL_MINUTES: 30,

    // 미리 불러오기 주기 (분)
    PREFETCH_INTERVAL_MINUTES: 10,

    // 서버 시작 시 바로 미리 불러오기 실행 여부
    PREFETCH_ON_START: true,

    // 미리 불러오기 실행 시간대 (한국 시간, START 시 이상 ~ END 시 미만)
    // 업무 시간 외에는 Apps Script 호출을 줄이기 위해 실행하지 않음
    PREFETCH_HOURS: {
        START: 7,
        END: 22,
    },

    // 캐시에 보관할 최대 항목 수 (월별 캘린더 이동 등으로 쌓이는 항목 제한)
    MAX_ENTRIES: 100,
};

module.exports = CACHE_CONFIG;
