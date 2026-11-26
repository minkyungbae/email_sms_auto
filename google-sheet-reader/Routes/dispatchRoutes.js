/**
 * @file dispatchRoutes.js
 * @author 배민경
 * @created 2026-11-19
 * @updated 2026-11-26
 * @description
 * 이메일 및 문자 발송 자동화 실행 API 라우터
 *
 * 주요 기능:
 * - 발송 설정 조회
 * - 기존 발송 자동화 프로그램 실행
 * - 발송 작업 상태 조회
 * - 중복 발송 실행 방지
 * 
 * 20261124 추가: 웹에서 발송 기준일 변경 기능 추가
 * 20261125 추가: 발송 로그 화면 개별 발송(선택 수신자 / 직접 입력) API 추가
 *               - 자동 발송과 같은 작업 ID / 상태 조회 / 중복 실행 방지 구조 사용
 * 20261126 추가: 발송 자동화 실행 시 사업(businessType: GW / DS) 지정 가능
 * 20261126 수정: GW / DS 완전 분리
 *               - 발송 기준일 설정을 사업별로 저장 (PATCH body에 businessType 필수)
 *               - 발송 실행은 한 번에 한 사업만 (POST /run body에 businessType 필수)
 */


const { randomUUID } = require("crypto");

const express = require("express");
const router = express.Router();

// 기존 발송 자동화 함수 불러오기
const {
    runDispatch,
    runManualSend, // 20261125 추가: 개별 발송 실행
    getDispatchSettings,
    updateDispatchSettings, // 20261124 추가: 발송 기준일 설정 저장
} = require("../src/01_Main.js");

// 20261125 추가: 개별 발송 요청 검증
const ManualSendService = require("../src/Services/ManualSendService.js");


// =============================================================
// 1. 발송 작업 관리
// =============================================================

// 작업별 실행 상태 관리
const jobs = new Map();

// 현재 실행 중인 작업 ID
let activeJobId = null;


// =============================================================
// 2. 공통 API 응답 생성
// =============================================================
function createResponse(
    success,
    data = null,
    message = null
) {
    return {
        success,
        data,
        message,
    };
}


// =============================================================
// 3. 발송 작업 실행
// =============================================================
// 20261125 수정: 자동 발송(auto) / 개별 발송(manual) 작업 공통 실행
async function executeDispatch(job, runner = runDispatch) {

    // 작업 실행 상태 변경
    job.status = "running";
    job.startedAt = new Date().toISOString();

    console.log("");
    console.log("========================================");
    console.log(`[dispatchRoutes.js] ${job.type === "manual" ? "개별 발송" : "발송 자동화"} 실행`);
    console.log(`작업 ID: ${job.id}`);
    console.log("========================================");

    try {
        // 작업 유형에 맞는 발송 프로그램 실행
        const result = await runner();

        // 실행 성공 결과 저장
        job.status = "succeeded";
        job.result = result;

        console.log(`[dispatchRoutes.js] ${job.type === "manual" ? "개별 발송" : "발송 자동화"} 완료`);
    } catch (error) {

        // 실행 실패 결과 저장
        job.status = "failed";
        job.error = error.message;

        console.error(`[dispatchRoutes.js] ${job.type === "manual" ? "개별 발송" : "발송 자동화"} 실패`);
        console.error(error.message);

    } finally {
        // 작업 종료 시간 기록
        job.completedAt = new Date().toISOString();

        // 실행 잠금 해제
        if (activeJobId === job.id) {
            activeJobId = null;
        }
    }
}


// =============================================================
// 4. 발송 설정 조회 API
//
// GET /api/dispatch/settings
// =============================================================
router.get("/settings", (req, res) => {

    try {
        // 현재 발송 설정 조회
        const settings = getDispatchSettings();

        return res.status(200).json(
            createResponse(
                true,
                settings,
                "발송 설정 조회가 완료되었습니다."
            )
        );
    } catch (error) {

        console.error(
            "[dispatchRoutes.js] 발송 설정 조회 실패:",
            error.message
        );

        return res.status(500).json(
            createResponse(
                false,
                null,
                error.message || "발송 설정을 조회하지 못했습니다."
            )
        );
    }
});


