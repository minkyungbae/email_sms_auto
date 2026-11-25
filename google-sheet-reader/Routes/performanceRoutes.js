/**
 * @file performanceRoutes.js
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 교육 실적 현황(수료실적_RAW) 조회 API 라우터
 *
 * GET /api/performance           : 수료 실적 전체 조회 (1분 캐시)
 * GET /api/performance?refresh=1 : 캐시 무시 후 다시 조회
 */

const express = require("express");
const router = express.Router();

const {
    getPerformanceRecords,
} = require("../src/Services/PerformanceService.js");


// =============================================================
// 1. 공통 API 응답 생성
// =============================================================
function createResponse(success, data = null, message = null) {
    return {
        success,
        data,
        message,
    };
}


// =============================================================
// 2. 수료 실적 조회 API
// =============================================================
router.get("/", async (req, res) => {

    try {
        const refresh = ["1", "true"].includes(String(req.query.refresh ?? ""));

        const result = await getPerformanceRecords({ refresh });

        return res.json(createResponse(true, result));

    } catch (error) {

        console.error(`[performanceRoutes.js] 수료 실적 조회 실패: ${error.message}`);

        return res.status(500).json(
            createResponse(false, null, error.message || "수료 실적 조회에 실패했습니다.")
        );
    }
});


module.exports = router;
