/**
 * @file EducationService.ts
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-18
 * @description
 * 실제로 API 요청을 처리하는 핵심 파일
 * 
 * 주요 기능:
 * - 특정 날짜 조회
 * - 날짜 범위 조회
 * - 날짜 형식 검증
 * - 시작일과 종료일 비교
 * - API 응답 검증
 * - 요청 시간 초과 처리
 * - 네트워크 오류 처리
 */


import { API_CONFIG, createEducationApiUrl } from '../Configs/api'
import type {
  ApiResponse,
  BusinessType,
  EducationDateParams,
  EducationDateRangeParams,
  EducationRecord,
} from '../Types/education'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsedDate = new Date(`${value}T00:00:00.000Z`)

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  )
}

function validateDateRange(startDate: string, endDate: string): void {
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) {
    throw new Error('조회 날짜는 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.')
  }

  if (startDate > endDate) {
    throw new Error('시작 날짜는 종료 날짜보다 늦을 수 없습니다.')
  }
}

function parseApiResponse<T>(value: unknown): ApiResponse<T> {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('Node.js API 응답 형식이 올바르지 않습니다.')
  }

  return {
    success: value.success,
    data: (value.data ?? null) as T | null,
    message: typeof value.message === 'string' ? value.message : null,
  }
}

async function requestEducationData(
  businessType: BusinessType,
  params: Record<string, string>,
): Promise<EducationRecord[]> {
  const url = createEducationApiUrl(businessType, params)
  const controller = new AbortController()

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    API_CONFIG.TIMEOUT_MS,
  )

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    const responseText = await response.text()
    let parsedBody: unknown

    try {
      parsedBody = JSON.parse(responseText)
    } catch {
      throw new Error('Node.js API가 JSON 형식이 아닌 응답을 반환했습니다.')
    }

    const result = parseApiResponse<EducationRecord[]>(parsedBody)

    if (!response.ok) {
      throw new Error(result.message || `API 요청 실패 (HTTP ${response.status})`)
    }

    if (!result.success) {
      throw new Error(result.message || '교육 데이터 조회에 실패했습니다.')
    }

    if (!Array.isArray(result.data)) {
      throw new Error('API 응답의 data가 배열 형태가 아닙니다.')
    }

    return result.data

    } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(
        '교육 데이터 조회 시간이 초과되었습니다.',
        { cause: error },
        )
    }

    if (error instanceof TypeError) {
        throw new Error(
        'Node.js API 서버에 연결할 수 없습니다. 서버 실행 주소와 CORS 설정을 확인해 주세요.',
        { cause: error },
        )
    }

    throw error instanceof Error
    ? error
    : new Error(
        '교육 데이터 조회 중 알 수 없는 오류가 발생했습니다.',
        { cause: error }, // 20261118 수정
        )

  } finally {
    window.clearTimeout(timeoutId)
  }
}

// 특정 날짜 조회
export async function getEducationByDate({
  businessType,
  date,
}: EducationDateParams): Promise<EducationRecord[]> {
  if (!isValidIsoDate(date)) {
    throw new Error('조회 날짜는 YYYY-MM-DD 형식의 올바른 날짜여야 합니다.')
  }

  return requestEducationData(businessType, { date })
}

// 날짜 범위 조회
export async function getEducationByDateRange({
  businessType,
  startDate,
  endDate,
}: EducationDateRangeParams): Promise<EducationRecord[]> {
  validateDateRange(startDate, endDate)

  return requestEducationData(businessType, {
    startDate,
    endDate,
  })
}