// =============================================================
// 5. 발송 기준일 설정 저장 API
//
// PATCH /api/dispatch/settings
// 20261124 추가
// =============================================================
router.patch("/settings", (req, res) => {

    const { daysBefore, businessType } = req.body || {}; // 20261126 수정: 사업 구분 추가

    // 20261126 추가: 사업 구분 검증
    if (businessType !== "GW" && businessType !== "DS") {
        return res.status(400).json(
            createResponse(
                false,
                null,
                "발송 기준일을 저장할 사업(GW / DS)을 지정해야 합니다."
            )
        );
    }

    // 발송 기준일 입력값 검증
    if (!Number.isInteger(daysBefore) || daysBefore < 0) {
        return res.status(400).json(
            createResponse(
                false,
                null,
                "발송 기준일은 0 이상의 정수로 입력해야 합니다."
            )
        );
    }

    // 발송 진행 중에는 설정 변경 방지
    if (activeJobId) {
        return res.status(409).json(
            createResponse(
                false,
                { jobId: activeJobId },
                "발송 자동화가 진행 중이므로 설정을 변경할 수 없습니다."
            )
        );
    }

    try {
        // 발송 기준일 저장 및 변경된 설정 반환
        const settings = updateDispatchSettings(businessType, daysBefore); // 20261126 수정: 사업별 저장

        return res.status(200).json(
            createResponse(
                true,
                settings,
                "발송 기준일 설정이 저장되었습니다."
            )
        );

    } catch (error) {

        console.error(
            "[dispatchRoutes.js] 발송 기준일 설정 저장 실패:",
            error.message
        );

        return res.status(500).json(
            createResponse(
                false,
                null,
                error.message || "발송 기준일 설정을 저장하지 못했습니다."
            )
        );
    }
});


// =============================================================
// 6. 발송 자동화 실행 API
//
// POST /api/dispatch/run
// =============================================================
router.post("/run", (req, res) => {

    // ---------------------------------------------------------
    // 5-1. 실행 확인 여부 검증
    // ---------------------------------------------------------
    if (req.body?.confirm !== true) {

        return res.status(400).json(
            createResponse(
                false,
                null,
                "발송 실행 확인이 필요합니다."
            )
        );
    }


    // ---------------------------------------------------------
    // 5-2. 중복 실행 방지
    // ---------------------------------------------------------
    if (activeJobId) {

        return res.status(409).json(
            createResponse(
                false,
                {
                    jobId: activeJobId,
                },
                "이미 발송 자동화가 실행 중입니다."
            )
        );
    }


    // ---------------------------------------------------------
    // 5-3. 현재 설정 및 대상 날짜 확인
    // ---------------------------------------------------------
    let settings;

    try {
        settings = getDispatchSettings();

    } catch (error) {

        return res.status(500).json(
            createResponse(
                false,
                null,
                error.message || "발송 설정을 확인하지 못했습니다."
            )
        );
    }

    // ---------------------------------------------------------
    // 5-3-1. 실행 사업 확인
    // 20261126 수정: GW / DS 완전 분리 - 한 번에 한 사업만 실행 (businessType 필수)
    // ---------------------------------------------------------
    const businessType = String(req.body?.businessType || "").trim().toUpperCase();

    if (!settings.businessTypes.includes(businessType)) {
        return res.status(400).json(
            createResponse(
                false,
                settings,
                businessType
                    ? `발송 설정(BUSINESS_TYPE)에 없는 사업입니다: ${businessType}`
                    : "발송할 사업(GW / DS)을 지정해야 합니다."
            )
        );
    }

    const runBusinessTypes = [businessType];
    const businessSettings = settings.businesses[businessType];

    // 화면에서 확인한 교육일과 현재 사업 설정 비교
    if (req.body?.targetDate !== businessSettings.targetDate) {

        return res.status(409).json(
            createResponse(
                false,
                settings,
                "발송 대상 교육일이 변경되었습니다. 설정을 다시 확인해 주세요."
            )
        );
    }


    // ---------------------------------------------------------
    // 5-4. 발송 작업 생성
    // ---------------------------------------------------------
    const jobId = randomUUID();

    const job = {
        id: jobId,
        type: "auto", // 20261125 추가: 작업 유형
        status: "queued",
        settings: { // 20261126 수정: 실제 실행 사업 설정만 기록
            businessType,
            businessTypes: runBusinessTypes,
            daysBefore: businessSettings.daysBefore,
            targetDate: businessSettings.targetDate,
            modes: settings.modes,
        },
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
    };

    // 작업 정보 저장 및 실행 잠금
    jobs.set(jobId, job);
    activeJobId = jobId;


    // ---------------------------------------------------------
    // 5-5. 발송 자동화 비동기 실행
    // ---------------------------------------------------------
    // 20261126 수정: 요청한 사업만 실행
    setImmediate(() => {
        void executeDispatch(job, () => runDispatch({ businessTypes: runBusinessTypes }));
    });

    console.log(`[dispatchRoutes.js] 발송 작업 등록: ${jobId} (${runBusinessTypes.join(", ")})`);

    // 작업 ID를 먼저 반환
    return res.status(202).json(
        createResponse(
            true,
            {
                jobId,
                status: job.status,
                settings: job.settings,
            },
            "발송 자동화가 시작되었습니다."
        )
    );
});


