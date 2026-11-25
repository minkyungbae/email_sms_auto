/**
 * @file performanceStats.ts
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 교육 실적 현황(수료실적_RAW) 집계 함수
 *
 * 집계 기준 (수료실적_RAW 시트 컬럼):
 * - 연도       : W 활동연도 (없으면 V 교육종료일 → U 교육시작일의 연도)
 * - 월         : B 종료월 (없으면 V 교육종료일의 월)
 * - 지역       : D 지역
 * - 수요처(개) : E 수요처명 중복 제외 개수
 * - 수요처유형 : G 학교 구분
 * - 교육유형   : H 근무유형 (20261125 수정: I 교육유형 → H 근무유형)
 * - 교육차시   : Q 교육시간(교시) 합계
 * - 수료인원   : AN 종료수료인원(총) 합계
 * - N차시 이상 : Q 교육시간(교시)이 N 이상인 행의 AN 합계
 */

import type { PerformanceRecord } from '../Types/performance'

// =======================================
// 1. 집계용 행 타입
// =======================================
export type PerformanceRow = {
  year: number | null
  month: number | null // 1 ~ 12
  region: string
  demand: string // 수요처명
  demandType: string // 학교 구분
  eduType: string // 교육 유형 (H열 근무유형 값)
  hours: number // 교육시간(교시)
  completed: number // 종료수료인원(총)
}

const UNSPECIFIED = '미지정'

// 화면 표시 순서 (목록에 없는 값은 가나다순으로 뒤에 표시)
const REGION_ORDER = ['강릉', '원주', '춘천']
const DEMAND_TYPE_ORDER = ['초등학교', '중학교', '고등학교', '아동센터', '기타']
// 20261125 수정: 교육 유형이 H열(근무유형) 값으로 바뀌어 기존 I열 순서는 제거 (지정하지 않으면 가나다순)
const EDU_TYPE_ORDER: string[] = []

