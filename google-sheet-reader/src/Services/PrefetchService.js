/**
 * @file PrefetchService.js
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 자주 조회하는 데이터를 주기적으로 미리 불러와 서버 캐시에 저장
 *
 * 20261126 추가: 데이터 로드 속도 개선
 *
 * 미리 불러오는 데이터 (한국 시간 기준):
 * - GW / DS 이번 달 교육 일정 (월별 캘린더 첫 화면)
 * - GW 최근 30일 교육 일정 (사업 소개 지표)
 * - 발송 로그 (교육 안내 발송)
 * - 수료 실적 (교육 실적 현황)
 *
 * 실행 주기: CacheConfig.PREFETCH_INTERVAL_MINUTES
 * 실행 시간대: CacheConfig.PREFETCH_HOURS (업무 시간 외 실행 안 함)
 */

const CACHE_CONFIG = require("../Configs/CacheConfig.js");
const {
    getEducationRange,
    getLogRecords,
} = require("./DataQueryService.js");
const {
    getPerformanceRecords,
} = require("./PerformanceService.js");

const LOG_PREFIX = "[PrefetchService]";

let intervalId = null;
let isRunning = false;


// =============================================================
// 1. 한국 시간 기준 날짜 계산
// =============================================================
function getKoreaToday() {

    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date());

    const value = {};

    parts.forEach((part) => {
        if (part.type !== "literal") value[part.type] = Number(part.value);
    });

    return value; // { year, month(1~12), day, hour }
}

function formatDate(year, monthIndex, day) {

    const date = new Date(Date.UTC(year, monthIndex, day));

    return date.toISOString().slice(0, 10);
}


// =============================================================
// 2. 미리 불러올 조회 목록
// 화면에서 요청하는 날짜 범위와 같아야 캐시가 사용됨
// - 월별 캘린더: 해당 월 1일 ~ 말일
// - 사업 소개: 오늘 포함 최근 30일 (오늘 - 29일 ~ 오늘)
// =============================================================
function getPrefetchTasks() {

    const today = getKoreaToday();
    const monthIndex = today.month - 1;

    const monthStart = formatDate(today.year, monthIndex, 1);
    const monthEnd = formatDate(today.year, monthIndex + 1, 0);

    const recentStart = formatDate(today.year, monthIndex, today.day - 29);
    const recentEnd = formatDate(today.year, monthIndex, today.day);

    return [
        {
            name: `GW 이번 달 교육 일정 (${monthStart} ~ ${monthEnd})`,
            run: () => getEducationRange("GW", monthStart, monthEnd, { refresh: true }),
        },
        {
            name: `DS 이번 달 교육 일정 (${monthStart} ~ ${monthEnd})`,
            run: () => getEducationRange("DS", monthStart, monthEnd, { refresh: true }),
        },
        {
            name: `GW 최근 30일 교육 일정 (${recentStart} ~ ${recentEnd})`,
            run: () => getEducationRange("GW", recentStart, recentEnd, { refresh: true }),
        },
        {
            name: "발송 로그",
            run: () => getLogRecords({ refresh: true }),
        },
        {
            name: "수료 실적",
            run: () => getPerformanceRecords({ refresh: true }),
        },
    ];
}


// =============================================================
// 3. 미리 불러오기 실행
// 한 항목이 실패해도 나머지는 계속 실행
// =============================================================
async function runPrefetch({ force = false } = {}) {

    if (isRunning) {
        console.warn(`${LOG_PREFIX} 이전 미리 불러오기가 아직 진행 중입니다.`);
        return;
    }

    const { hour } = getKoreaToday();
    const { START, END } = CACHE_CONFIG.PREFETCH_HOURS;

    if (!force && (hour < START || hour >= END)) {
        return;
    }

    isRunning = true;
    const startedAt = Date.now();

    try {
        const tasks = getPrefetchTasks();

        const results = await Promise.allSettled(
            tasks.map((task) => task.run())
        );

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                console.warn(`${LOG_PREFIX} 실패: ${tasks[index].name} - ${result.reason?.message || result.reason}`);
            }
        });

        const successCount = results.filter((result) => result.status === "fulfilled").length;

        console.log(
            `${LOG_PREFIX} 완료: ${successCount}/${tasks.length}건 (${Date.now() - startedAt}ms)`
        );

    } finally {
        isRunning = false;
    }
}


// =============================================================
// 4. 주기 실행 시작
// =============================================================
function startPrefetch() {

    if (intervalId) {
        return;
    }

    const intervalMs = CACHE_CONFIG.PREFETCH_INTERVAL_MINUTES * 60 * 1000;

    console.log(
        `${LOG_PREFIX} 미리 불러오기 시작: ${CACHE_CONFIG.PREFETCH_INTERVAL_MINUTES}분마다 ` +
        `(${CACHE_CONFIG.PREFETCH_HOURS.START}시~${CACHE_CONFIG.PREFETCH_HOURS.END}시), ` +
        `캐시 보관 ${CACHE_CONFIG.TTL_MINUTES}분`
    );

    if (CACHE_CONFIG.PREFETCH_ON_START) {
        // 서버 시작 직후에는 시간대와 관계없이 한 번 실행
        void runPrefetch({ force: true });
    }

    intervalId = setInterval(() => {
        void runPrefetch();
    }, intervalMs);

    // 미리 불러오기 때문에 프로세스 종료가 막히지 않도록 설정
    if (typeof intervalId.unref === "function") {
        intervalId.unref();
    }
}


module.exports = {
    startPrefetch,
    runPrefetch,
};
