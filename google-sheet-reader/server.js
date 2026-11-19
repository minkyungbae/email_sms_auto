/**
 * @file server.js
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-19
 * @description
 * Node.js Express 서버 실행 및 관리
 *
 * 주요 기능:
 * - Express 서버 생성
 * - CORS 설정
 * - 교육 데이터 API 라우터 연결
 * - 서버 상태 확인 API
 * - 공통 오류 처리
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const educationRoutes = require("./Routes/educationRoutes.js");
const logRoutes = require("./Routes/logRoutes.js"); // 20261119 추가: 발송 로그 API
const dispatchRoutes = require("./Routes/dispatchRoutes.js"); // 20261119 추가: 발송 자동화 API

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
    methods: ["GET", "POST", "OPTIONS"], // 20261119 수정: POST 추가
    allowedHeaders: ["Content-Type", "Accept"],
}));

app.use(express.json());


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
    });

    server.on("error", (error) => {
        console.error("[Server] 서버 실행 실패:", error);
    });
}


module.exports = app;
