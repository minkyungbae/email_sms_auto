/**
 * @file EducationService.ts
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-26
 * @description GW·DS 교육 데이터 조회
 * 
 * 주요 기능:
 * - 특정 날짜 기준 교육 데이터 조회
 * - 기간별 교육 데이터 조회
 * - 조회 날짜 및 기간 유효성 검사
 * - API 응답 데이터 배열 검증
 * 
 * 20261120 수정: 공통 ApiClient를 활용하도록 API 요청 처리 분리
 * 20261126 추가: 서버 캐시 대응
 * - refresh=true 이면 서버 캐시를 무시하고 시트를 다시 조회
 * - getEducationByDateRangeWithMeta: 데이터와 서버 조회 시각을 함께 반환
 */

import { API_CONFIG, createEducationApiUrl } from '../Configs/api'
import { requestApiDataWithMeta } from './ApiClient'
import type {
  BusinessType,
  EducationDateParams,
  EducationDateRangeParams,
  EducationRecord,
} from '../Types/education'


// =======================================
// 1. 날짜 문자열이 실제 유효한 날짜인지 검증
// =======================================
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const parsedDate = new Date(`${value}T00:00:00.000Z`)

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  )
}


// =======================================
// 2. 시작일과 종료일의 유효성 및 순서 검증
// =======================================
function validateDateRange(startDate: string, endDate: string): void {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    throw new Error('조회 날짜는 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.')
  }

  if (startDate > endDate) {
    throw new Error('시작 날짜는 종료 날짜보다 늦을 수 없습니다.')
  }
}


// =======================================
// 3. GW 또는 DS 교육 데이터 요청
// =======================================
// 20261126 수정: 서버 조회 시각 함께 반환
export type EducationQueryResult = {
  records: EducationRecord[]
  fetchedAt: string | null
}

async function requestEducationData(
  businessType: BusinessType,
  params: Record<string, string>,
): Promise<EducationQueryResult> {
  const { data, fetchedAt } = await requestApiDataWithMeta<unknown>(
    createEducationApiUrl(businessType, params),
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: API_CONFIG.TIMEOUT_MS,
      timeoutMessage: '교육 데이터 조회 시간이 초과되었습니다.',
      networkErrorMessage: 'Node.js API 서버에 연결할 수 없습니다. 서버 실행 주소와 CORS 설정을 확인해 주세요.',
      invalidResponseMessage: 'Node.js 교육 API 응답 형식이 올바르지 않습니다.',
      requestFailureMessage: '교육 데이터 조회에 실패했습니다.',
    },
  )

  if (!Array.isArray(data)) {
    throw new Error('교육 데이터 API 응답의 data가 배열 형태가 아닙니다.')
  }

  return { records: data as EducationRecord[], fetchedAt }
}


// =======================================
// 4. 특정 날짜의 교육 데이터 조회
// =======================================
export async function getEducationByDate({
  businessType,
  date,
}: EducationDateParams): Promise<EducationRecord[]> {
  if (!isValidIsoDate(date)) {
    throw new Error('조회 날짜는 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.')
  }

  const { records } = await requestEducationData(businessType, { date })
  return records
}


// =======================================
// 5. 날짜 범위에 해당하는 교육 데이터 조회
// =======================================
export async function getEducationByDateRange(
  params: EducationDateRangeParams,
  options: { refresh?: boolean } = {},
): Promise<EducationRecord[]> {
  const { records } = await getEducationByDateRangeWithMeta(params, options)
  return records
}

// =======================================
// 6. 날짜 범위 교육 데이터 + 서버 조회 시각
// 20261126 추가: refresh=true 이면 서버 캐시 무시
// =======================================
export async function getEducationByDateRangeWithMeta(
  { businessType, startDate, endDate }: EducationDateRangeParams,
  { refresh = false }: { refresh?: boolean } = {},
): Promise<EducationQueryResult> {
  validateDateRange(startDate, endDate)

  return requestEducationData(businessType, {
    startDate,
    endDate,
    ...(refresh ? { refresh: '1' } : {}),
  })
}
