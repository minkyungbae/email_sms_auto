/**
 * @file operationFormat.ts
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 운영 데이터 화면용 값 변환 (시트 표시 문자열 → 숫자·날짜)
 */

/**
 * 시트 표시 값 → 숫자. 숫자가 아니면 null
 * - 쉼표·공백 제거, 앞뒤 단위·기호 무시 ("₩1,000", "20명", "3차시", "4.0km", "12개")
 * - 비율은 0~1 ("30%" → 0.3)
 * 20261126 수정: "명"·"차시" 등 셀 서식 단위가 붙은 값도 숫자로 인식
 */
export function toNumber(value: unknown): number | null {
  const text = String(value ?? '').replace(/[,\s]/g, '')
  const match = text.match(/^[^\d+\-.]*([+-]?\d+(?:\.\d+)?|[+-]?\.\d+)(%?)[^\d]*$/)

  if (!match) return null

  const number = Number(match[1])
  if (!Number.isFinite(number)) return null

  return match[2] === '%' ? number / 100 : number
}

export function sumBy<T>(rows: T[], pick: (row: T) => unknown): number {
  return rows.reduce((total, row) => total + (toNumber(pick(row)) ?? 0), 0)
}

export function formatNumber(value: number | null): string {
  if (value === null) return '-'
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value)
}

export function formatWon(value: number | null): string {
  if (value === null) return '-'
  return `${new Intl.NumberFormat('ko-KR').format(Math.round(value))}원`
}

/** 체크박스 표시 값 */
export function isChecked(value: unknown): boolean {
  return ['TRUE', 'true', '✓', 'O', 'Y'].includes(String(value ?? '').trim())
}

/**
 * 시트 날짜 표시 값 → { iso: "YYYY-MM-DD", month: "YYYY-MM" }
 * 지원: "2026. 10. 7" / "2026-10-07" / "2026/10/07" / "261007"(YYMMDD)
 */
export function parseSheetDate(value: unknown): { iso: string; month: string } | null {
  const text = String(value ?? '').replace(/,/g, '').trim()
  if (!text) return null

  let year: number
  let month: number
  let day: number

  const full = text.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/)
  const short = text.match(/^(\d{2})(\d{2})(\d{2})$/)

  if (full) {
    year = Number(full[1])
    month = Number(full[2])
    day = Number(full[3])
  } else if (short) {
    year = 2000 + Number(short[1])
    month = Number(short[2])
    day = Number(short[3])
  } else {
    return null
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')

  return { iso: `${year}-${mm}-${dd}`, month: `${year}-${mm}` }
}

/** 날짜 표시용: "2026-10-07" → "2026. 10. 7." 원문이 날짜가 아니면 원문 그대로 */
export function formatSheetDate(value: unknown): string {
  const parsed = parseSheetDate(value)
  if (!parsed) return String(value ?? '')

  const [year, month, day] = parsed.iso.split('-').map(Number)
  return `${year}. ${month}. ${day}.`
}

export function formatMonthLabel(month: string): string {
  const [year, mm] = month.split('-')
  return `${year}년 ${Number(mm)}월`
}

export function formatFetchedAt(value: string): string {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** 목록에서 고유값 (빈 값 제외, 가나다순) */
export function uniqueValues<T>(rows: T[], pick: (row: T) => unknown): string[] {
  return Array.from(new Set(rows.map((row) => String(pick(row) ?? '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'ko'))
}

/** 여러 필드에 검색어가 포함되는지 (대소문자·공백 무시) */
export function matchesKeyword(values: unknown[], keyword: string): boolean {
  const target = keyword.replace(/\s+/g, '').toLowerCase()
  if (!target) return true

  return values.some((value) => String(value ?? '').replace(/\s+/g, '').toLowerCase().includes(target))
}