// =======================================
// 2. 값 변환 함수
// =======================================
/** "1,234", " 12 ", "8.5" → 숫자 / 변환 불가 시 0 */
export function parseNumber(value: string): number {
  const cleaned = String(value ?? '').replace(/[,\s명회교시]/g, '')
  const parsed = Number.parseFloat(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

function parseYearFrom(value: string): number | null {
  const match = String(value ?? '').match(/(20\d{2})/)
  return match ? Number(match[1]) : null
}

/** "2026-07-31", "2026. 7. 31", "2026/07" 형식에서 월 추출 */
function parseMonthFromDate(value: string): number | null {
  const match = String(value ?? '').match(/20\d{2}\s*[-./년]\s*(\d{1,2})/)
  if (!match) return null

  const month = Number(match[1])
  return month >= 1 && month <= 12 ? month : null
}

/** 종료월: "7월", "07", "7", "2026-07", "2026. 7. 31" 모두 지원 */
export function parseMonth(value: string): number | null {
  const fromDate = parseMonthFromDate(value)
  if (fromDate) return fromDate

  const match = String(value ?? '').match(/(\d{1,2})/)
  if (!match) return null

  const month = Number(match[1])
  return month >= 1 && month <= 12 ? month : null
}

export function toPerformanceRow(record: PerformanceRecord): PerformanceRow {
  return {
    year:
      parseYearFrom(record['활동연도']) ??
      parseYearFrom(record['교육종료일']) ??
      parseYearFrom(record['교육시작일']),
    month: parseMonth(record['종료월']) ?? parseMonthFromDate(record['교육종료일']),
    region: record['지역'].trim() || UNSPECIFIED,
    demand: record['수요처명'].trim(),
    demandType: record['학교 구분'].trim() || UNSPECIFIED,
    eduType: record['근무유형'].trim() || UNSPECIFIED, // 20261125 수정: I열 교육유형 → H열 근무유형
    hours: parseNumber(record['교육시간 (교시)']),
    completed: parseNumber(record['종료수료인원(총)']),
  }
}

// =======================================
// 3. 정렬 함수
// =======================================
function orderValues(values: Iterable<string>, preferred: string[]): string[] {
  const unique = [...new Set(values)]

  return unique.sort((first, second) => {
    const firstIndex = preferred.indexOf(first)
    const secondIndex = preferred.indexOf(second)

    if (first === UNSPECIFIED) return 1
    if (second === UNSPECIFIED) return -1
    if (firstIndex >= 0 && secondIndex >= 0) return firstIndex - secondIndex
    if (firstIndex >= 0) return -1
    if (secondIndex >= 0) return 1

    return first.localeCompare(second, 'ko')
  })
}

export function getRegions(rows: PerformanceRow[]): string[] {
  return orderValues(rows.map((row) => row.region), REGION_ORDER)
}

export function getEduTypes(rows: PerformanceRow[]): string[] {
  return orderValues(rows.map((row) => row.eduType), EDU_TYPE_ORDER)
}

export function getDemandTypes(rows: PerformanceRow[]): string[] {
  return orderValues(rows.map((row) => row.demandType), DEMAND_TYPE_ORDER)
}

/** 데이터에 있는 연도 (최신순) */
export function getYears(rows: PerformanceRow[]): number[] {
  return [...new Set(rows.map((row) => row.year).filter((year): year is number => year !== null))]
    .sort((first, second) => second - first)
}

/** 데이터가 있는 마지막 월 (없으면 null) */
export function getLatestMonth(rows: PerformanceRow[]): number | null {
  const months = rows.map((row) => row.month).filter((month): month is number => month !== null)
  return months.length > 0 ? Math.max(...months) : null
}

// =======================================
// 4. 지역별 실적 요약 (연간 전체 / 월 누적)
// =======================================
export type RegionSummary = {
  region: string
  demandCount: number // 수요처(개)
  hours: number // 교육차시
  completed: number // 전체 수료인원
  over4: number // 4차시 이상 수료인원
  over8: number // 8차시 이상 수료인원
  over50: number // 50차시 이상 수료인원
}

function summarize(region: string, rows: PerformanceRow[]): RegionSummary {
  const demands = new Set(rows.map((row) => row.demand).filter(Boolean))

  return rows.reduce<RegionSummary>(
    (summary, row) => ({
      ...summary,
      hours: summary.hours + row.hours,
      completed: summary.completed + row.completed,
      over4: summary.over4 + (row.hours >= 4 ? row.completed : 0),
      over8: summary.over8 + (row.hours >= 8 ? row.completed : 0),
      over50: summary.over50 + (row.hours >= 50 ? row.completed : 0),
    }),
    { region, demandCount: demands.size, hours: 0, completed: 0, over4: 0, over8: 0, over50: 0 },
  )
}

/** 20261125 추가: 지역 구분 없이 수요처명 중복 제외 개수 (실적 요약 설명용) */
export function countUniqueDemands(rows: PerformanceRow[]): number {
  return new Set(rows.map((row) => row.demand).filter(Boolean)).size
}

/** 지역별 요약 + 총 합계 (총 합계 수요처는 지역별 수요처 합) */
export function summarizeByRegion(
  rows: PerformanceRow[],
  regions: string[],
): { items: RegionSummary[]; total: RegionSummary } {
  const items = regions.map((region) =>
    summarize(region, rows.filter((row) => row.region === region)),
  )

  const total = items.reduce<RegionSummary>(
    (sum, item) => ({
      region: '총 합계',
      demandCount: sum.demandCount + item.demandCount,
      hours: sum.hours + item.hours,
      completed: sum.completed + item.completed,
      over4: sum.over4 + item.over4,
      over8: sum.over8 + item.over8,
      over50: sum.over50 + item.over50,
    }),
    { region: '총 합계', demandCount: 0, hours: 0, completed: 0, over4: 0, over8: 0, over50: 0 },
  )

  return { items, total }
}

// =======================================
// 5. 수요처유형별 수요처 수 (지역 × 학교 구분)
// =======================================
export function countDemandByType(
  rows: PerformanceRow[],
  regions: string[],
  types: string[],
): { matrix: Record<string, Record<string, number>>; rowTotals: Record<string, number>; columnTotals: Record<string, number>; total: number } {
  const matrix: Record<string, Record<string, number>> = {}
  const rowTotals: Record<string, number> = {}
  const columnTotals: Record<string, number> = Object.fromEntries(types.map((type) => [type, 0]))

  regions.forEach((region) => {
    matrix[region] = {}
    rowTotals[region] = 0

    types.forEach((type) => {
      const count = new Set(
        rows
          .filter((row) => row.region === region && row.demandType === type && row.demand)
          .map((row) => row.demand),
      ).size

      matrix[region][type] = count
      rowTotals[region] += count
      columnTotals[type] += count
    })
  })

  return {
    matrix,
    rowTotals,
    columnTotals,
    total: Object.values(rowTotals).reduce((sum, value) => sum + value, 0),
  }
}

// =======================================
// 6. 교육 유형별 교육 차시·수료 인원 (지역 × 근무유형)
// =======================================
export type HoursAndCompleted = { hours: number; completed: number }

export function sumByEduType(
  rows: PerformanceRow[],
  regions: string[],
  types: string[],
): { matrix: Record<string, Record<string, HoursAndCompleted>>; totals: Record<string, HoursAndCompleted>; completedTotal: number } {
  const empty = (): HoursAndCompleted => ({ hours: 0, completed: 0 })
  const matrix: Record<string, Record<string, HoursAndCompleted>> = {}
  const totals: Record<string, HoursAndCompleted> = Object.fromEntries(types.map((type) => [type, empty()]))

  regions.forEach((region) => {
    matrix[region] = Object.fromEntries(types.map((type) => [type, empty()]))
  })

  rows.forEach((row) => {
    const cell = matrix[row.region]?.[row.eduType]
    const total = totals[row.eduType]

    if (!cell || !total) return

    cell.hours += row.hours
    cell.completed += row.completed
    total.hours += row.hours
    total.completed += row.completed
  })

  return {
    matrix,
    totals,
    completedTotal: Object.values(totals).reduce((sum, value) => sum + value.completed, 0),
  }
}

// =======================================
// 7. 교육차시 구간별 교육차시 합계
// 단기 1~3차시 이하 / 중기 4~8 미만 · 8~30 미만 · 30~50 미만 / 장기 50 이상
// =======================================
export const HOUR_BUCKETS = [
  { key: 'short', group: '단기 교육', label: '1~3차시 이하', match: (hours: number) => hours < 4 },
  { key: 'mid1', group: '중기 교육', label: '4~8차시 미만', match: (hours: number) => hours >= 4 && hours < 8 },
  { key: 'mid2', group: '중기 교육', label: '8~30차시 미만', match: (hours: number) => hours >= 8 && hours < 30 },
  { key: 'mid3', group: '중기 교육', label: '30~50차시 미만', match: (hours: number) => hours >= 30 && hours < 50 },
  { key: 'long', group: '장기 교육', label: '50차시 이상', match: (hours: number) => hours >= 50 },
] as const

export type HourBucketKey = (typeof HOUR_BUCKETS)[number]['key']

export function sumHourBuckets(rows: PerformanceRow[]): Record<HourBucketKey, number> & { total: number } {
  const result = { short: 0, mid1: 0, mid2: 0, mid3: 0, long: 0, total: 0 }

  rows.forEach((row) => {
    const bucket = HOUR_BUCKETS.find((item) => item.match(row.hours))
    if (!bucket || row.hours <= 0) return

    result[bucket.key] += row.hours
    result.total += row.hours
  })

  return result
}

// =======================================
// 8. 월별 수료인원 및 목표 달성률
// =======================================
export type MonthlyProgress = {
  month: number
  completed: number
  cumulative: number
  rate: number // 0 ~ (1 이상 가능)
  over8: number
  cumulative8: number
  rate8: number
}

export function getMonthlyProgress(
  rows: PerformanceRow[],
  target: number,
  target8: number,
): MonthlyProgress[] {
  let cumulative = 0
  let cumulative8 = 0

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const monthRows = rows.filter((row) => row.month === month)

    const completed = monthRows.reduce((sum, row) => sum + row.completed, 0)
    const over8 = monthRows.reduce((sum, row) => sum + (row.hours >= 8 ? row.completed : 0), 0)

    cumulative += completed
    cumulative8 += over8

    return {
      month,
      completed,
      cumulative,
      rate: target > 0 ? cumulative / target : 0,
      over8,
      cumulative8,
      rate8: target8 > 0 ? cumulative8 / target8 : 0,
    }
  })
}

// =======================================
// 9. 표시 형식
// =======================================
const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 })

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}