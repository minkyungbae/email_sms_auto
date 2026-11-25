/**
 * @file server.js
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-24
 * @description
 * Node.js Express 서버 실행 및 관리
 *
 * 주요 기능:
 * - Express 서버 생성
 * - CORS 설정
 * - 교육 데이터 API 라우터 연결
 * - 서버 상태 확인 API
 * - 공통 오류 처리
 * - 20261124 수정: 발송 로그 수동 확인 상태 변경 PATCH 요청 허용
 * - 20261125 추가: 교육 실적 현황(수료 실적) API 라우터 연결
 * - 20261125 추가: 요청 로그(소요 시간·중단 감지), 처리되지 않은 오류 로그
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const educationRoutes = require("./Routes/educationRoutes.js");
const logRoutes = require("./Routes/logRoutes.js"); // 20261119 추가: 발송 로그 API
const dispatchRoutes = require("./Routes/dispatchRoutes.js"); // 20261119 추가: 발송 자동화 API
const performanceRoutes = require("./Routes/performanceRoutes.js"); // 20261125 추가: 교육 실적 현황 API
const app = express();


// =============================================================
// 1. 서버 설정
// =============================================================
const PORT = Number(process.env.PORT) || 3000;

const FRONTEND_URL =
    process.env.FRONTEND_URL || "http://localhost:5173";

app.disable("x-powered-by");


// =============================================================
// 2. 공통 미들웨어
// =============================================================
app.use(cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PATCH", "OPTIONS"], // 20261119 수정: POST 추가, 1124: PATCH 추가
    allowedHeaders: ["Content-Type", "Accept"],
}));

app.use(express.json());


// =============================================================
// 2-1. 20261125 추가: 요청 로그
// 요청 시작 / 응답 완료(상태 코드·소요 시간) / 응답 전 연결 끊김을 기록
// =============================================================
app.use((req, res, next) => {

    const startedAt = Date.now();
    const label = `${req.method} ${req.originalUrl}`;

    console.log(`[Request] → ${label}`);

    res.on("finish", () => {
        console.log(`[Request] ← ${label} ${res.statusCode} (${Date.now() - startedAt}ms)`);
    });

    res.on("close", () => {
        if (!res.writableFinished) {
            console.warn(`[Request] ✕ ${label} 응답 전에 연결이 끊어졌습니다 (${Date.now() - startedAt}ms)`);
        }
    });

    next();
});


// =============================================================
// 3. 서버 상태 확인 API
//
// GET /api/health
// =============================================================
app.get("/api/health", (req, res) => {

    return res.status(200).json({
        success: true,
        data: {
            status: "ok",
            service: "google-sheet-reader-api",
        },
        message: "Node.js API 서버가 정상적으로 실행 중입니다.",
    });
});


// =============================================================
// 4. 교육 데이터 API 라우터 연결
// =============================================================
app.use("/api/education", educationRoutes);


// =============================================================
// 5. 20261119 추가: 발송 로그 API 라우터 연결
// =============================================================
app.use("/api/logs", logRoutes);

// 20261119 추가: 발송 자동화 API 라우터 연결
app.use("/api/dispatch", dispatchRoutes);


// 20261125 추가: 교육 실적 현황(수료 실적) API 라우터 연결
app.use("/api/performance", performanceRoutes);


// =============================================================
// 6. 존재하지 않는 API 경로 처리
// =============================================================
app.use((req, res) => {

    return res.status(404).json({
        success: false,
        data: null,
        message: `요청한 API를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
    });
});


// =============================================================
// 7. 공통 서버 오류 처리
// =============================================================
app.use((error, req, res, next) => {

    console.error("[Server] 서버 오류 발생:", error);

    return res.status(500).json({
        success: false,
        data: null,
        message: "서버 내부 오류가 발생했습니다.",
    });
});


// =============================================================
// 8. 서버 실행
// =============================================================
if (require.main === module) {

    const server = app.listen(PORT, () => {

        console.log("");
        console.log(" GOOGLE SHEET READER API SERVER");
        console.log(`서버 주소: http://localhost:${PORT}`);
        console.log(`프론트엔드: ${FRONTEND_URL}`);
        console.log("");

        // 20261125 추가: 수료 실적 환경 변수 설정 여부 (값은 출력하지 않음)
        console.log(`PERFORMANCE_APPS_SCRIPT_URL: ${process.env.PERFORMANCE_APPS_SCRIPT_URL ? "설정됨" : "없음"}`);
        console.log(`PERFORMANCE_API_TOKEN: ${process.env.PERFORMANCE_API_TOKEN ? "설정됨" : "없음"}`);
        console.log("");
    });

    server.on("error", (error) => {
        console.error("[Server] 서버 실행 실패:", error);
    });

    // 20261125 추가: 처리되지 않은 오류도 로그로 남김
    process.on("unhandledRejection", (reason) => {
        console.error("[Server] 처리되지 않은 Promise 오류:", reason);
    });

    process.on("uncaughtException", (error) => {
        console.error("[Server] 처리되지 않은 예외로 서버를 종료합니다:", error);
        process.exit(1);
    });
}


module.exports = app;
