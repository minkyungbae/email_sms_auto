/**
 * @file api.ts
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-26
 * @description 프론트엔드 API 주소 및 요청 설정.
 * 
 * EducationService.ts / LogService.ts / DispatchService.ts에 API 주소 전달
 * 20261124 수정: 로그 조회 및 개별 로그 수정 경로 지원
 * 20261125 추가: 교육 실적 현황 API
 * 20261126 추가: 발송 로그 조회 새로고침(refresh) 파라미터
 */

// 교육 사업 유형 타입 가져오기
import type { BusinessType } from '../Types/education'

// Vite 환경변수에서 백엔드 서버 주소 가져오기
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

// =============================================================
// 1. API 주소 및 요청 시간 설정
// =============================================================
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,           // 백엔드 서버 기본 주소
  EDUCATION_ENDPOINT: '/api/education', // 교육 데이터 조회 API
  LOG_ENDPOINT: '/api/logs',         // 발송 로그 조회 API
  LOG_TIMEOUT_MS: 1200000,            // 로그 조회 제한 시간: 1200초
  DISPATCH_ENDPOINT: '/api/dispatch', // 발송 자동화 API
  DISPATCH_TIMEOUT_MS: 300000,        // 발송 API 제한 시간: 300초
  PERFORMANCE_ENDPOINT: '/api/performance', // 20261125 추가: 교육 실적 현황 API
  PERFORMANCE_TIMEOUT_MS: 300000,           // 20261125 추가: 수료 실적 조회 제한 시간: 300초
  TIMEOUT_MS: 300000,                 // 교육 데이터 조회 제한 시간: 300초
} as const


// =============================================================
// 2. 백엔드 서버 주소 검증
// =============================================================
function getApiBaseUrl(): string {
  if (!API_CONFIG.BASE_URL) {
    throw new Error('VITE_API_BASE_URL 환경변수가 설정되지 않았습니다.')
  }

  return API_CONFIG.BASE_URL
}


// =============================================================
// 3. 교육 데이터 조회 API URL 생성
// =============================================================
export function createEducationApiUrl(
  businessType: BusinessType,
  params: Record<string, string>,
): URL {
  const url = new URL(
    `${API_CONFIG.EDUCATION_ENDPOINT}/${businessType}`,
    getApiBaseUrl(),
  )

  // 조회 조건을 URL 쿼리 파라미터로 추가
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return url
}

// =============================================================
// 4. 발송 로그 API URL 생성
// 20261124 수정: 로그 조회 및 개별 로그 수정 경로 지원
// 20261126 수정: refresh=true 이면 서버 캐시를 무시하고 다시 조회
// =============================================================
export function createLogApiUrl(path = '', refresh = false): URL {
  const url = new URL(
    `${API_CONFIG.LOG_ENDPOINT}${path}`,
    getApiBaseUrl(),
  )

  if (refresh) {
    url.searchParams.set('refresh', '1')
  }

  return url
}

// =============================================================
// 5. 발송 자동화 API URL 생성
// =============================================================
export function createDispatchApiUrl(path: string): URL {
  return new URL(
    `${API_CONFIG.DISPATCH_ENDPOINT}${path}`,
    getApiBaseUrl(),
  )
}

// =============================================================
// 6. 교육 실적 현황(수료 실적) API URL 생성
// 20261125 추가
// =============================================================
export function createPerformanceApiUrl(refresh = false): URL {
  const url = new URL(API_CONFIG.PERFORMANCE_ENDPOINT, getApiBaseUrl())

  if (refresh) {
    url.searchParams.set('refresh', '1')
  }

  return url
}
