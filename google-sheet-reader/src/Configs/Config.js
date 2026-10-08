/**
 * @file Config.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-08
 * @description
 * 이 파일은 애플리케이션 전역에서 사용되는 설정 및 환경 변수를 관리.
 * 주요 기능 :
 * - 문자 발송 테스트 모드 설정
 * - 뿌리오(Ppurio) API 설정 관리
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