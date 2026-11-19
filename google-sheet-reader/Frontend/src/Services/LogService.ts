/**
 * @file LogService.ts
 * @author 배민경
 * @created 2026-11-19
 * @description
 * React에서 Node.js 로그 조회 API를 호출하고 응답을 검증
 *
 * 주요 기능:
 * - 전체 발송 로그 조회
 * - API 응답 검증
 * - 요청 시간 초과 처리
 * - 네트워크 오류 처리
 */


import {
  API_CONFIG,
  createLogApiUrl,
} from '../Configs/api'


// =============================================================
// 1. 발송 로그 타입
// =============================================================
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


// =============================================================
// 2. API 응답 타입
// =============================================================
type LogApiResponse = {
  success: boolean
  data: LogRecord[] | null
  message: string | null
  count?: number
}


// =============================================================
// 3. 객체 유효성 검사
// =============================================================
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}


// =============================================================
// 4. API 응답 파싱
// =============================================================
function parseLogApiResponse(value: unknown): LogApiResponse {

  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('발송 로그 API 응답 형식이 올바르지 않습니다.')
  }

  return {
    success: value.success,
    data: (value.data ?? null) as LogRecord[] | null,
    message: typeof value.message === 'string' ? value.message : null,
    count: typeof value.count === 'number' ? value.count : undefined,
  }
}


// =============================================================
// 5. 전체 발송 로그 조회
// GET /api/logs
// =============================================================
export async function getLogs(): Promise<LogRecord[]> {

  const url = createLogApiUrl()
  const controller = new AbortController()

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    API_CONFIG.LOG_TIMEOUT_MS,
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
      throw new Error('Node.js 로그 API가 JSON 형식이 아닌 응답을 반환했습니다.')
    }

    const result = parseLogApiResponse(parsedBody)

    if (!response.ok) {
      throw new Error(
        result.message || `발송 로그 API 요청 실패 (HTTP ${response.status})`,
      )
    }

    if (!result.success) {
      throw new Error(result.message || '발송 로그 조회에 실패했습니다.')
    }

    if (!Array.isArray(result.data)) {
      throw new Error('발송 로그 API 응답의 data가 배열 형태가 아닙니다.')
    }

    return result.data

  } catch (error) {

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        '발송 로그 조회 시간이 초과되었습니다.',
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
          '발송 로그 조회 중 알 수 없는 오류가 발생했습니다.',
          { cause: error },
        )

  } finally {
    window.clearTimeout(timeoutId)
  }
}