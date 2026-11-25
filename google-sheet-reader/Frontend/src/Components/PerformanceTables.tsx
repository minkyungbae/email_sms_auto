/**
 * @file PerformanceTables.tsx
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 교육 실적 현황 화면의 집계 표 (스프레드시트 현황표 구성 반영)
 *
 * - RegionSummaryTable : 연간 전체 (연 누적 / 월 누적), 월별 전체의 월×지역 표
 * - DemandTypeTable    : 연간 수요처 유형별
 * - EduTypeTable       : 연간 교육 유형별 (총 누적 / 월 누적)
 * - HourBucketTable    : 연간 교육 차시별 (총 누적 / 월 누적 / 월별)
 * - MonthlyGoalTable   : 월별 전체 (월 누적 목표 달성률)
 *
 * 20261125 수정: 표 문구 띄어쓰기 정리, '년도' → '연도'
 */

import type { ReactNode } from 'react'

import {
  HOUR_BUCKETS,
  formatNumber,
  formatPercent,
} from '../Utils/performanceStats'
import type {
  HourBucketKey,
  HoursAndCompleted,
  MonthlyProgress,
  RegionSummary,
} from '../Utils/performanceStats'

// =======================================
// 1. 공통 요소
// =======================================
function formatMonth(month: number): string {
  return `${String(month).padStart(2, '0')}월`
}

/** 월 선택 (표 안의 월 칸에 표시) */
export function MonthSelect({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (month: number) => void
  label: string
}) {
  return (
    <select
      className="perf-month-select"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
    >
      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
        <option key={month} value={month}>
          {formatMonth(month)}
        </option>
      ))}
    </select>
  )
}

/** 표 제목 아래 소제목 (◎ 연 누적 등) */
export function TableCaption({ children }: { children: ReactNode }) {
  return <p className="perf-table-caption">◎ {children}</p>
}

// =======================================
// 2. 지역별 실적 요약 표
// 연간 전체(연/월 누적) 및 월별 전체 표에서 공통 사용
// =======================================
const SUMMARY_COLUMNS: { key: keyof Omit<RegionSummary, 'region'>; label: string }[] = [
  { key: 'demandCount', label: '수요처(개)' },
  { key: 'hours', label: '교육 차시' },
  { key: 'completed', label: '전체 수료 인원' },
  { key: 'over4', label: '4차시 이상 수료 인원' },
  { key: 'over8', label: '8차시 이상 수료 인원' },
  { key: 'over50', label: '50차시 이상 수료 인원' },
]

function SummaryRows({
  periodCell,
  items,
  total,
}: {
  periodCell: ReactNode
  items: RegionSummary[]
  total: RegionSummary
}) {
  return (
    <>
      {items.map((item, index) => (
        <tr key={item.region}>
          {index === 0 && (
            <th scope="rowgroup" rowSpan={items.length} className="perf-period-cell">
              {periodCell}
            </th>
          )}
          <td className="perf-label-cell">{item.region}</td>
          {SUMMARY_COLUMNS.map((column) => (
            <td key={column.key}>{formatNumber(item[column.key])}</td>
          ))}
        </tr>
      ))}

      <tr className="perf-total-row">
        <th scope="row" colSpan={2}>총 합계</th>
        {SUMMARY_COLUMNS.map((column) => (
          <td key={column.key}>{formatNumber(total[column.key])}</td>
        ))}
      </tr>
    </>
  )
}

