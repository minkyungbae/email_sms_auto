/**
 * @file performance.ts
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 교육 실적 현황(수료실적_RAW 시트, B:AN) 데이터 타입
 */

export type PerformanceValue = string | number | boolean | null

// =======================================
// 1. 수료실적_RAW 컬럼 (B ~ AN)
// =======================================
export const PERFORMANCE_FIELDS = [
  '종료월', // B
  '진행상황', // C
  '지역', // D
  '수요처명', // E
  '반명', // F
  '학교 구분', // G
  '근무유형', // H
  '교육유형', // I
  '교육구분', // J
  '유형', // K
  '정규구분', // L
  '상세', // M
  '카테고리1', // N
  '카테고리2', // O
  '카테고리3', // P
  '교육시간 (교시)', // Q
  '교육횟수 (회)', // R
  '수강인원 (명)', // S
  '수료인원 (명)', // T
  '교육시작일', // U
  '교육종료일', // V
  '활동연도', // W
  '주강사', // X
  '보조강사', // Y
  '구분', // Z
  '학년', // AA
  '학년/반', // AB
  '기관명', // AC
  '주소', // AD
  '주소(시)', // AE
  '성명', // AF
  '직위/직책', // AG
  '대표번호', // AH
  '휴대전화', // AI
  '이메일', // AJ
  '수요처 특이사항', // AK
  '종료수료인원(여)', // AL
  '종료수료인원(남)', // AM
  '종료수료인원(총)', // AN
] as const

export type PerformanceField = (typeof PERFORMANCE_FIELDS)[number]

/** 수료실적_RAW 한 행 (모든 값은 시트 표시 문자열) */
export type PerformanceRecord = Record<PerformanceField, string>

// =======================================
// 2. API 응답 데이터
// =======================================
export type PerformanceResult = {
  records: PerformanceRecord[]
  headerWarnings: string[] // 시트 헤더가 설정과 다를 때 경고
  fetchedAt: string
}