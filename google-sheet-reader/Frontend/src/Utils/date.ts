/**
 * @file date.ts
 * @author 배민경
 * @created 2026-11-20
 * @updated 2026-11-20
 * @description 화면과 API에서 공통으로 사용하는 날짜 유틸리티.
 */

// 날짜 조회 기간의 시작일과 종료일 타입
export interface DateRange {
  startDate: string
  endDate: string
}

// Date 객체를 YYYY-MM-DD 형식의 문자열로 변환
export function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// 기준 날짜를 포함해 지정한 일수만큼의 조회 기간 생성
export function getRecentDateRange(
  days: number,
  referenceDate = new Date(),
): DateRange {
  const normalizedDays = Number.isFinite(days)
    ? Math.max(1, Math.floor(days))
    : 1

  const endDate = new Date(referenceDate)
  const startDate = new Date(referenceDate)

  startDate.setDate(startDate.getDate() - normalizedDays + 1)

  return {
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate),
  }
}

// 구글 시트 및 API 날짜 문자열을 YYYY-MM-DD 형식으로 통일
export function normalizeDateValue(
  value: string | null | undefined,
): string {
  const normalizedValue = String(value ?? '').trim()

  const match = normalizedValue.match(
    /^(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})(?=$|[^\d])/, // 20261120 수정
  )

  if (!match) return ''

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  // 실제 달력에 존재하는 날짜인지 검증
  const parsedDate = new Date(Date.UTC(year, month - 1, day))

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return ''
  }

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}