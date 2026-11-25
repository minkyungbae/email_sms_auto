/**
 * @file dispatchRoutes.js
 * @author 배민경
 * @created 2026-11-19
 * @updated 2026-11-24
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
 */


const { randomUUID } = require("crypto");

const express = require("express");
const router = express.Router();

// 기존 발송 자동화 함수 불러오기
const {
    runDispatch,
    getDispatchSettings,
    updateDispatchSettings, // 20261124 추가: 발송 기준일 설정 저장
} = require("../src/01_Main.js");


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
async function executeDispatch(job) {

    // 작업 실행 상태 변경
    job.status = "running";
    job.startedAt = new Date().toISOString();

    console.log("");
    console.log("========================================");
    console.log("[dispatchRoutes.js] 발송 자동화 실행");
    console.log(`작업 ID: ${job.id}`);
    console.log("========================================");

    try {
        // 기존 자동화 프로그램 실행
        const result = await runDispatch();

        // 실행 성공 결과 저장
        job.status = "succeeded";
        job.result = result;

        console.log("[dispatchRoutes.js] 발송 자동화 완료");
    } catch (error) {

        // 실행 실패 결과 저장
        job.status = "failed";
        job.error = error.message;

        console.error("[dispatchRoutes.js] 발송 자동화 실패");
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

    const { daysBefore } = req.body || {};

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
        const settings = updateDispatchSettings(daysBefore);

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

    // 화면에서 확인한 교육일과 현재 설정 비교
    if (req.body?.targetDate !== settings.targetDate) {

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
        status: "queued",
        settings,
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
    setImmediate(() => {
        void executeDispatch(job);
    });

    console.log(`[dispatchRoutes.js] 발송 작업 등록: ${jobId}`);

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
// 6. 발송 작업 상태 조회 API
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
