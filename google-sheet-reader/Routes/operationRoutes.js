/**
 * @file operationRoutes.js
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-27
 * @description
 * 운영 데이터 시트 조회 API 라우터
 *
 * GET /api/operations/:key           : 시트 조회 (서버 캐시, CacheConfig.TTL_MINUTES)
 * GET /api/operations/:key?refresh=1 : 캐시 무시 후 다시 조회
 * PATCH /api/operations/mbo/progress/:row : MBO 진행현황 수정 (20261127 추가)
 *   body: { name: 성과지표 이름(행 확인용), status?: 완료/미진행 등, note?: 진행현황 메모, actual?: 진행실적 숫자 }
 *
 * key: demand(수요처정보) / staff(운영인력정보) / assignment(강사배정)
 *      fee-annual(센터 강사비 연간) / fee-region(센터 강사비 지역) / materials(센터 교구재)
 *      mbo(MBO, 20261127 추가)
 */

const express = require("express");
const router = express.Router();

const {
    getOperationData,
    updateMboProgress, // 20261127 추가
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


// =============================================================
// 3. MBO 진행현황 수정 (20261127 추가)
// =============================================================
const MAX_NOTE_LENGTH = 5000;
const MAX_STATUS_LENGTH = 50;

router.patch("/mbo/progress/:row", async (req, res) => {

    const row = Number(req.params.row);
    const { name, status, note, actual } = req.body || {};

    // 3-1. 요청 데이터 검증
    if (!Number.isInteger(row) || row < 1) {
        return res.status(400).json(createResponse(false, null, "행 번호가 올바르지 않습니다."));
    }

    if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json(createResponse(false, null, "성과지표 이름이 필요합니다."));
    }

    if (status === undefined && note === undefined && actual === undefined) {
        return res.status(400).json(createResponse(false, null, "수정할 진행현황이 없습니다."));
    }

    if (status !== undefined && (typeof status !== "string" || status.length > MAX_STATUS_LENGTH)) {
        return res.status(400).json(createResponse(false, null, "진행현황(상태) 값이 올바르지 않습니다."));
    }

    if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) {
        return res.status(400).json(createResponse(false, null, `진행현황 메모는 ${MAX_NOTE_LENGTH}자 이내로 입력해 주세요.`));
    }

    // 20261127 추가: 진행실적은 0 이상 숫자 (쉼표 허용)
    const actualNumber = actual === undefined ? undefined : Number(String(actual).replace(/,/g, "").trim());

    if (actual !== undefined && (String(actual).trim() === "" || !Number.isFinite(actualNumber) || actualNumber < 0)) {
        return res.status(400).json(createResponse(false, null, "진행실적은 0 이상의 숫자로 입력해 주세요."));
    }

    // 3-2. 시트 저장
    try {
        const result = await updateMboProgress({ row, name: name.trim(), status, note, actual: actualNumber });
        return res.json(createResponse(true, result, "진행현황을 시트에 저장했습니다."));

    } catch (error) {

        console.error(`[operationRoutes.js] MBO 진행현황 저장 실패: ${error.message}`);

        return res.status(500).json(
            createResponse(false, null, error.message || "MBO 진행현황 저장에 실패했습니다.")
        );
    }
});


module.exports = router;
