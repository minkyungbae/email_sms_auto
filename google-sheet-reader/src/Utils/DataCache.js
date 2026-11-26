/**
 * @file DataCache.js
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 조회 데이터 메모리 캐시
 *
 * 20261126 추가: 데이터 로드 속도 개선
 *
 * 주요 기능:
 * - 키별 조회 결과와 조회 시각 보관 (TTL: CacheConfig.TTL_MINUTES)
 * - 같은 키를 동시에 요청하면 Apps Script 요청을 한 번만 보내고 결과 공유
 * - refresh 요청 시 캐시를 무시하고 다시 조회
 * - 캐시 비우기(invalidate) / 캐시 데이터 일부 수정(update)
 * - 캐시를 비운 뒤 늦게 도착한 이전 조회 결과는 저장하지 않음 (세대 번호 비교)
 */

const CACHE_CONFIG = require("../Configs/CacheConfig.js");

const LOG_PREFIX = "[DataCache]";
const TTL_MS = CACHE_CONFIG.TTL_MINUTES * 60 * 1000;

// key -> { value, fetchedAt, generation, promise }
const entries = new Map();


// =============================================================
// 1. 캐시 항목 가져오기 (없으면 생성)
// =============================================================
function getEntry(key) {

    if (!entries.has(key)) {
        entries.set(key, {
            value: undefined,
            fetchedAt: 0,
            generation: 0,
            promise: null,
        });
    }

    return entries.get(key);
}


// =============================================================
// 2. 오래된 항목 정리 (최대 개수 초과 시 오래된 순으로 삭제)
// =============================================================
function pruneEntries() {

    const now = Date.now();

    entries.forEach((entry, key) => {
        if (!entry.promise && entry.fetchedAt && now - entry.fetchedAt > TTL_MS) {
            entries.delete(key);
        }
    });

    if (entries.size <= CACHE_CONFIG.MAX_ENTRIES) {
        return;
    }

    [...entries.entries()]
        .filter(([, entry]) => !entry.promise)
        .sort((first, second) => first[1].fetchedAt - second[1].fetchedAt)
        .slice(0, entries.size - CACHE_CONFIG.MAX_ENTRIES)
        .forEach(([key]) => entries.delete(key));
}


// =============================================================
// 3. 캐시 조회 또는 새로 조회
//
// fetcher : 실제 데이터를 조회하는 async 함수
// refresh : true면 캐시를 무시하고 다시 조회
//
// 반환: { value, fetchedAt(ISO 문자열), cached(캐시 사용 여부) }
// =============================================================
async function getOrFetch(key, fetcher, { refresh = false } = {}) {

    const entry = getEntry(key);
    const now = Date.now();

    // 3-1. 유효한 캐시가 있으면 바로 반환
    if (
        !refresh &&
        entry.value !== undefined &&
        now - entry.fetchedAt < TTL_MS
    ) {
        console.log(`${LOG_PREFIX} 캐시 사용: ${key}`);

        return {
            value: entry.value,
            fetchedAt: new Date(entry.fetchedAt).toISOString(),
            cached: true,
        };
    }

    // 3-2. 같은 키를 이미 조회 중이면 그 결과를 함께 사용
    if (entry.promise) {
        console.log(`${LOG_PREFIX} 진행 중인 조회 공유: ${key}`);
        return entry.promise;
    }

    // 3-3. 새로 조회
    const generation = entry.generation;

    console.log(`${LOG_PREFIX} 새로 조회${refresh ? " (새로고침)" : ""}: ${key}`);

    entry.promise = (async () => {
        try {
            const value = await fetcher();
            const fetchedAt = Date.now();

            // 조회 중에 캐시를 비웠다면 결과를 저장하지 않음
            if (entry.generation === generation) {
                entry.value = value;
                entry.fetchedAt = fetchedAt;
            }

            return {
                value,
                fetchedAt: new Date(fetchedAt).toISOString(),
                cached: false,
            };
        } finally {
            entry.promise = null;
            pruneEntries();
        }
    })();

    return entry.promise;
}


// =============================================================
// 4. 캐시 비우기
// key와 같거나 key로 시작하는 항목을 모두 비움 (예: "logs", "education:GW:")
// =============================================================
function invalidate(keyPrefix) {

    let count = 0;

    entries.forEach((entry, key) => {
        if (key === keyPrefix || key.startsWith(keyPrefix)) {
            entry.value = undefined;
            entry.fetchedAt = 0;
            entry.generation += 1;
            count += 1;
        }
    });

    if (count > 0) {
        console.log(`${LOG_PREFIX} 캐시 비움: ${keyPrefix} (${count}건)`);
    }
}


// =============================================================
// 5. 캐시 데이터 일부 수정
// 다시 조회하지 않고 캐시에 있는 값만 수정 (예: 수동 발송 확인 상태)
// 캐시가 없으면 아무것도 하지 않음
// =============================================================
function update(key, updater) {

    const entry = entries.get(key);

    if (!entry || entry.value === undefined) {
        return false;
    }

    entry.value = updater(entry.value);

    // 진행 중인 조회가 있으면 수정 전 데이터로 덮어쓰지 않도록 저장 생략
    if (entry.promise) {
        entry.generation += 1;
    }

    return true;
}


module.exports = {
    getOrFetch,
    invalidate,
    update,
};
