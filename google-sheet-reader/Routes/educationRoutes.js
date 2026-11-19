/**
 * @file educationRoutes.js
 * @author 배민경
 * @created 2026-11-18
 * @description
 * GW·DS 교육 데이터 조회 API 라우터
 *
 * 주요 기능:
 * - 사업 유형 검증
 * - 특정 날짜 교육 데이터 조회
 * - 날짜 범위 교육 데이터 조회
 * - API 응답 형식 통일
 */

const express = require("express");
const router = express.Router();

const {
    getRowsByDate,
    getRowsByDateRange,
} = require("../src/Services/SheetService.js");


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

            data = await getRowsByDate(
                date,
                businessType
            );
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

            data = await getRowsByDateRange(
                startDate,
                endDate,
                businessType
            );
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
        console.log(`[educationRoutes.js] API: ${businessType} 조회 완료: ${data.length}건`);

        return res.status(200).json(
            createResponse(
                true,
                data,
                null
            )
        );
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
