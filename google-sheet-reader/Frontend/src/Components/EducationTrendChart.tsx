/**
 * @file EducationTrendChart.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-18
 * @description
 * 교육 운영 추이 차트 화면 구성.
 *
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getEducationByDateRange } from '../Services/EducationService'
import type { EducationRecord } from '../Types/education'

type Period = 7 | 30 | 90

type TrendData = {
  date: string
  gw: number
  ds: number
}

type ApiStatus = 'loading' | 'success' | 'error'

const PERIOD_OPTIONS: Period[] = [7, 30, 90]

const CHART_WIDTH = 640
const CHART_HEIGHT = 190
const CHART_PADDING = {
  top: 15,
  right: 15,
  bottom: 30,
  left: 35,
}

const GW_COLOR = '#6e9edc'
const DS_COLOR = '#61e66c'

// 20261118 추가: 날짜를 YYYY-MM-DD 형식으로 변환
function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// 20261118 추가: 날짜 문자열에서 날짜 키 추출
function getDateKey(value: string): string {
  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10)
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return formatIsoDate(parsed)
}

// 20261118 추가: 날짜별 교육 건수 집계
function createTrendData(
  gwData: EducationRecord[],
  dsData: EducationRecord[],
  days: Period,
): TrendData[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - (days - 1))

  const countMap = new Map<string, { gw: number; ds: number }>()

  // 20261118 추가: 조회 기간의 모든 날짜 초기화
  for (let index = 0; index < days; index += 1) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + index)

    countMap.set(formatIsoDate(date), {
      gw: 0,
      ds: 0,
    })
  }

  // 20261118 추가: GW 데이터 집계
  gwData.forEach((record) => {
    const dateKey = getDateKey(record.근무날짜)
    const current = countMap.get(dateKey)

    if (current) {
      current.gw += 1
    }
  })

  // 20261118 추가: DS 데이터 집계
  dsData.forEach((record) => {
    const dateKey = getDateKey(record.근무날짜)
    const current = countMap.get(dateKey)

    if (current) {
      current.ds += 1
    }
  })

  return Array.from(countMap.entries()).map(([date, count]) => ({
    date,
    gw: count.gw,
    ds: count.ds,
  }))
}

// 20261118 추가: 차트 날짜 라벨
function formatDateLabel(date: string, days: Period): string {
  const [, month, day] = date.split('-')

  if (days === 7) {
    return `${Number(month)}/${Number(day)}`
  }

  return `${Number(month)}/${Number(day)}`
}

// 20261118 추가: SVG 선 그래프 경로 생성
function createLinePath(
  values: number[],
  maxValue: number,
): string {
  const chartWidth =
    CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right

  const chartHeight =
    CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom

  return values
    .map((value, index) => {
      const x =
        CHART_PADDING.left +
        (index / Math.max(values.length - 1, 1)) * chartWidth

      const y =
        CHART_PADDING.top +
        chartHeight -
        (value / maxValue) * chartHeight

      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function EducationTrendChart() {
  // 20261118 추가: 조회 기간 상태
  const [period, setPeriod] = useState<Period>(30)

  // 20261118 추가: GW·DS 차트 데이터
  const [gwData, setGwData] = useState<EducationRecord[]>([])
  const [dsData, setDsData] = useState<EducationRecord[]>([])

  // 20261118 추가: 조회 상태
  const [status, setStatus] = useState<ApiStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  // 20261118 추가: 기간별 데이터 조회
  const loadTrendData = useCallback(async (days: Period) => {
    setStatus('loading')
    setErrorMessage('')

    const endDate = new Date()
    const startDate = new Date(endDate)

    startDate.setDate(startDate.getDate() - (days - 1))

    const params = {
      startDate: formatIsoDate(startDate),
      endDate: formatIsoDate(endDate),
    }

    try {
      const results = await Promise.all([
        getEducationByDateRange({
          businessType: 'GW',
          ...params,
        }),
        getEducationByDateRange({
          businessType: 'DS',
          ...params,
        }),
      ])

      setGwData(results[0])
      setDsData(results[1])
      setStatus('success')
    } catch (error) {
      setGwData([])
      setDsData([])
      setStatus('error')

      setErrorMessage(
        error instanceof Error
          ? error.message
          : '교육 추이 데이터를 조회하지 못했습니다.',
      )
    }
  }, [])

  // 20261118 추가: 최초 진입 시 차트 데이터 조회
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadTrendData(period)
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadTrendData, period])

  // 20261118 추가: 날짜별 차트 데이터 생성
  const trendData = useMemo(
    () => createTrendData(gwData, dsData, period),
    [gwData, dsData, period],
  )

  // 20261118 추가: 차트 최대값 계산
  const maxValue = useMemo(() => {
    const maximum = Math.max(
      1,
      ...trendData.map((item) => Math.max(item.gw, item.ds)),
    )

    return Math.ceil(maximum / 5) * 5 || 5
  }, [trendData])

  // 20261118 추가: GW·DS 선 그래프 경로
  const gwPath = createLinePath(
    trendData.map((item) => item.gw),
    maxValue,
  )

  const dsPath = createLinePath(
    trendData.map((item) => item.ds),
    maxValue,
  )

  // 20261118 추가: 차트 전체 건수
  const totalCount = gwData.length + dsData.length

  // 20261118 추가: 날짜 라벨 표시 간격
  const labelInterval = period === 7 ? 1 : period === 30 ? 5 : 15

  const chartHeight =
    CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom

  return (
    <article className="surface-card trend-card">
      <div className="card-heading">
        <div>
          <h2>교육 운영 추이</h2>
          <p>기간별 교육 운영 현황</p>
        </div>

        <div className="trend-period-selector">
          {PERIOD_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              className={period === days ? 'period-button active' : 'period-button'}
              onClick={() => setPeriod(days)}
              disabled={status === 'loading'}
            >
              {days}일
            </button>
          ))}
        </div>
      </div>

      <div className="trend-summary">
        <div>
          <span>총 교육 건수</span>
          <strong>
            {status === 'success'
              ? totalCount.toLocaleString()
              : '-'}
          </strong>
        </div>

        <span className="trend-period-label">
          최근 {period}일 기준
        </span>
      </div>

      {status === 'loading' ? (
        <div className="chart-message">
          교육 운영 데이터를 불러오고 있습니다.
        </div>
      ) : status === 'error' ? (
        <div className="chart-message chart-error">
          <strong>차트 데이터를 불러오지 못했습니다.</strong>
          <p>{errorMessage}</p>
          <button
            type="button"
            className="chart-retry-button"
            onClick={() => void loadTrendData(period)}
          >
            다시 조회
          </button>
        </div>
      ) : (
        <div className="trend-chart-wrap">
          <svg
            className="trend-chart"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`최근 ${period}일 GW와 DS 교육 운영 건수 추이`}
          >
            {/* 20261118 추가: 차트 가로 기준선 */}
            {[0, 1, 2, 3].map((index) => {
              const y =
                CHART_PADDING.top +
                (chartHeight / 3) * index

              const value = Math.round(
                maxValue - (maxValue / 3) * index,
              )

              return (
                <g key={index}>
                  <line
                    x1={CHART_PADDING.left}
                    y1={y}
                    x2={CHART_WIDTH - CHART_PADDING.right}
                    y2={y}
                    stroke="#edf0f5"
                    strokeDasharray="3 4"
                  />
                  <text
                    x={CHART_PADDING.left - 9}
                    y={y + 3}
                    textAnchor="end"
                    fill="#a0aaba"
                    fontSize="9"
                  >
                    {value}
                  </text>
                </g>
              )
            })}

            {/* 20261118 추가: GW 그래프 */}
            <path
              d={gwPath}
              fill="none"
              stroke={GW_COLOR}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 20261118 추가: DS 그래프 */}
            <path
              d={dsPath}
              fill="none"
              stroke={DS_COLOR}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 20261118 추가: 날짜별 데이터 점 */}
            {trendData.map((item, index) => {
              const x =
                CHART_PADDING.left +
                (index / Math.max(trendData.length - 1, 1)) *
                  (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)

              const gwY =
                CHART_PADDING.top +
                chartHeight -
                (item.gw / maxValue) * chartHeight

              const dsY =
                CHART_PADDING.top +
                chartHeight -
                (item.ds / maxValue) * chartHeight

              return (
                <g key={item.date}>
                  <circle
                    cx={x}
                    cy={gwY}
                    r="3"
                    fill={GW_COLOR}
                  >
                    <title>
                      {item.date} GW {item.gw}건
                    </title>
                  </circle>

                  <circle
                    cx={x}
                    cy={dsY}
                    r="3"
                    fill={DS_COLOR}
                  >
                    <title>
                      {item.date} DS {item.ds}건
                    </title>
                  </circle>
                </g>
              )
            })}

            {/* 20261118 추가: 날짜 라벨 */}
            {trendData.map((item, index) => {
              if (
                index % labelInterval !== 0 &&
                index !== trendData.length - 1
              ) {
                return null
              }

              const x =
                CHART_PADDING.left +
                (index / Math.max(trendData.length - 1, 1)) *
                  (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right)

              return (
                <text
                  key={item.date}
                  x={x}
                  y={CHART_HEIGHT - 7}
                  textAnchor="middle"
                  fill="#a0aaba"
                  fontSize="9"
                >
                  {formatDateLabel(item.date, period)}
                </text>
              )
            })}
          </svg>
        </div>
      )}

      <div className="chart-legend">
        <span>
          <i className="legend-dot legend-gw" />
          GW
        </span>

        <span>
          <i className="legend-dot legend-ds" />
          DS
        </span>

        <span className="legend-hint">
          {status === 'success'
            ? `GW ${gwData.length.toLocaleString()}건 · DS ${dsData.length.toLocaleString()}건`
            : '데이터 조회 대기'}
        </span>
      </div>
    </article>
  )
}

export default EducationTrendChart
