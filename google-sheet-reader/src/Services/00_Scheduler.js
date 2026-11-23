/**
 * @file 02_Scheduler.js
 * @author 배민경
 * @created 2026-11-23
 * @description
 * 설정된 발송 기준일에 따라 매일 오전 10시 자동 발송 실행
 *
 * 주요 기능:
 * - node-cron을 통한 매일 정기 실행
 * - 한국 시간(Asia/Seoul) 기준 스케줄 관리
 * - Express 발송 API 호출
 * - DAYS_BEFORE 설정 기반 교육일 확인
 * - 중복 실행 및 API 오류 처리
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


// =======================================
// 5. 예약 발송 실행
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
        // 5-1. 발송 설정 조회
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
        const {
            targetDate,
            daysBefore,
            businessTypes,
        } = settingsData.data;

        if (!targetDate) {
            throw new Error("발송 대상 교육일이 설정되지 않았습니다.");
        }

        console.log(`[Scheduler] 실행 사업: ${businessTypes.join(", ")}`);
        console.log(`[Scheduler] 발송 기준: 수업일 ${daysBefore}일 전`);
        console.log(`[Scheduler] 교육일: ${targetDate}`);


        // -----------------------------------
        // 5-2. 발송 자동화 API 호출
        // -----------------------------------
        const dispatchResponse = await fetch(
            `${API_BASE_URL}/api/dispatch/run`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    confirm: true,
                    targetDate,
                }),
            }
        );

        const dispatchData = await parseApiResponse(
            dispatchResponse,
            "발송 실행"
        );


        // -----------------------------------
        // 5-3. 중복 실행 및 요청 오류 확인
        // -----------------------------------
        if (dispatchResponse.status === 409) {

            console.warn(
                `[Scheduler] 발송 실행이 거부되었습니다: ${dispatchData.message}`
            );

            return;
        }

        if (
            !dispatchResponse.ok ||
            dispatchData.success !== true
        ) {
            throw new Error(
                dispatchData.message || "예약 발송 요청에 실패했습니다."
            );
        }


        // -----------------------------------
        // 5-4. 발송 작업 등록 결과
        // -----------------------------------
        const { jobId, status } = dispatchData.data;

        if (!jobId) {
            throw new Error("발송 작업 ID를 확인할 수 없습니다.");
        }

        console.log("[Scheduler] 예약 발송 요청 완료");
        console.log(`[Scheduler] 작업 ID: ${jobId}`);
        console.log(`[Scheduler] 작업 상태: ${status}`);
        console.log(`[Scheduler] 대상 교육일: ${targetDate}`);

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