// =============================================================
// 7. 개별 발송 실행 API
//
// POST /api/dispatch/manual-send
// 20261125 추가
//
// Request Body:
// {
//   "confirm": true,
//   "messages": [
//     {
//       "sourceLogId": "원본 로그 ID(선택)",
//       "businessType": "GW" | "DS",
//       "recipient": { "name", "role", "phone", "email", "affiliation" },
//       "education": { "교육과정명", "교육기관명", "반명", "교육일", "요일", "교육시간" },
//       "sms":   { "enabled": true, "subject": "", "body": "" },
//       "email": { "enabled": true, "subject": "", "body": "" }
//     }
//   ]
// }
// =============================================================
router.post("/manual-send", (req, res) => {

    // ---------------------------------------------------------
    // 7-1. 실행 확인 여부 검증
    // ---------------------------------------------------------
    if (req.body?.confirm !== true) {
        return res.status(400).json(
            createResponse(false, null, "개별 발송 실행 확인이 필요합니다.")
        );
    }

    // ---------------------------------------------------------
    // 7-2. 중복 실행 방지 (자동 발송과 동일 잠금 사용)
    // ---------------------------------------------------------
    if (activeJobId) {
        return res.status(409).json(
            createResponse(
                false,
                { jobId: activeJobId },
                "다른 발송 작업이 진행 중입니다. 완료 후 다시 시도해 주세요."
            )
        );
    }

    // ---------------------------------------------------------
    // 7-3. 발송 요청 데이터 검증
    // ---------------------------------------------------------
    let messages;

    try {
        messages = ManualSendService.normalizeManualMessages(req.body?.messages);

    } catch (error) {
        return res.status(400).json(
            createResponse(false, null, error.message)
        );
    }

    // ---------------------------------------------------------
    // 7-4. 개별 발송 작업 생성 및 비동기 실행
    // ---------------------------------------------------------
    const jobId = randomUUID();

    const job = {
        id: jobId,
        type: "manual",
        status: "queued",
        settings: null,
        result: null,
        error: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
    };

    jobs.set(jobId, job);
    activeJobId = jobId;

    setImmediate(() => {
        void executeDispatch(job, () => runManualSend(messages));
    });

    console.log(`[dispatchRoutes.js] 개별 발송 작업 등록: ${jobId} (${messages.length}명)`);

    return res.status(202).json(
        createResponse(
            true,
            {
                jobId,
                type: job.type,
                status: job.status,
                total: messages.length,
            },
            "개별 발송이 시작되었습니다."
        )
    );
});


// =============================================================
// 8. 발송 작업 상태 조회 API
//
// GET /api/dispatch/status/:jobId
// =============================================================
router.get("/status/:jobId", (req, res) => {

    const { jobId } = req.params;

    // 작업 존재 여부 확인
    const job = jobs.get(jobId);

    if (!job) {

        return res.status(404).json(
            createResponse(
                false,
                null,
                "해당 발송 작업을 찾을 수 없습니다."
            )
        );
    }

    // 작업 상태 반환
    return res.status(200).json(
        createResponse(
            true,
            {
                jobId: job.id,
                type: job.type, // 20261125 추가: auto / manual
                status: job.status,
                settings: job.settings,
                result: job.result,
                error: job.error,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                completedAt: job.completedAt,
            },
            "발송 작업 상태 조회가 완료되었습니다."
        )
    );
});


module.exports = router;
