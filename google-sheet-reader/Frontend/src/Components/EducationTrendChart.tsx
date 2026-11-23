/**
 * @file EducationTrendChart.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-20
 * @description 대시보드에서 조회한 GW·DS 교육 데이터를 이용해 운영 추이를 시각화.
 *
 * 주요 기능:
 * - 최근 7일 및 30일 교육 운영 추이 조회
 * - GW·DS 일별 교육 건수 집계
 * - SVG 차트 생성
 * - 사업별 데이터 연결 상태 표시
 *
 * 20261120 수정: 날짜 처리 및 일별 데이터 집계 로직 공통화
 */

import { useMemo, useState } from 'react'
import type { EducationRecord } from '../Types/education'
import { formatIsoDate, normalizeDateValue } from '../Utils/date'

// =======================================
// 1. 차트 기본 크기 및 표시 영역
// 20261123 수정: 전체 너비 확장에 따른 SVG 좌표계 조정
// =======================================
const CHART_WIDTH = 1120
const CHART_HEIGHT = 368

const PLOT_LEFT = 84
const PLOT_RIGHT = 1096
const PLOT_TOP = 28
const PLOT_BOTTOM = 290

// =======================================
// 2. 차트 조회 기간 및 API 상태 타입
// =======================================
type TrendPeriod = 7 | 30
type ApiStatus = 'loading' | 'connected' | 'error'
type CountKey = 'gw' | 'ds'

// =======================================
// 3. 차트 데이터 타입
// =======================================
type TrendPoint = {
  date: string
  label: string
  gw: number
  ds: number
}

// =======================================
// 4. 교육 추이 차트 Props 타입
// =======================================
type EducationTrendChartProps = {
  gwData: EducationRecord[]
  dsData: EducationRecord[]
  gwStatus: ApiStatus
  dsStatus: ApiStatus
  isLoading: boolean
}

// =======================================
// 5. 조회 기간에 해당하는 날짜 목록 생성
// =======================================
function getChartDates(
  days: TrendPeriod,
): { date: string; label: string }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today)

    date.setDate(today.getDate() - (days - index - 1))

    return {
      date: formatIsoDate(date), // 20261120 수정: 공통 날짜 변환 함수 사용
      label: `${date.getMonth() + 1}.${date.getDate()}`,
    }
  })
}

// =======================================
// 6. 사업별 교육 데이터 일별 건수 집계
// =======================================
function addRecordsToDailyCounts(
  records: EducationRecord[],
  businessType: CountKey,
  counts: Map<string, { gw: number; ds: number }>,
): void {
  records.forEach((record) => {
    const date = normalizeDateValue(record.근무날짜)
    const dailyCount = counts.get(date)

    if (!dailyCount) return

    dailyCount[businessType] += 1
  })
}

// =======================================
// 7. GW·DS 교육 추이 데이터 생성
// =======================================
function getTrendPoints(
  gwData: EducationRecord[],
  dsData: EducationRecord[],
  days: TrendPeriod,
): TrendPoint[] {
  const dates = getChartDates(days)

  const counts = new Map<string, { gw: number; ds: number }>()

  // 조회 기간의 날짜별 초기 건수 설정
  dates.forEach(({ date }) => {
    counts.set(date, { gw: 0, ds: 0 })
  })

  // GW·DS 데이터를 공통 함수로 집계
  addRecordsToDailyCounts(gwData, 'gw', counts)
  addRecordsToDailyCounts(dsData, 'ds', counts)

  // 날짜 순서에 맞게 차트 데이터 반환
  return dates.map(({ date, label }) => {
    const count = counts.get(date)

    return {
      date,
      label,
      gw: count?.gw ?? 0,
      ds: count?.ds ?? 0,
    }
  })
}

// =======================================
// 8. SVG 차트에 표시할 선 좌표 생성
// =======================================
function buildPolyline(
  points: TrendPoint[],
  field: CountKey,
  maxValue: number,
): string {
  const plotWidth = PLOT_RIGHT - PLOT_LEFT
  const plotHeight = PLOT_BOTTOM - PLOT_TOP

  return points
    .map((point, index) => {
      const x =
        PLOT_LEFT +
        (index / Math.max(points.length - 1, 1)) * plotWidth

      const y =
        PLOT_BOTTOM - (point[field] / maxValue) * plotHeight

      return `${x},${y}`
    })
    .join(' ')
}

// =======================================
// 9. 교육 건수 숫자 형식 변환
// =======================================
function formatCount(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value)
}

