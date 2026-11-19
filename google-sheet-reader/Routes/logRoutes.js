/**
 * @file logRoutes.js
 * @author 배민경
 * @created 2026-11-19
 * @description
 * Google Sheets 발송 로그 조회 API 라우터
 *
 * 주요 기능:
 * - Apps Script 발송 로그 조회 요청
 * - 서버 설정의 인증 토큰 및 스프레드시트 ID 사용
 * - API 응답 형식 통일
 * - 요청 시간 초과 및 오류 처리
 */

const express = require("express");
const router = express.Router();

const SHEET_CONFIG = require("../src/Configs/SheetConfig.js");


// =============================================================
// 1. 로그 API 설정
// =============================================================
const LOG_CONFIG = SHEET_CONFIG.LOG;
const REQUEST_TIMEOUT_MS = 120000;


// =============================================================
// 2. 공통 API 응답 생성
// =============================================================
function createResponse(
    success,
    data = null,
    message = null,
    count = null
) {
    return {
        success,
        data,
        message,
        ...(count !== null ? { count } : {}),
    };
}


// =============================================================
// 3. Apps Script 응답 JSON 파싱
// =============================================================
async function parseAppsScriptResponse(response) {

    const responseText = await response.text();

    try {
        return JSON.parse(responseText);
    } catch (error) {
        throw new Error(`Apps Script 응답을 JSON으로 변환할 수 없습니다. HTTP ${response.status}`);
    }
}


// =============================================================
// 4. 발송 로그 조회 API
//
// GET /api/logs
// =============================================================
router.get("/", async (req, res) => {

    // ---------------------------------------------------------
    // 4-1. 서버 설정 확인
    // ---------------------------------------------------------
    const url = LOG_CONFIG?.APPS_SCRIPT_URL;
    const token = LOG_CONFIG?.TOKEN;
    const spreadsheetId = LOG_CONFIG?.SPREADSHEET?.ID;

    if (!url) {
        return res.status(500).json(
            createResponse(false, null, "로그 Apps Script URL이 설정되지 않았습니다.")
        );
    }

    if (!token) {
        return res.status(500).json(
            createResponse(false, null, "로그 API 인증키가 설정되지 않았습니다.")
        );
    }

    if (!spreadsheetId) {
        return res.status(500).json(
            createResponse(false, null, "로그 스프레드시트 ID가 설정되지 않았습니다.")
        );
    }

    if (typeof fetch !== "function") {
        return res.status(500).json(
            createResponse(false, null, "현재 Node.js 환경에서 fetch를 사용할 수 없습니다.")
        );
    }


    // ---------------------------------------------------------
    // 4-2. Apps Script 조회 요청
    // 기존 AppendLogs()와 동일한 URL / 인증 설정 사용
    // ---------------------------------------------------------
    const controller = new AbortController();
    const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
    );

    try {
        console.log("");
        console.log("[logRoutes.js] 발송 로그 조회 시작");

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                action: "read",
                token,
                spreadsheetId,
            }),
            redirect: "follow",
            signal: controller.signal,
        });

        const responseData = await parseAppsScriptResponse(response);

        if (!response.ok || !responseData.success) {
            throw new Error(
                responseData.message || `Apps Script 로그 조회 실패: HTTP ${response.status}`
            );
        }

        if (!Array.isArray(responseData.data)) {
            throw new Error("Apps Script 응답의 data가 배열 형태가 아닙니다.");
        }

        console.log(`[logRoutes.js] 발송 로그 조회 완료: ${responseData.data.length}건`);

        return res.status(200).json(
            createResponse(
                true,
                responseData.data,
                responseData.message || "발송 로그 조회가 완료되었습니다.",
                responseData.data.length
            )
        );
    } catch (error) {

        console.error("");
        console.error("[logRoutes.js] 발송 로그 조회 실패");
        console.error("오류 내용:", error.message);

        if (error.name === "AbortError") {
            return res.status(504).json(
                createResponse(false, null, "발송 로그 조회 시간이 초과되었습니다.")
            );
        }

        return res.status(502).json(
            createResponse(
                false,
                null,
                error.message || "발송 로그 조회 중 오류가 발생했습니다."
            )
        );
    } finally {
        clearTimeout(timeoutId);
    }
});


module.exports = router;