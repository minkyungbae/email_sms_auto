/**
 * @file operationRoutes.js
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 운영 데이터 시트 조회 API 라우터
 *
 * GET /api/operations/:key           : 시트 조회 (서버 캐시, CacheConfig.TTL_MINUTES)
 * GET /api/operations/:key?refresh=1 : 캐시 무시 후 다시 조회
 *
 * key: demand(수요처정보) / staff(운영인력정보) / assignment(강사배정)
 *      fee-annual(센터 강사비 연간) / fee-region(센터 강사비 지역) / materials(센터 교구재)
 */

const express = require("express");
const router = express.Router();

const {
    getOperationData,
} = require("../src/Services/OperationService.js");


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
// 2. 운영 데이터 조회
// =============================================================
router.get("/:key", async (req, res) => {

    try {
        const refresh = ["1", "true"].includes(String(req.query.refresh ?? ""));

        const result = await getOperationData(req.params.key, { refresh });

        return res.json(createResponse(true, result));

    } catch (error) {

        console.error(`[operationRoutes.js] 운영 데이터 조회 실패: ${error.message}`);

        return res.status(error.status === 404 ? 404 : 500).json(
            createResponse(false, null, error.message || "운영 데이터 조회에 실패했습니다.")
        );
    }
});


module.exports = router;
