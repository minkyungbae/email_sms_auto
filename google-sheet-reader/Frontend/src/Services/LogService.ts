/**
 * @file LogService.ts
 * @author 배민경
 * @created 2026-11-19
 * @updated 2026-11-20
 * @description 문자 및 이메일 발송 로그 조회
 *
 * 주요 기능:
 * - 전체 발송 로그 조회
 * - 발송 로그 항목의 객체 구조 검증
 * - 누락된 필드를 빈 문자열로 정규화
 * - 각 필드의 데이터 형식 검증
 * 
 * 20261120 수정: 공통 ApiClient 활용 및 필드값 정규화 보완
 */

import { API_CONFIG, createLogApiUrl } from '../Configs/api'
import { requestApiData } from './ApiClient'

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
}


// =======================================
// 2. 정규화할 로그 필드 목록
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
]


// =======================================
// 3. 전달받은 값이 일반 객체인지 확인
// =======================================
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}


// =======================================
// 4. 로그 필드의 값을 문자열로 변환하고 예상하지 못한 자료형은 차단
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
// 5. 로그 항목의 누락값과 필드 자료형 정규화
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
// 6. 전체 발송 로그 조회
// =======================================
export async function getLogs(): Promise<LogRecord[]> {
  const data = await requestApiData<unknown>(createLogApiUrl(), {
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

  return data.map(normalizeLogRecord)
}