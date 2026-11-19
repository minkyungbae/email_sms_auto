/**
 * @file DispatchService.ts
 * @author 배민경
 * @created 2026-11-19
 * @updated 2026-11-19
 * @description
 * React에서 Node.js 발송 자동화 API를 호출하고 응답을 검증
 *
 * 주요 기능:
 * - 발송 설정 조회
 * - 발송 자동화 실행 요청
 * - 발송 작업 진행 상태 조회
 * - API 응답 검증
 * - 요청 시간 초과 및 네트워크 오류 처리
 */


import {
  API_CONFIG,
  createDispatchApiUrl,
} from '../Configs/api'


// =============================================================
// 1. 발송 설정 타입
// =============================================================
export type DispatchSettings = {
  businessTypes: string[]
  daysBefore: number
  targetDate: string
  modes: {
    emailPreviewMode: boolean
    emailTestRecipientMode: boolean
    smsTestRecipientMode: boolean
    smsApiTestMode: boolean
  }
}


// =============================================================
// 2. 발송 작업 상태 타입
// =============================================================
export type DispatchJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'


// =============================================================
// 3. 발송 작업 결과 타입
// =============================================================
export type DispatchJobResult = {
  businessTypes: string[]
  targetDate: string
  logCount: number
}


export type DispatchStatusResult = {
  jobId: string
  status: DispatchJobStatus
  result: DispatchJobResult | null
  error: string | null
}


// =============================================================
// 4. API 응답 타입
// =============================================================
type DispatchApiResponse = {
  success: boolean
  data: unknown
  message: string | null
}


// =============================================================
// 5. 객체 유효성 검사
// =============================================================
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}


// =============================================================
// 6. 문자열 배열 검사
// =============================================================
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item): item is string => typeof item === 'string')
}


// =============================================================
// 7. API 응답 파싱
// =============================================================
function parseDispatchApiResponse(value: unknown): DispatchApiResponse {

  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('발송 자동화 API 응답 형식이 올바르지 않습니다.')
  }

  return {
    success: value.success,
    data: value.data ?? null,
    message: typeof value.message === 'string' ? value.message : null,
  }
}


// =============================================================
// 8. 공통 API 요청
// =============================================================
async function requestDispatchApi(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: { confirm: true; targetDate: string },
): Promise<DispatchApiResponse> {

  const url = createDispatchApiUrl(path)
  const controller = new AbortController()

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    API_CONFIG.DISPATCH_TIMEOUT_MS,
  )

  try {

    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    })

    const responseText = await response.text()
    let parsedBody: unknown

    try {
      parsedBody = JSON.parse(responseText)
    } catch {
      throw new Error('Node.js 발송 API가 JSON 형식이 아닌 응답을 반환했습니다.')
    }

    const result = parseDispatchApiResponse(parsedBody)

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || `발송 API 요청 실패 (HTTP ${response.status})`,
      )
    }

    return result

  } catch (error) {

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        '발송 자동화 API 요청 시간이 초과되었습니다.',
        { cause: error },
      )
    }

    if (error instanceof TypeError) {
      throw new Error(
        'Node.js API 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.',
        { cause: error },
      )
    }

    throw error instanceof Error
      ? error
      : new Error(
          '발송 자동화 API 요청 중 알 수 없는 오류가 발생했습니다.',
          { cause: error },
        )

  } finally {
    window.clearTimeout(timeoutId)
  }
}


// =============================================================
// 9. 발송 설정 조회
// GET /api/dispatch/settings
// =============================================================
export async function getDispatchSettings(): Promise<DispatchSettings> {

  const response = await requestDispatchApi('/settings')
  const data = response.data

  if (
    !isRecord(data) ||
    !isStringArray(data.businessTypes) ||
    typeof data.daysBefore !== 'number' ||
    typeof data.targetDate !== 'string' ||
    !isRecord(data.modes)
  ) {
    throw new Error('발송 설정 데이터 형식이 올바르지 않습니다.')
  }

  const modes = data.modes

  if (
    typeof modes.emailPreviewMode !== 'boolean' ||
    typeof modes.emailTestRecipientMode !== 'boolean' ||
    typeof modes.smsTestRecipientMode !== 'boolean' ||
    typeof modes.smsApiTestMode !== 'boolean'
  ) {
    throw new Error('발송 테스트 설정 데이터가 올바르지 않습니다.')
  }

  return {
    businessTypes: data.businessTypes,
    daysBefore: data.daysBefore,
    targetDate: data.targetDate,
    modes: {
      emailPreviewMode: modes.emailPreviewMode,
      emailTestRecipientMode: modes.emailTestRecipientMode,
      smsTestRecipientMode: modes.smsTestRecipientMode,
      smsApiTestMode: modes.smsApiTestMode,
    },
  }
}


// =============================================================
// 10. 발송 자동화 실행
// POST /api/dispatch/run
// =============================================================
export async function startDispatch(
  targetDate: string,
): Promise<string> {

  const response = await requestDispatchApi(
    '/run',
    'POST',
    {
      confirm: true,
      targetDate,
    },
  )

  if (
    !isRecord(response.data) ||
    typeof response.data.jobId !== 'string'
  ) {
    throw new Error('발송 작업 ID를 확인할 수 없습니다.')
  }

  return response.data.jobId
}


// =============================================================
// 11. 발송 작업 상태 조회
// GET /api/dispatch/status/:jobId
// =============================================================
export async function getDispatchStatus(
  jobId: string,
): Promise<DispatchStatusResult> {

  const response = await requestDispatchApi(
    `/status/${encodeURIComponent(jobId)}`,
  )

  const data = response.data

  const validStatuses: DispatchJobStatus[] = [
    'queued',
    'running',
    'succeeded',
    'failed',
  ]

  if (
    !isRecord(data) ||
    typeof data.jobId !== 'string' ||
    !validStatuses.includes(data.status as DispatchJobStatus)
  ) {
    throw new Error('발송 작업 상태 데이터 형식이 올바르지 않습니다.')
  }

  let result: DispatchJobResult | null = null

  if (data.result !== null && data.result !== undefined) {

    if (
      !isRecord(data.result) ||
      !isStringArray(data.result.businessTypes) ||
      typeof data.result.targetDate !== 'string' ||
      typeof data.result.logCount !== 'number'
    ) {
      throw new Error('발송 작업 결과 데이터 형식이 올바르지 않습니다.')
    }

    result = {
      businessTypes: data.result.businessTypes,
      targetDate: data.result.targetDate,
      logCount: data.result.logCount,
    }
  }

  return {
    jobId: data.jobId,
    status: data.status as DispatchJobStatus,
    result,
    error: typeof data.error === 'string' ? data.error : null,
  }
}
