/**
 * @file 02_Scheduler.js
 * @author 배민경
 * @created 2026-11-23
 * @updated 2026-11-26
 * @description
 * 설정된 발송 기준일에 따라 매일 오전 10시 자동 발송 실행
 *
 * 주요 기능:
 * - node-cron을 통한 매일 정기 실행
 * - 한국 시간(Asia/Seoul) 기준 스케줄 관리
 * - Express 발송 API 호출
 * - DAYS_BEFORE 설정 기반 교육일 확인
 * - 중복 실행 및 API 오류 처리
 *
 * 20261126 수정: GW / DS 완전 분리
 * - 사업별 발송 기준일로 각각 대상 교육일 계산
 * - 사업마다 별도 발송 작업으로 순서대로 실행 (앞 사업 작업 완료 후 다음 사업 실행)
 * - 한 사업 실패해도 다음 사업은 계속 실행
 */


// =======================================
// 1. 모듈 불러오기
// =======================================
const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../../.env"),
});

const cron = require("node-cron");


// =======================================
// 2. 스케줄 설정
// =======================================

// 매일 오전 10시 실행
const CRON_EXPRESSION = "0 10 * * *";

// 한국 시간 기준
const TIMEZONE = "Asia/Seoul";

// Express API 서버 주소
const API_BASE_URL = (
    process.env.DISPATCH_API_BASE_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
).replace(/\/+$/, "");


// =======================================
// 3. 실행 상태 관리
// =======================================

// 스케줄러 중복 등록 방지
let dailyTask = null;

// 스케줄러 내부 요청 중복 방지
let isDispatchRequesting = false;


// =======================================
// 4. API 응답 JSON 처리
// =======================================
async function parseApiResponse(response, apiName) {

    try {
        return await response.json();

    } catch (error) {
        throw new Error(
            `${apiName} API 응답을 JSON으로 변환하지 못했습니다.`
        );
    }
}


// 20261126 추가: 사업별 작업 완료 대기 설정
const JOB_POLL_INTERVAL_MS = 3000;
const JOB_WAIT_TIMEOUT_MS = 60 * 60 * 1000; // 최대 1시간

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


// =======================================
// 5-1. 발송 작업 완료 대기
// 20261126 추가: 다음 사업 실행 전 이전 사업 작업 완료 확인
// =======================================
async function waitForJob(jobId) {

    const startedAt = Date.now();

    while (Date.now() - startedAt < JOB_WAIT_TIMEOUT_MS) {

        await wait(JOB_POLL_INTERVAL_MS);

        const response = await fetch(
            `${API_BASE_URL}/api/dispatch/status/${encodeURIComponent(jobId)}`
        );

        const data = await parseApiResponse(response, "발송 상태 조회");

        if (!response.ok || data.success !== true || !data.data) {
            throw new Error(data.message || "발송 작업 상태 조회에 실패했습니다.");
        }

        const { status, result, error } = data.data;

        if (status === "succeeded") return result;
        if (status === "failed") throw new Error(error || "발송 작업이 실패했습니다.");
    }

    throw new Error("발송 작업 완료 대기 시간이 초과되었습니다.");
}


// =======================================
// 5-2. 사업 한 곳 예약 발송 실행
// 20261126 추가
// =======================================
async function requestBusinessDispatch(businessType, businessSettings) {

    const { targetDate, daysBefore } = businessSettings || {};

    if (!targetDate) {
        throw new Error(`[${businessType}] 발송 대상 교육일이 설정되지 않았습니다.`);
    }

    console.log(`[Scheduler][${businessType}] 발송 기준: 수업일 ${daysBefore}일 전`);
    console.log(`[Scheduler][${businessType}] 교육일: ${targetDate}`);

    const dispatchResponse = await fetch(
        `${API_BASE_URL}/api/dispatch/run`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                confirm: true,
                businessType,
                targetDate,
            }),
        }
    );

    const dispatchData = await parseApiResponse(
        dispatchResponse,
        "발송 실행"
    );

    // 중복 실행 및 요청 오류 확인
    if (dispatchResponse.status === 409) {
        throw new Error(`발송 실행이 거부되었습니다: ${dispatchData.message}`);
    }

    if (!dispatchResponse.ok || dispatchData.success !== true) {
        throw new Error(dispatchData.message || "예약 발송 요청에 실패했습니다.");
    }

    const { jobId } = dispatchData.data || {};

    if (!jobId) {
        throw new Error("발송 작업 ID를 확인할 수 없습니다.");
    }

    console.log(`[Scheduler][${businessType}] 작업 등록: ${jobId}`);

    const result = await waitForJob(jobId);

    console.log(
        `[Scheduler][${businessType}] 발송 완료 · 로그 ${result?.logCount ?? 0}건`
    );
}


// =======================================
// 5. 예약 발송 실행
// 20261126 수정: 사업별로 분리하여 순서대로 실행
// =======================================
async function requestScheduledDispatch() {

    // 중복 요청 방지
    if (isDispatchRequesting) {
        console.warn("[Scheduler] 발송 요청이 이미 진행 중입니다.");
        return;
    }

    isDispatchRequesting = true;

    try {
        console.log("");
        console.log("=======================================");
        console.log("[Scheduler] 예약 발송 실행");
        console.log("=======================================");

        // -----------------------------------
        // 5-3. 발송 설정 조회
        // -----------------------------------
        const settingsResponse = await fetch(
            `${API_BASE_URL}/api/dispatch/settings`
        );

        const settingsData = await parseApiResponse(
            settingsResponse,
            "발송 설정 조회"
        );

        if (
            !settingsResponse.ok ||
            settingsData.success !== true ||
            !settingsData.data
        ) {
            throw new Error(
                settingsData.message || "발송 설정 조회에 실패했습니다."
            );
        }

        const { businessTypes, businesses } = settingsData.data;

        console.log(`[Scheduler] 실행 사업: ${businessTypes.join(", ")}`);

        // -----------------------------------
        // 5-4. 사업별 발송 (한 사업 실패해도 다음 사업 진행)
        // -----------------------------------
        for (const businessType of businessTypes) {
            try {
                await requestBusinessDispatch(businessType, businesses?.[businessType]);

            } catch (error) {
                console.error(`[Scheduler][${businessType}] 예약 발송 실패`);
                console.error(error.message);
            }
        }

    } catch (error) {

        console.error("[Scheduler] 예약 발송 실패");
        console.error(error.message);

    } finally {

        // 요청 상태 초기화
        isDispatchRequesting = false;

        console.log("=======================================\n");
    }
}


// =======================================
// 6. 매일 오전 10시 스케줄 등록
// =======================================
function createDailySchedule() {

    // 이미 등록된 스케줄이 있다면 재사용
    if (dailyTask) {
        console.warn("[Scheduler] 이미 스케줄이 등록되어 있습니다.");
        return dailyTask;
    }

    dailyTask = cron.schedule(
        CRON_EXPRESSION,
        () => {
            void requestScheduledDispatch();
        },
        {
            scheduled: true,
            timezone: TIMEZONE,
        }
    );

    console.log("");
    console.log("=======================================");
    console.log("[Scheduler] 자동 발송 스케줄 등록 완료");
    console.log("실행 주기: 매일");
    console.log("실행 시간: 오전 10시");
    console.log("시간대: Asia/Seoul");
    console.log(`API 서버: ${API_BASE_URL}`);
    console.log("=======================================");
    console.log("");

    return dailyTask;
}


module.exports = {
    createDailySchedule,
};