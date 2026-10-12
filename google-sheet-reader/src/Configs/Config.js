/**
 * @file Config.js
 * @author 배민경
 * @created 2026-10-06
 * @updated 2026-10-12
 * @description
 * 애플리케이션 전역에서 사용되는 설정 및 환경 변수 관리
 * 
 * 주요 기능 :
 * - 문자 발송 테스트 모드 설정
 * - 뿌리오(Ppurio) API 설정 관리
 * - 사업 유형 설정
 * - 교육 일정 조회 및 발송 기준일 설정
 */


const { getPpurioConfig } = require("../../../security_info.js");

const CONFIG = {

    // 사업 타입 설정 261012 추가
    BUSINESS_TYPE: ["GW", "DS"],

    // 발송 기준일 (0 : 수업 당일 / 7 : 수업 일주일 전)
    DAYS_BEFORE: 0,

    // SMS 수신번호 테스트 모드 (true: 테스트 전화번호 / false: 실제 수신자 전화번호)
    SMS_TEST_RECIPIENT_MODE: true,

    // 이메일 테스트 모드 (true → 테스트 이메일 주소 / false → 실제 발송)
    EMAIL_TEST_MODE: true, // 261012 추가

    // 뿌리오 실제 발송 모드 (true → 실제 문자 발송 안 함 / false → 실제 발송)
    TEST_MODE: true,


    // 뿌리오 설정
    PPURIO: getPpurioConfig(),
};

module.exports = CONFIG;