export function RegionSummaryTable({
  periodLabel,
  periodCell,
  items,
  total,
}: {
  periodLabel: string
  periodCell: ReactNode
  items: RegionSummary[]
  total: RegionSummary
}) {
  return (
    <div className="perf-table-scroll">
      <table className="perf-table">
        <thead>
          <tr>
            <th scope="col">{periodLabel}</th>
            <th scope="col">지역</th>
            {SUMMARY_COLUMNS.map((column) => (
              <th key={column.key} scope="col">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={8} className="perf-empty-cell">
                {periodCell}
                <span>해당 기간의 수료 실적이 없습니다.</span>
              </td>
            </tr>
          ) : (
            <SummaryRows periodCell={periodCell} items={items} total={total} />
          )}
        </tbody>
      </table>
    </div>
  )
}

/** 월별 전체: 1~12월 × 지역 */
export function MonthlyRegionTable({
  months,
}: {
  months: { month: number; items: RegionSummary[]; total: RegionSummary }[]
}) {
  return (
    <div className="perf-table-scroll">
      <table className="perf-table">
        <thead>
          <tr>
            <th scope="col">월</th>
            <th scope="col">지역</th>
            {SUMMARY_COLUMNS.map((column) => (
              <th key={column.key} scope="col">{column.label}</th>
            ))}
          </tr>
        </thead>
        {months.map(({ month, items, total }) => (
          <tbody key={month} className="perf-month-group">
            <SummaryRows periodCell={formatMonth(month)} items={items} total={total} />
          </tbody>
        ))}
      </table>
    </div>
  )
}

// =======================================
// 3. 연간 수요처 유형별 표
// =======================================
export function DemandTypeTable({
  yearLabel,
  regions,
  types,
  matrix,
  rowTotals,
  columnTotals,
  total,
}: {
  yearLabel: string
  regions: string[]
  types: string[]
  matrix: Record<string, Record<string, number>>
  rowTotals: Record<string, number>
  columnTotals: Record<string, number>
  total: number
}) {
  return (
    <div className="perf-table-scroll">
      <table className="perf-table">
        <thead>
          <tr>
            <th scope="col">연도</th>
            <th scope="col">지역</th>
            {types.map((type) => (
              <th key={type} scope="col">{type}</th>
            ))}
            <th scope="col">총 합계</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((region, index) => (
            <tr key={region}>
              {index === 0 && (
                <th scope="rowgroup" rowSpan={regions.length} className="perf-period-cell">
                  {yearLabel}
                </th>
              )}
              <td className="perf-label-cell">{region}</td>
              {types.map((type) => (
                <td key={type}>{matrix[region]?.[type] ? formatNumber(matrix[region][type]) : ''}</td>
              ))}
              <td className="perf-strong-cell">{formatNumber(rowTotals[region] ?? 0)}</td>
            </tr>
          ))}

          <tr className="perf-total-row">
            <th scope="row" colSpan={2}>총 합계</th>
            {types.map((type) => (
              <td key={type}>{formatNumber(columnTotals[type] ?? 0)}</td>
            ))}
            <td>{formatNumber(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// =======================================
// 4. 연간 교육 유형별 표 (교육 차시 / 수료 인원)
// =======================================
export function EduTypeTable({
  periodLabel,
  periodCell,
  regions,
  types,
  matrix,
  totals,
  completedTotal,
}: {
  periodLabel: string | null // null 이면 기간 열 없이 지역부터 표시
  periodCell: ReactNode
  regions: string[]
  types: string[]
  matrix: Record<string, Record<string, HoursAndCompleted>>
  totals: Record<string, HoursAndCompleted>
  completedTotal: number
}) {
  const hasPeriod = periodLabel !== null

  return (
    <div className="perf-table-scroll">
      <table className="perf-table">
        <thead>
          <tr>
            {hasPeriod && <th scope="col" rowSpan={2}>{periodLabel}</th>}
            <th scope="col" rowSpan={2}>지역</th>
            {types.map((type) => (
              <th key={type} scope="colgroup" colSpan={2}>{type}</th>
            ))}
            <th scope="col" rowSpan={2}>전체 수료 인원</th>
          </tr>
          <tr>
            {types.map((type) => (
              <FragmentHeaders key={type} />
            ))}
          </tr>
        </thead>
        <tbody>
          {regions.map((region, index) => {
            const regionCompleted = types.reduce(
              (sum, type) => sum + (matrix[region]?.[type]?.completed ?? 0),
              0,
            )

            return (
              <tr key={region}>
                {hasPeriod && index === 0 && (
                  <th scope="rowgroup" rowSpan={regions.length} className="perf-period-cell">
                    {periodCell}
                  </th>
                )}
                <td className="perf-label-cell">{region}</td>
                {types.map((type) => (
                  <CellPair key={type} value={matrix[region]?.[type]} />
                ))}
                <td className="perf-strong-cell">{formatNumber(regionCompleted)}</td>
              </tr>
            )
          })}

          <tr className="perf-total-row">
            <th scope="row" colSpan={hasPeriod ? 2 : 1}>총 합계</th>
            {types.map((type) => (
              <CellPair key={type} value={totals[type]} />
            ))}
            <td>{formatNumber(completedTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function FragmentHeaders() {
  return (
    <>
      <th scope="col" className="perf-sub-header">교육 차시</th>
      <th scope="col" className="perf-sub-header">수료 인원</th>
    </>
  )
}

function CellPair({ value }: { value: HoursAndCompleted | undefined }) {
  return (
    <>
      <td>{formatNumber(value?.hours ?? 0)}</td>
      <td>{formatNumber(value?.completed ?? 0)}</td>
    </>
  )
}

// =======================================
// 5. 연간 교육 차시별 표
// =======================================
type BucketValues = Record<HourBucketKey, number> & { total: number }

function BucketHeader({ firstLabel }: { firstLabel: string }) {
  return (
    <thead>
      <tr>
        <th scope="col" rowSpan={2}>{firstLabel}</th>
        <th scope="colgroup" colSpan={1}>단기 교육</th>
        <th scope="colgroup" colSpan={3}>중기 교육</th>
        <th scope="colgroup" colSpan={1}>장기 교육</th>
        <th scope="col" rowSpan={2}>총 합계</th>
      </tr>
      <tr>
        {HOUR_BUCKETS.map((bucket) => (
          <th key={bucket.key} scope="col" className="perf-sub-header">{bucket.label}</th>
        ))}
      </tr>
    </thead>
  )
}

function BucketCells({ values }: { values: BucketValues }) {
  return (
    <>
      {HOUR_BUCKETS.map((bucket) => (
        <td key={bucket.key}>{formatNumber(values[bucket.key])}</td>
      ))}
      <td className="perf-strong-cell">{formatNumber(values.total)}</td>
    </>
  )
}

export function HourBucketTable({
  firstLabel,
  firstCell,
  values,
}: {
  firstLabel: string
  firstCell: ReactNode
  values: BucketValues
}) {
  return (
    <div className="perf-table-scroll">
      <table className="perf-table">
        <BucketHeader firstLabel={firstLabel} />
        <tbody>
          <tr>
            <th scope="row" className="perf-period-cell">{firstCell}</th>
            <BucketCells values={values} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function MonthlyBucketTable({
  months,
  total,
}: {
  months: { month: number; values: BucketValues }[]
  total: BucketValues
}) {
  return (
    <div className="perf-table-scroll">
      <table className="perf-table">
        <BucketHeader firstLabel="월" />
        <tbody>
          {months.map(({ month, values }) => (
            <tr key={month}>
              <th scope="row" className="perf-period-cell">{formatMonth(month)}</th>
              <BucketCells values={values} />
            </tr>
          ))}
          <tr className="perf-total-row">
            <th scope="row">총 합계</th>
            <BucketCells values={total} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// =======================================
// 6. 월별 전체 - 월 누적 목표 달성 표
// =======================================
export function MonthlyGoalTable({
  progress,
  target,
  target8,
}: {
  progress: MonthlyProgress[]
  target: number
  target8: number
}) {
  const last = progress[progress.length - 1]
  const total = last?.cumulative ?? 0
  const total8 = last?.cumulative8 ?? 0

  const remain = target - total
  const remain8 = target8 - total8

  return (
    <div className="perf-table-scroll">
      <table className="perf-table">
        <thead>
          <tr>
            <th scope="col">월</th>
            <th scope="col">전체 수료 인원</th>
            <th scope="col">연간 누적 인원</th>
            <th scope="col">목표 달성률</th>
            <th scope="col" className="perf-divider-cell">8차시 이상 수료 인원</th>
            <th scope="col">연간 누적 인원</th>
            <th scope="col">목표 달성률</th>
          </tr>
        </thead>
        <tbody>
          {progress.map((item) => (
            <tr key={item.month}>
              <th scope="row" className="perf-period-cell">{item.month}월</th>
              <td>{formatNumber(item.completed)}</td>
              <td>{formatNumber(item.cumulative)}</td>
              <td>
                <RateCell rate={item.rate} />
              </td>
              <td className="perf-divider-cell">{formatNumber(item.over8)}</td>
              <td>{formatNumber(item.cumulative8)}</td>
              <td>
                <RateCell rate={item.rate8} />
              </td>
            </tr>
          ))}

          <tr className="perf-total-row">
            <th scope="row">목표 인원</th>
            <td>{formatNumber(target)}</td>
            <td />
            <td />
            <td className="perf-divider-cell">{formatNumber(target8)}</td>
            <td />
            <td />
          </tr>
          <tr className="perf-total-row">
            <th scope="row">수료 인원</th>
            <td>{formatNumber(total)}</td>
            <td>{target > 0 ? formatPercent(total / target) : '-'}</td>
            <td />
            <td className="perf-divider-cell">{formatNumber(total8)}</td>
            <td>{target8 > 0 ? formatPercent(total8 / target8) : '-'}</td>
            <td />
          </tr>
          <tr className="perf-total-row">
            <th scope="row">잔여 인원</th>
            <td>{formatNumber(remain)}</td>
            <td>{target > 0 ? formatPercent(remain / target) : '-'}</td>
            <td />
            <td className="perf-divider-cell">{formatNumber(remain8)}</td>
            <td>{target8 > 0 ? formatPercent(remain8 / target8) : '-'}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/** 달성률 + 작은 진행 막대 */
function RateCell({ rate }: { rate: number }) {
  return (
    <span className="perf-rate">
      <span className="perf-rate-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(rate, 1) * 100}%` }} />
      </span>
      {formatPercent(rate)}
    </span>
  )
}