// =======================================
// 10. 교육 운영 추이 차트 컴포넌트
// =======================================
function EducationTrendChart({
  gwData,
  dsData,
  gwStatus,
  dsStatus,
  isLoading,
}: EducationTrendChartProps) {
  // 조회 기간 선택 상태
  const [period, setPeriod] = useState<TrendPeriod>(30)

  // 조회 기간에 따른 교육 추이 데이터 계산
  const points = useMemo(
    () => getTrendPoints(gwData, dsData, period),
    [gwData, dsData, period],
  )

  // 사업별 총 교육 건수 계산
  const gwTotal = points.reduce((sum, point) => sum + point.gw, 0)
  const dsTotal = points.reduce((sum, point) => sum + point.ds, 0)

  // 차트의 최대 표시값 계산
  const highestValue = Math.max(
    0,
    ...points.flatMap((point) => [point.gw, point.ds]),
  )

  // Y축 중간 눈금이 중복되지 않도록 짝수 단위로 설정
  const maxValue = Math.max(2, Math.ceil(highestValue / 2) * 2) // 20261120 수정

  const axisValues = [maxValue, maxValue / 2, 0]

  // 데이터 존재 및 API 연결 상태 확인
  const hasAnyData = gwTotal + dsTotal > 0

  const hasConnectionError =
    gwStatus === 'error' || dsStatus === 'error'

  // 조회 기간에 따른 날짜 라벨 표시 간격
  const labelInterval = period === 7 ? 2 : 6

  return (
    <article className="surface-card trend-card">
      {/* 차트 제목 및 조회 기간 선택 */}
      <div className="card-heading">
        <div>
          <h2>교육 운영 추이</h2>
          <p>GW·DS 교육일 기준 일별 운영 건수</p>
        </div>

        {/* 조회 기간 선택 버튼 */}
        <div className="trend-period-selector" aria-label="조회 기간">
          <button
            type="button"
            className={`period-button ${period === 7 ? 'active' : ''}`}
            aria-pressed={period === 7}
            onClick={() => setPeriod(7)}
          >
            7일
          </button>

          <button
            type="button"
            className={`period-button ${period === 30 ? 'active' : ''}`}
            aria-pressed={period === 30}
            onClick={() => setPeriod(30)}
          >
            30일
          </button>
        </div>
      </div>

      {/* 선택 기간의 전체 교육 건수 */}
      <div className="trend-summary">
        <div>
          <span>선택 기간 교육 건수</span>
          <strong>{formatCount(gwTotal + dsTotal)}건</strong>
        </div>

        <span className="trend-period-label">
          최근 {period}일
        </span>
      </div>

      {/* 교육 데이터 로딩 및 조회 결과에 따른 화면 분기 */}
      {isLoading ? (
        <div className="chart-message" role="status">
          교육 추이 데이터를 불러오고 있습니다.
        </div>
      ) : !hasAnyData ? (
        <div className="chart-message" role="status">
          <strong>
            {hasConnectionError
              ? '교육 데이터를 확인할 수 없습니다.'
              : '조회된 교육 데이터가 없습니다.'}
          </strong>

          <span>
            대시보드의 데이터 새로고침 후 다시 확인해 주세요.
          </span>
        </div>
      ) : (
        /* 20261123 수정: 전체 너비에 맞춘 SVG 차트 비율 조정 */
        <div className="trend-chart-wrap">
          <svg
            className="trend-chart"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`최근 ${period}일 교육 운영 추이. GW ${gwTotal}건, DS ${dsTotal}건`}
          >
            {/* Y축 눈금 및 배경 그리드 */}
            {axisValues.map((value, index) => {
              const y =
                PLOT_TOP +
                index * ((PLOT_BOTTOM - PLOT_TOP) / 2)

              return (
                <g key={`${value}-${index}`}>
                  <line
                    className="trend-chart-grid-line"
                    x1={PLOT_LEFT}
                    y1={y}
                    x2={PLOT_RIGHT}
                    y2={y}
                  />

                  <text
                    className="trend-chart-axis-label"
                    x={PLOT_LEFT - 18}
                    y={y + 6}
                    textAnchor="end"
                  >
                    {value}
                  </text>
                </g>
              )
            })}

            {/* GW 교육 추이 선 */}
            <polyline
              className="trend-chart-line-gw"
              points={buildPolyline(points, 'gw', maxValue)}
            />

            {/* DS 교육 추이 선 */}
            <polyline
              className="trend-chart-line-ds"
              points={buildPolyline(points, 'ds', maxValue)}
            />

            {/* X축 날짜 라벨 */}
            {points.map((point, index) => {
              if (
                index % labelInterval !== 0 &&
                index !== points.length - 1
              ) {
                return null
              }

              const x =
                PLOT_LEFT +
                (index / Math.max(points.length - 1, 1)) *
                  (PLOT_RIGHT - PLOT_LEFT)

              return (
                <text
                  className="trend-chart-axis-label"
                  key={point.date}
                  x={x}
                  y={CHART_HEIGHT - 16}
                  textAnchor="middle"
                >
                  {point.label}
                </text>
              )
            })}
          </svg>
        </div>
      )}

      {/* GW·DS 범례 및 사업별 교육 건수 */}
      <div className="chart-legend">
        <span>
          <i className="legend-dot legend-gw" />
          GW · {formatCount(gwTotal)}건
        </span>

        <span>
          <i className="legend-dot legend-ds" />
          DS · {formatCount(dsTotal)}건
        </span>

        {hasConnectionError && (
          <span className="legend-hint">
            일부 사업 데이터 조회 실패
          </span>
        )}
      </div>
    </article>
  )
}

export default EducationTrendChart