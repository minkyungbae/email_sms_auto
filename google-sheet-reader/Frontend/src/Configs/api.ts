/**
 * @file api.ts
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-19
 * @description
 * API 주소 및 설정
 */

import type { BusinessType } from '../Types/education'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  EDUCATION_ENDPOINT: '/api/education',
  LOG_ENDPOINT: '/api/logs', // 20261119 추가: 발송 로그 조회 API
  LOG_TIMEOUT_MS: 120000, // 20261119 추가: 로그 조회 요청 시간 제한
  TIMEOUT_MS: 30000,
} as const

export function createEducationApiUrl(
  businessType: BusinessType,
  params: Record<string, string>,
): URL {
  if (!API_CONFIG.BASE_URL) {
    throw new Error('VITE_API_BASE_URL 환경변수가 설정되지 않았습니다.')
  }

  const url = new URL(
    `${API_CONFIG.EDUCATION_ENDPOINT}/${businessType}`,
    API_CONFIG.BASE_URL,
  )

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return url
}

// 20261119 추가: 발송 로그 API URL 생성
export function createLogApiUrl(): URL {
  if (!API_CONFIG.BASE_URL) {
    throw new Error('VITE_API_BASE_URL 환경변수가 설정되지 않았습니다.')
  }

  return new URL(API_CONFIG.LOG_ENDPOINT, API_CONFIG.BASE_URL)
}