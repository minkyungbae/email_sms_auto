/**
 * @file DispatchService.ts
 * @author 배민경
 * @created 2026-11-19
 * @updated 2026-11-20
 * @description React에서 Node.js 발송 자동화 API를 호출하고 응답을 검증
 *
 * 주요 기능:
 * - 발송 설정 조회
 * - 발송 자동화 실행 요청
 * - 발송 작업 진행 상태 조회
 * - 발송 API 응답 데이터 검증
 * 
 * 20261120 수정: 공통 ApiClient 활용 및 타입·검증 함수 구조 정리
 */



import { API_CONFIG, createDispatchApiUrl } from '../Configs/api'
import { requestApiData } from './ApiClient'

// =======================================
// 1. 발송 요청 본문 타입
// =======================================
type DispatchRequestBody = {
  confirm: true
  targetDate: string
}

// =======================================
// 2. 발송 테스트 설정 타입
// =======================================
type DispatchModes = {
  emailPreviewMode: boolean
  emailTestRecipientMode: boolean
  smsTestRecipientMode: boolean
  smsApiTestMode: boolean
}

// =======================================
// 3. 발송 설정 타입
// =======================================
export type DispatchSettings = {
  businessTypes: string[]
  daysBefore: number
  targetDate: string
  modes: DispatchModes
}

// =======================================
// 4. 발송 작업 상태 타입
// =======================================
const DISPATCH_JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
] as const

export type DispatchJobStatus = (typeof DISPATCH_JOB_STATUSES)[number]

// =======================================
// 5. 발송 작업 결과 타입
// =======================================
export type DispatchJobResult = {
  businessTypes: string[]
  targetDate: string
  logCount: number
}

// =======================================
// 6. 발송 상태 조회 결과 타입
// =======================================
export type DispatchStatusResult = {
  jobId: string
  status: DispatchJobStatus
  result: DispatchJobResult | null
  error: string | null
}

// =======================================
// 7. 전달받은 값이 일반 객체인지 확인
// =======================================
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// =======================================
// 8. 전달받은 값이 문자열 배열인지 확인
// =======================================
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.every((item): item is string => typeof item === 'string')
}

// =======================================
// 9. 발송 테스트 설정 데이터 검증
// =======================================
function isDispatchModes(value: unknown): value is DispatchModes {
  return (
    isRecord(value) &&
    typeof value.emailPreviewMode === 'boolean' &&
    typeof value.emailTestRecipientMode === 'boolean' &&
    typeof value.smsTestRecipientMode === 'boolean' &&
    typeof value.smsApiTestMode === 'boolean'
  )
}

// =======================================
// 10. 발송 작업 상태값 검증
// =======================================
function isDispatchJobStatus(value: unknown): value is DispatchJobStatus {
  return DISPATCH_JOB_STATUSES.some((status) => status === value)
}

// =======================================
// 11. 발송 자동화 API 공통 요청
// =======================================
function requestDispatchApi(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: DispatchRequestBody,
): Promise<unknown> {
  return requestApiData<unknown>(createDispatchApiUrl(path), {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    timeoutMs: API_CONFIG.DISPATCH_TIMEOUT_MS,
    timeoutMessage: '발송 자동화 API 요청 시간이 초과되었습니다.',
    networkErrorMessage:
      'Node.js API 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.',
    invalidResponseMessage: 'Node.js 발송 API 응답 형식이 올바르지 않습니다.',
    requestFailureMessage: '발송 API 요청에 실패했습니다.',
  })
}

// =======================================
// 12. 발송 설정 조회
// GET /api/dispatch/settings
// =======================================
export async function getDispatchSettings(): Promise<DispatchSettings> {
  const data = await requestDispatchApi('/settings')

  if (
    !isRecord(data) ||
    !isStringArray(data.businessTypes) ||
    typeof data.daysBefore !== 'number' ||
    typeof data.targetDate !== 'string'
  ) {
    throw new Error('발송 설정 데이터 형식이 올바르지 않습니다.')
  }

  if (!isDispatchModes(data.modes)) {
    throw new Error('발송 테스트 설정 데이터가 올바르지 않습니다.')
  }

  return {
    businessTypes: data.businessTypes,
    daysBefore: data.daysBefore,
    targetDate: data.targetDate,
    modes: data.modes,
  }
}

// =======================================
// 13. 발송 자동화 실행
// POST /api/dispatch/run
// =======================================
export async function startDispatch(targetDate: string): Promise<string> {
  const data = await requestDispatchApi('/run', 'POST', {
    confirm: true,
    targetDate,
  })

  if (!isRecord(data) || typeof data.jobId !== 'string') {
    throw new Error('발송 작업 ID를 확인할 수 없습니다.')
  }

  return data.jobId
}

// =======================================
// 14. 발송 작업 상태 조회
// GET /api/dispatch/status/:jobId
// =======================================
export async function getDispatchStatus(
  jobId: string,
): Promise<DispatchStatusResult> {
  const data = await requestDispatchApi(
    `/status/${encodeURIComponent(jobId)}`,
  )

  if (
    !isRecord(data) ||
    typeof data.jobId !== 'string' ||
    !isDispatchJobStatus(data.status)
  ) {
    throw new Error('발송 작업 상태 데이터 형식이 올바르지 않습니다.')
  }

  let result: DispatchJobResult | null = null

  if (data.result !== null && data.result !== undefined) {
    const resultData = data.result

    if (
      !isRecord(resultData) ||
      !isStringArray(resultData.businessTypes) ||
      typeof resultData.targetDate !== 'string' ||
      typeof resultData.logCount !== 'number'
    ) {
      throw new Error('발송 작업 결과 데이터 형식이 올바르지 않습니다.')
    }

    result = {
      businessTypes: resultData.businessTypes,
      targetDate: resultData.targetDate,
      logCount: resultData.logCount,
    }
  }

  return {
    jobId: data.jobId,
    status: data.status,
    result,
    error: typeof data.error === 'string' ? data.error : null,
  }
}