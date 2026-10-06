/**
 * ================================================================
 * Config.js
 * 시스템 전역 실행 설정
 * ================================================================
 */

const {
    getPpurioConfig,
} = require("../../../security_info.js");

const CONFIG = {
    // 문자 테스트 모드
    // true  → 실제 문자 발송 안 함
    // false → 실제 문자 발송
    TEST_MODE: true,

    // 뿌리오 설정
    PPURIO: getPpurioConfig(),
};

module.exports = CONFIG;