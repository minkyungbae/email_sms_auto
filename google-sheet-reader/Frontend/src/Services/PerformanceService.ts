/**
 * @file PerformanceService.ts
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 교육 실적 현황(수료실적_RAW) 조회 API 요청
 */

import { API_CONFIG, createPerformanceApiUrl } from '../Configs/api'
import { requestApiData } from './ApiClient'
import { PERFORMANCE_FIELDS } from '../Types/performance'
import type {
  PerformanceRecord,
  PerformanceResult,
} from '../Types/performance'

// =======================================
// 1. 응답 데이터 검증 보조 함수
// =======================================
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 누락된 컬럼은 빈 문자열로 채워 항상 같은 구조로 반환 */
function toPerformanceRecord(value: unknown): PerformanceRecord {
  if (!isRecord(value)) {
    throw new Error('수료 실적 데이터 형식이 올바르지 않습니다.')
  }

  return Object.fromEntries(
    PERFORMANCE_FIELDS.map((field) => {
      const cell = value[field]
      return [field, cell === null || cell === undefined ? '' : String(cell)]
    }),
  ) as PerformanceRecord
}

// =======================================
// 2. 수료 실적 조회
// refresh=true 이면 서버 캐시를 무시하고 시트를 다시 조회
// =======================================
export async function getPerformanceData(
  refresh = false,
): Promise<PerformanceResult> {
  const data = await requestApiData<unknown>(createPerformanceApiUrl(refresh), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: API_CONFIG.PERFORMANCE_TIMEOUT_MS,
    timeoutMessage: '수료 실적 조회 시간이 초과되었습니다.',
    networkErrorMessage: '백엔드 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.',
    invalidResponseMessage: '수료 실적 API 응답 형식이 올바르지 않습니다.',
    requestFailureMessage: '수료 실적 조회에 실패했습니다.',
  })

  if (!isRecord(data) || !Array.isArray(data.records)) {
    throw new Error('수료 실적 API 응답 형식이 올바르지 않습니다.')
  }

  return {
    records: data.records.map(toPerformanceRecord),
    headerWarnings: Array.isArray(data.headerWarnings)
      ? data.headerWarnings.map(String)
      : [],
    fetchedAt: typeof data.fetchedAt === 'string' ? data.fetchedAt : '',
  }
}