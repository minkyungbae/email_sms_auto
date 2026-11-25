/**
 * @file DispatchService.ts
 * @author 배민경
 * @created 2026-11-19
 * @updated 2026-11-25
 * @description React에서 Node.js 발송 자동화 API를 호출하고 응답을 검증
 *
 * 주요 기능:
 * - 발송 설정 조회
 * - 발송 자동화 실행 요청
 * - 발송 작업 진행 상태 조회
 * - 발송 API 응답 데이터 검증
 * 
 * 20261120 수정: 공통 ApiClient 활용 및 타입·검증 함수 구조 정리
 * 20261124 추가: 웹에서 발송 기준일 변경 기능 추가
 * 20261125 추가: 발송 로그 화면 개별 발송(선택 수신자 / 직접 입력) 요청 및 상태 조회
 */

import { API_CONFIG, createDispatchApiUrl } from '../Configs/api'
import { requestApiData } from './ApiClient'


// =======================================
// 1. 발송 요청 본문 타입
// =======================================
type DispatchRunRequestBody = {
  confirm: true
  targetDate: string
}

type DispatchSettingsRequestBody = {
  daysBefore: number
}

// 20261125 추가: 개별 발송 요청 본문
type ManualSendRequestBody = {
  confirm: true
  messages: ManualSendMessage[]
}

type DispatchRequestBody =
  | DispatchRunRequestBody
  | DispatchSettingsRequestBody
  | ManualSendRequestBody

// =======================================
// 1-1. 개별 발송 메시지 타입
// 20261125 추가
// =======================================
export type ManualBusinessType = 'GW' | 'DS'

export type ManualSendMessage = {
  sourceLogId: string
  businessType: ManualBusinessType
  recipient: {
    name: string
    role: string
    phone: string
    email: string
    affiliation: string
  }
  education: {
    교육과정명: string
    교육기관명: string
    반명: string
    교육일: string
    요일: string
    교육시간: string
  }
  sms: {
    enabled: boolean
    subject: string
    body: string
  }
  email: {
    enabled: boolean
    subject: string
    body: string
  }
}

// 20261125 추가: 채널별 개별 발송 결과
export type ManualChannelResult = {
  success: boolean
  previewOnly: boolean
  testMode: boolean
  recipient: string
  error: string
}

// 20261125 추가: 수신자별 개별 발송 결과
export type ManualRecipientResult = {
  index: number
  sourceLogId: string
  name: string
  sms: ManualChannelResult | null
  email: ManualChannelResult | null
}

// 20261125 추가: 개별 발송 작업 결과
export type ManualSendJobResult = {
  total: number
  logCount: number
  summary: {
    smsSuccess: number
    smsFailure: number
    emailSuccess: number
    emailFailure: number
  }
  results: ManualRecipientResult[]
}

export type ManualSendStatusResult = {
  jobId: string
  status: DispatchJobStatus
  result: ManualSendJobResult | null
  error: string | null
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
  method: 'GET' | 'POST' | 'PATCH' = 'GET', //20261124 수정
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

function parseDispatchSettings(data: unknown): DispatchSettings {
  if (
    !isRecord(data) ||
    !isStringArray(data.businessTypes) ||
    typeof data.daysBefore !== 'number' ||
    !Number.isInteger(data.daysBefore) ||
    data.daysBefore < 0 ||
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
// 12-1. 발송 설정 조회
// GET /api/dispatch/settings
// =======================================
export async function getDispatchSettings(): Promise<DispatchSettings> {
  const data = await requestDispatchApi('/settings')

  return parseDispatchSettings(data)
}

// =======================================
// 12-2. 발송 기준일 설정 저장
// PATCH /api/dispatch/settings
// 20261124 추가
// =======================================
export async function updateDispatchSettings(
  daysBefore: number,
): Promise<DispatchSettings> {
  if (!Number.isInteger(daysBefore) || daysBefore < 0) {
    throw new Error('발송 기준일은 0 이상의 정수로 입력해야 합니다.')
  }

  const data = await requestDispatchApi('/settings', 'PATCH', { daysBefore })

  return parseDispatchSettings(data)
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

// =======================================
// 15. 개별 발송 실행
// POST /api/dispatch/manual-send
// 20261125 추가
// =======================================
export async function startManualSend(
  messages: ManualSendMessage[],
): Promise<string> {
  if (messages.length === 0) {
    throw new Error('발송할 수신자가 없습니다.')
  }

  const data = await requestDispatchApi('/manual-send', 'POST', {
    confirm: true,
    messages,
  })

  if (!isRecord(data) || typeof data.jobId !== 'string') {
    throw new Error('개별 발송 작업 ID를 확인할 수 없습니다.')
  }

  return data.jobId
}

// =======================================
// 16. 개별 발송 결과 데이터 검증
// 20261125 추가
// =======================================
function parseManualChannelResult(value: unknown): ManualChannelResult | null {
  if (value === null || value === undefined) return null

  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('개별 발송 채널 결과 형식이 올바르지 않습니다.')
  }

  return {
    success: value.success,
    previewOnly: value.previewOnly === true,
    testMode: value.testMode === true,
    recipient: typeof value.recipient === 'string' ? value.recipient : '',
    error: typeof value.error === 'string' ? value.error : '',
  }
}

function parseManualSendJobResult(value: unknown): ManualSendJobResult {
  if (
    !isRecord(value) ||
    typeof value.total !== 'number' ||
    typeof value.logCount !== 'number' ||
    !isRecord(value.summary) ||
    !Array.isArray(value.results)
  ) {
    throw new Error('개별 발송 결과 데이터 형식이 올바르지 않습니다.')
  }

  const summary = value.summary
  const toCount = (count: unknown) => (typeof count === 'number' ? count : 0)

  return {
    total: value.total,
    logCount: value.logCount,
    summary: {
      smsSuccess: toCount(summary.smsSuccess),
      smsFailure: toCount(summary.smsFailure),
      emailSuccess: toCount(summary.emailSuccess),
      emailFailure: toCount(summary.emailFailure),
    },
    results: value.results.map((item, index) => {
      if (!isRecord(item)) {
        throw new Error('개별 발송 수신자 결과 형식이 올바르지 않습니다.')
      }

      return {
        index: typeof item.index === 'number' ? item.index : index,
        sourceLogId: typeof item.sourceLogId === 'string' ? item.sourceLogId : '',
        name: typeof item.name === 'string' ? item.name : '',
        sms: parseManualChannelResult(item.sms),
        email: parseManualChannelResult(item.email),
      }
    }),
  }
}

// =======================================
// 17. 개별 발송 작업 상태 조회
// GET /api/dispatch/status/:jobId
// 20261125 추가
// =======================================
export async function getManualSendStatus(
  jobId: string,
): Promise<ManualSendStatusResult> {
  const data = await requestDispatchApi(
    `/status/${encodeURIComponent(jobId)}`,
  )

  if (
    !isRecord(data) ||
    typeof data.jobId !== 'string' ||
    !isDispatchJobStatus(data.status)
  ) {
    throw new Error('개별 발송 작업 상태 데이터 형식이 올바르지 않습니다.')
  }

  return {
    jobId: data.jobId,
    status: data.status,
    result:
      data.result === null || data.result === undefined
        ? null
        : parseManualSendJobResult(data.result),
    error: typeof data.error === 'string' ? data.error : null,
  }
}