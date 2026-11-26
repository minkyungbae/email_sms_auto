/**
 * @file ApiClient.ts
 * @created 2026-11-20
 * @updated 2026-11-26
 * @description 프론트엔드 API 요청, 응답 검증, 타임아웃 및 네트워크 오류 처리를 공통화.
 * 
 * 주요 기능:
 * - 서버에 요청 보내기
 * - 서버 응답 받기
 * - JSON 변환하기
 * - HTTP 오류 확인하기
 * - 응답 데이터 검증하기
 * - 요청 시간 초과 처리하기
 * - 네트워크 오류 처리하기
 *
 * 20261126 추가: 서버 캐시 데이터의 조회 시각(meta.fetchedAt)을 함께 반환하는 requestApiDataWithMeta
 */


// =======================================
// 1. API 요청에 필요한 옵션 타입 정의
// =======================================
type ApiClientOptions = RequestInit & {
  timeoutMs: number
  timeoutMessage: string
  networkErrorMessage: string
  invalidResponseMessage: string
  requestFailureMessage: string
}


// =======================================
// 2. 전달받은 값이 일반 객체인지 확인
// =======================================
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}


// =======================================
// 3. 공통 API 요청 함수
// =======================================
// 20261126 추가: 데이터와 서버 조회 시각을 함께 반환
export type ApiDataWithMeta<T> = {
  data: T
  fetchedAt: string | null // 서버가 시트를 조회한 시각 (ISO 문자열)
}

export async function requestApiData<T>(
  url: URL,
  options: ApiClientOptions,
): Promise<T> {
  const { data } = await requestApiDataWithMeta<T>(url, options)
  return data
}

export async function requestApiDataWithMeta<T>(
  url: URL,
  options: ApiClientOptions,
): Promise<ApiDataWithMeta<T>> {
  const {
    timeoutMs,
    timeoutMessage,
    networkErrorMessage,
    invalidResponseMessage,
    requestFailureMessage,
    ...requestOptions
  } = options

  // 3-1. 요청 시간 제한 설정
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    // 3-2. 백엔드 API 요청
    const response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal,
    })

    // 3-3. 서버 응답을 문자열로 읽기
    const responseText = await response.text()
    let payload: unknown

    // 3-4. JSON 형식으로 변환
    try {
      payload = JSON.parse(responseText)
    } catch {
      const statusMessage = response.ok ? '' : ` (HTTP ${response.status})`
      throw new Error(`${invalidResponseMessage}${statusMessage}`)
    }

    // 3-5. 응답 데이터의 기본 구조 검증
    if (!isRecord(payload) || typeof payload.success !== 'boolean') {
      throw new Error(`${invalidResponseMessage} (HTTP ${response.status})`)
    }

    // 3-6. 서버에서 전달한 메시지 확인
    const message = typeof payload.message === 'string'
      ? payload.message
      : ''

    // 3-7. HTTP 오류 또는 API 처리 실패 확인
    if (!response.ok || !payload.success) {
      throw new Error(
        message || `${requestFailureMessage} (HTTP ${response.status})`,
      )
    }

    // 3-8. 정상 응답 데이터 반환
    // 20261126 수정: 서버 캐시 메타 정보(조회 시각) 함께 반환
    const meta = isRecord(payload.meta) ? payload.meta : null

    return {
      data: payload.data as T,
      fetchedAt: meta && typeof meta.fetchedAt === 'string' ? meta.fetchedAt : null,
    }
  } catch (error) {
    // 20261125 추가: 원래 오류를 브라우저 콘솔에 남김 (화면에는 안내 메시지만 표시되므로)
    console.error(`[ApiClient] ${requestOptions.method ?? 'GET'} ${url.toString()} 요청 실패:`, error)

    // 3-9. 요청 시간 초과 처리
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(timeoutMessage, { cause: error })
    }

    // 3-10. 네트워크 연결 오류 처리
    if (error instanceof TypeError) {
      throw new Error(networkErrorMessage, { cause: error })
    }

    // 그 외 오류 처리
    throw error instanceof Error
      ? error
      : new Error('API 요청 중 알 수 없는 오류가 발생했습니다.', { cause: error })
  } finally {
    window.clearTimeout(timeoutId)
  }
}