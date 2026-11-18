/**
 * @file api.ts
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-18
 * @description
 * API 주소 및 설정
 */

import type { BusinessType } from '../Types/education'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  EDUCATION_ENDPOINT: '/api/education',
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
