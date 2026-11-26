/**
 * @file LogService.ts
 * @author 배민경
 * @created 2026-11-19
 * @updated 2026-11-26
 * @description 문자 및 이메일 발송 로그 조회
 *
 * 주요 기능:
 * - 전체 발송 로그 조회
 * - 발송 로그 항목의 객체 구조 검증
 * - 누락된 필드를 빈 문자열로 정규화
 * - 각 필드의 데이터 형식 검증
 * 
 * 20261120 수정: 공통 ApiClient 활용 및 필드값 정규화 보완
 * 20261124 추가: 수동 발송 확인 상태 Update 기능
 * 20261126 추가: 서버 캐시 대응 (refresh=true 이면 캐시 무시, 서버 조회 시각 함께 반환)
 */

import { API_CONFIG, createLogApiUrl } from '../Configs/api'
import { requestApiData, requestApiDataWithMeta } from './ApiClient'

// =======================================
// 1. 발송 로그 한 건의 데이터 타입
// =======================================
export type LogRecord = {
  ID: string
  'No.': string
  교육과정명: string
  교육기관명: string
  반명: string
  차시: string
  교육일: string
  요일: string
  교육시간: string
  역할: string
  성명: string
  소속기관명: string
  연락처: string
  이메일: string
  문자발송상태: string
  이메일발송상태: string
  발송일시: string
  발송인: string
  발송연락처: string
  발송이메일: string
  수신인: string
  실제수신연락처: string
  실제수신이메일: string
  제목: string
  문자본문내용: string
  이메일본문내용: string

  // 20261124 추가: 수동 발송 확인 정보
  수동발송확인: string
  수동확인일시: string
}

// =======================================
// 2. 수동 발송 확인 상태 변경 결과 타입
// 20261124 추가
// =======================================
export type ManualConfirmationResult = Pick<
  LogRecord,
  'ID' | '수동발송확인' | '수동확인일시'
>


// =======================================
// 3. 정규화할 로그 필드 목록
// =======================================
const LOG_FIELDS: (keyof LogRecord)[] = [
  'ID',
  'No.',
  '교육과정명',
  '교육기관명',
  '반명',
  '차시',
  '교육일',
  '요일',
  '교육시간',
  '역할',
  '성명',
  '소속기관명',
  '연락처',
  '이메일',
  '문자발송상태',
  '이메일발송상태',
  '발송일시',
  '발송인',
  '발송연락처',
  '발송이메일',
  '수신인',
  '실제수신연락처',
  '실제수신이메일',
  '제목',
  '문자본문내용',
  '이메일본문내용',
  '수동발송확인', // 20261124 추가: AA열
  '수동확인일시', // 20261124 추가: AB열
]


// =======================================
// 4. 전달받은 값이 일반 객체인지 확인
// =======================================
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}


// =======================================
// 5. 로그 필드의 값을 문자열로 변환하고 예상하지 못한 자료형은 차단
// =======================================
function normalizeLogField(value: unknown, field: keyof LogRecord): string {
  if (value === null || value === undefined) return ''

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }

  throw new Error(`발송 로그 항목의 "${field}" 필드 데이터 형식이 올바르지 않습니다.`) // 20261120 추가
}


// =======================================
// 6. 로그 항목의 누락값과 필드 자료형 정규화
// =======================================
function normalizeLogRecord(value: unknown): LogRecord {
  if (!isRecord(value)) {
    throw new Error('발송 로그 항목의 데이터 형식이 올바르지 않습니다.')
  }

  const normalized = Object.fromEntries(
    LOG_FIELDS.map((field) => [field, normalizeLogField(value[field], field)]), // 20261120 수정
  )

  return normalized as LogRecord
}


// =======================================
// 7. 전체 발송 로그 조회
// =======================================
// 20261126 수정: refresh 옵션 추가, 서버 조회 시각(fetchedAt) 함께 반환
export type LogQueryResult = {
  records: LogRecord[]
  fetchedAt: string | null
}

export async function getLogs(
  { refresh = false }: { refresh?: boolean } = {},
): Promise<LogQueryResult> {
  const { data, fetchedAt } = await requestApiDataWithMeta<unknown>(createLogApiUrl('', refresh), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: API_CONFIG.LOG_TIMEOUT_MS,
    timeoutMessage: '발송 로그 조회 시간이 초과되었습니다.',
    networkErrorMessage:
      'Node.js API 서버에 연결할 수 없습니다. 서버 실행 주소와 CORS 설정을 확인해 주세요.',
    invalidResponseMessage: 'Node.js 로그 API 응답 형식이 올바르지 않습니다.',
    requestFailureMessage: '발송 로그 조회에 실패했습니다.',
  })

  if (!Array.isArray(data)) {
    throw new Error('발송 로그 API 응답의 data가 배열 형태가 아닙니다.')
  }

  return { records: data.map(normalizeLogRecord), fetchedAt }
}


// =======================================
// 8. 수동 발송 확인 상태 수정
// PATCH /api/logs/:id/manual-confirmation
// 20261124 추가
// =======================================
export async function updateManualConfirmation(
  id: string,
  confirmed: boolean,
): Promise<ManualConfirmationResult> {
  const normalizedId = String(id || '').trim()

  if (!normalizedId) {
    throw new Error('발송 로그 ID가 없어 수동 확인 상태를 변경할 수 없습니다.')
  }

  if (typeof confirmed !== 'boolean') {
    throw new Error('수동 확인 상태는 Boolean 값이어야 합니다.')
  }

  const data = await requestApiData<unknown>(
    createLogApiUrl(
      `/${encodeURIComponent(normalizedId)}/manual-confirmation`,
    ),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmed }),
      timeoutMs: API_CONFIG.LOG_TIMEOUT_MS,
      timeoutMessage: '수동 확인 상태 저장 시간이 초과되었습니다.',
      networkErrorMessage:
        'Node.js API 서버에 연결할 수 없습니다. 서버 실행 주소와 CORS 설정을 확인해 주세요.',
      invalidResponseMessage:
        '수동 확인 상태 수정 API 응답 형식이 올바르지 않습니다.',
      requestFailureMessage: '수동 확인 상태 저장에 실패했습니다.',
    },
  )

  if (!isRecord(data)) {
    throw new Error(
      '수동 확인 상태 수정 API의 data 형식이 올바르지 않습니다.',
    )
  }

  const updatedId = normalizeLogField(data.ID, 'ID')

  if (updatedId !== normalizedId) {
    throw new Error(
      '수정된 발송 로그 ID가 요청한 로그와 일치하지 않습니다.',
    )
  }
  return {
    ID: updatedId,
    수동발송확인: normalizeLogField(
      data.수동발송확인,
      '수동발송확인',
    ),
    수동확인일시: normalizeLogField(
      data.수동확인일시,
      '수동확인일시',
    ),
  }
}