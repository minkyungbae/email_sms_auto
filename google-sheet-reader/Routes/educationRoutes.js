/**
 * @file educationRoutes.js
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-26
 * @description
 * GW·DS 교육 데이터 조회 API 라우터
 *
 * 주요 기능:
 * - 사업 유형 검증
 * - 특정 날짜 교육 데이터 조회
 * - 날짜 범위 교육 데이터 조회
 * - API 응답 형식 통일
 *
 * 20261126 추가: 서버 캐시 적용 (DataQueryService)
 * - ?refresh=1 이면 캐시를 무시하고 시트를 다시 조회
 * - 응답에 meta.fetchedAt(데이터 조회 시각), meta.cached(캐시 사용 여부) 추가
 */

const express = require("express");
const router = express.Router();

// 20261126 수정: SheetService 직접 호출 → 캐시 적용 조회 서비스 사용
const {
    getEducationDate,
    getEducationRange,
} = require("../src/Services/DataQueryService.js");


// =============================================================
// 1. 사업 유형 검증
// =============================================================
const BUSINESS_TYPES = ["GW", "DS"];


// =============================================================
// 2. 날짜 유효성 검사
// =============================================================
function isValidIsoDate(value) {

    if (typeof value !== "string") {
        return false;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}


// =============================================================
// 3. 공통 API 응답 생성
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
// 4. 교육 데이터 조회 API
//
// GET /api/education/:businessType
//
// 단건 조회:
// /api/education/GW?date=2026-11-18
//
// 기간 조회:
// /api/education/GW?startDate=2026-11-01&endDate=2026-11-30
// =============================================================
router.get("/:businessType", async (req, res) => {

    const businessType = String(req.params.businessType)
        .trim()
        .toUpperCase();

    const {
        date,
        startDate,
        endDate,
    } = req.query;

    // 20261126 추가: 새로고침 요청 여부 (캐시 무시)
    const refresh = ["1", "true"].includes(String(req.query.refresh ?? ""));


    // ---------------------------------------------------------
    // 4-1. 사업 유형 검증
    // ---------------------------------------------------------
    if (!BUSINESS_TYPES.includes(businessType)) {

        return res.status(400).json(
            createResponse(
                false,
                null,
                `지원하지 않는 사업 유형입니다: ${businessType}`
            )
        );
    }

    // ---------------------------------------------------------
    // 4-2. 조회 유형 검증
    // ---------------------------------------------------------
    const hasDate = date !== undefined;
    const hasStartDate = startDate !== undefined;
    const hasEndDate = endDate !== undefined;

    if (hasDate && (hasStartDate || hasEndDate)) {

        return res.status(400).json(
            createResponse(
                false,
                null,
                "특정 날짜 조회와 날짜 범위 조회를 동시에 사용할 수 없습니다."
            )
        );
    }


    try {

        let data = [];
        let meta = null; // 20261126 추가: { fetchedAt, cached }

        // =====================================================
        // 5. 특정 날짜 조회
        // =====================================================
        if (hasDate) {

            if (!isValidIsoDate(date)) {

                return res.status(400).json(
                    createResponse(
                        false,
                        null,
                        "조회 날짜 형식이 올바르지 않습니다."
                    )
                );
            }

            console.log("");
            console.log("========================================");
            console.log(`[educationRoutes.js] API: ${businessType} 특정 날짜 조회`);
            console.log(`조회 날짜: ${date}`);
            console.log("========================================");

            // 20261126 수정: 캐시 적용
            const result = await getEducationDate(businessType, date, { refresh });

            data = result.value;
            meta = { fetchedAt: result.fetchedAt, cached: result.cached };
        }


        // =====================================================
        // 6. 날짜 범위 조회
        // =====================================================
        else if (hasStartDate || hasEndDate) {

            if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {

                return res.status(400).json(
                    createResponse(
                        false,
                        null,
                        "시작 날짜와 종료 날짜를 YYYY-MM-DD 형식으로 모두 입력해야 합니다."
                    )
                );
            }

            if (startDate > endDate) {

                return res.status(400).json(
                    createResponse(
                        false,
                        null,
                        "시작 날짜가 종료 날짜보다 늦을 수 없습니다."
                    )
                );
            }

            console.log("");
            console.log("========================================");
            console.log(`[educationRoutes.js] API: ${businessType} 날짜 범위 조회`);
            console.log(`조회 기간: ${startDate} ~ ${endDate}`);
            console.log("========================================");

            // 20261126 수정: 캐시 적용
            const result = await getEducationRange(businessType, startDate, endDate, { refresh });

            data = result.value;
            meta = { fetchedAt: result.fetchedAt, cached: result.cached };
        }


        // =====================================================
        // 7. 조회 조건 누락
        // =====================================================
        else {
            return res.status(400).json(
                createResponse(
                    false,
                    null,
                    "조회할 날짜 또는 날짜 범위를 입력해 주세요."
                )
            );
        }


        // =====================================================
        // 8. 조회 성공 응답
        // =====================================================
        console.log(`[educationRoutes.js] API: ${businessType} 조회 완료: ${data.length}건${meta?.cached ? " (캐시)" : ""}`);

        return res.status(200).json({
            ...createResponse(
                true,
                data,
                null
            ),
            meta, // 20261126 추가
        });
    } catch (error) {

        // =====================================================
        // 9. 조회 실패 처리
        // =====================================================
        console.error("");
        console.error("========================================");
        console.error(`[educationRoutes.js] API: ${businessType} 교육 데이터 조회 실패`);
        console.error("오류 내용:", error.message);
        console.error("========================================");

        return res.status(502).json(
            createResponse(
                false,
                null,
                error.message || "교육 데이터 조회 중 오류가 발생했습니다."
            )
        );
    }
});


module.exports = router;
