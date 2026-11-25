/**
 * @file PerformanceCharts.tsx
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 교육 실적 현황 화면의 SVG 그래프 (외부 차트 라이브러리 없이 구현)
 *
 * - ProgressDonut  : 목표 대비 달성 도넛 (전체 수료 / 8차시 이상 수료)
 * - BreakdownDonut : 항목별 비율 도넛 (지역별 수료 실적)
 * - MonthlyComboChart : 월별 수료 인원(막대) + 연간 누적 인원(꺾은선) + 목표선
 *   · 두 값 모두 "명" 단위이므로 하나의 y축을 공유
 *   · 마우스를 올리면 해당 월의 수치를 툴팁으로 표시
 *   · 20261125 추가: 막대 위에 월별 수료 인원 숫자 상시 표시
 */

import { useState } from 'react'

import { formatNumber, formatPercent } from '../Utils/performanceStats'

// =======================================
// 1. 그래프 공통 색상 (색약 구분 검증 완료 팔레트)
// =======================================
const CHART_COLORS = ['#257de0', '#f47230', '#00b894'] as const
const TRACK_COLOR = '#ECECEC'
const OTHER_COLOR = '#B5B5B5' // 4번째 이후 항목은 회색으로 묶어 표시

// =======================================
// 2. 도넛 경로 계산
// =======================================
const DONUT_SIZE = 180
const DONUT_RADIUS = 72
const DONUT_STROKE = 18
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS

// =======================================
// 3. 목표 대비 달성 도넛
// =======================================
export function ProgressDonut({
  title,
  description,
  value,
  target,
  color = CHART_COLORS[0],
}: {
  title: string
  description: string
  value: number
  target: number
  color?: string
}) {
  const rate = target > 0 ? value / target : 0
  const filled = Math.min(Math.max(rate, 0), 1) * CIRCUMFERENCE
  const remaining = target - value

  return (
    <article className="surface-card perf-chart-card">
      <header className="perf-chart-heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </header>

      <div className="perf-donut-wrap">
        <svg
          className="perf-donut"
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          role="img"
          aria-label={`${title} ${formatNumber(value)}명, 목표 ${formatNumber(target)}명 대비 ${formatPercent(rate)}`}
        >
          <circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={DONUT_RADIUS}
            fill="none"
            stroke={TRACK_COLOR}
            strokeWidth={DONUT_STROKE}
          />
          {filled > 0 && (
            <circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={DONUT_STROKE}
              strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
              strokeLinecap={rate >= 1 ? 'butt' : 'round'}
              transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
            >
              <title>{`${formatNumber(value)}명 / 목표 ${formatNumber(target)}명`}</title>
            </circle>
          )}
        </svg>

        <div className="perf-donut-center">
          <strong>{formatNumber(value)}<small>명</small></strong>
          <span>달성률 {formatPercent(rate)}</span>
        </div>
      </div>

      <dl className="perf-donut-facts">
        <div>
          <dt>목표</dt>
          <dd>{formatNumber(target)}명</dd>
        </div>
        <div>
          <dt>{remaining > 0 ? '잔여' : '초과'}</dt>
          <dd>{formatNumber(Math.abs(remaining))}명</dd>
        </div>
      </dl>
    </article>
  )
}

// =======================================
// 4. 항목별 비율 도넛
// =======================================
export type BreakdownItem = {
  label: string
  value: number
}

export function BreakdownDonut({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: BreakdownItem[]
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  // 색상은 항목 순서에 고정 (4번째부터는 "기타"로 묶음)
  const visibleItems: (BreakdownItem & { color: string })[] =
    items.length <= CHART_COLORS.length
      ? items.map((item, index) => ({ ...item, color: CHART_COLORS[index] }))
      : [
          ...items.slice(0, CHART_COLORS.length - 1).map((item, index) => ({
            ...item,
            color: CHART_COLORS[index],
          })),
          {
            label: '기타',
            value: items
              .slice(CHART_COLORS.length - 1)
              .reduce((sum, item) => sum + item.value, 0),
            color: OTHER_COLOR,
          },
        ]

  const total = visibleItems.reduce((sum, item) => sum + item.value, 0)
  const positiveCount = visibleItems.filter((item) => item.value > 0).length

  // 조각 사이 2px 간격
  const gap = positiveCount > 1 ? 2 : 0

  // 조각별 길이와 시작 위치 계산
  // 20261125 수정: 렌더링 중 변수 재할당(React Compiler 린트 오류) 제거
  const lengths = visibleItems.map((item) =>
    total > 0 ? (item.value / total) * CIRCUMFERENCE : 0,
  )

  const segments = visibleItems.map((item, index) => ({
    ...item,
    index,
    dash: Math.max(lengths[index] - gap, 0),
    offset: lengths.slice(0, index).reduce((sum, length) => sum + length, 0),
  }))

  const active = activeIndex !== null ? visibleItems[activeIndex] : null

  return (
    <article className="surface-card perf-chart-card">
      <header className="perf-chart-heading">
        <h3>{title}</h3>
        <p>{description}</p>
      </header>

      <div className="perf-donut-wrap">
        <svg
          className="perf-donut"
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          role="img"
          aria-label={`${title}: ${visibleItems
            .map((item) => `${item.label} ${formatNumber(item.value)}명`)
            .join(', ')}`}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={DONUT_RADIUS}
            fill="none"
            stroke={TRACK_COLOR}
            strokeWidth={DONUT_STROKE}
          />

          {segments.map((segment) =>
            segment.dash > 0 ? (
              <circle
                key={segment.label}
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={DONUT_RADIUS}
                fill="none"
                stroke={segment.color}
                strokeWidth={activeIndex === segment.index ? DONUT_STROKE + 4 : DONUT_STROKE}
                strokeDasharray={`${segment.dash} ${CIRCUMFERENCE}`}
                strokeDashoffset={-segment.offset}
                transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
                opacity={activeIndex === null || activeIndex === segment.index ? 1 : 0.35}
                onMouseEnter={() => setActiveIndex(segment.index)}
                className="perf-donut-segment"
              >
                <title>{`${segment.label} ${formatNumber(segment.value)}명`}</title>
              </circle>
            ) : null,
          )}
        </svg>

        <div className="perf-donut-center">
          <strong>
            {formatNumber(active ? active.value : total)}
            <small>명</small>
          </strong>
          <span>
            {active
              ? `${active.label} · ${total > 0 ? formatPercent(active.value / total) : '0%'}`
              : '전체 합계'}
          </span>
        </div>
      </div>

      <ul className="perf-legend">
        {visibleItems.map((item, index) => (
          <li
            key={item.label}
            className={activeIndex === index ? 'is-active' : undefined}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <i style={{ background: item.color }} aria-hidden="true" />
            <span>{item.label}</span>
            <strong>{formatNumber(item.value)}명</strong>
            <em>{total > 0 ? formatPercent(item.value / total) : '0%'}</em>
          </li>
        ))}
      </ul>
    </article>
  )
}

// =======================================
// 5. 월별 수료 인원 + 연간 누적 그래프
// =======================================
const CHART_WIDTH = 760
const CHART_HEIGHT = 300
const MARGIN = { top: 20, right: 20, bottom: 34, left: 58 }
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

/** 보기 좋은 눈금 간격 (1·2·5 × 10ⁿ) */
function getNiceTicks(maxValue: number, tickCount = 5): number[] {
  if (maxValue <= 0) return [0, 1]

  const rawStep = maxValue / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude

  const ticks: number[] = []
  for (let value = 0; value <= maxValue + step * 0.001; value += step) {
    ticks.push(value)
  }
  if (ticks[ticks.length - 1] < maxValue) ticks.push(ticks[ticks.length - 1] + step)

  return ticks
}

/** 위쪽 모서리만 둥근 막대 경로 */
function getBarPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0) return ''

  const radius = Math.min(4, width / 2, height)
  const bottom = y + height

  return [
    `M${x},${bottom}`,
    `V${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `H${x + width - radius}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `V${bottom}`,
    'Z',
  ].join(' ')
}

export type ComboDatum = {
  month: number
  value: number // 월 수료 인원
  cumulative: number | null // 연간 누적 (데이터가 없는 이후 월은 null)
}

export function MonthlyComboChart({
  data,
  target,
}: {
  data: ComboDatum[]
  target: number
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const maxValue = Math.max(
    target,
    ...data.map((item) => item.value),
    ...data.map((item) => item.cumulative ?? 0),
  )
  const ticks = getNiceTicks(maxValue * 1.05)
  const yMax = ticks[ticks.length - 1]

  const band = PLOT_WIDTH / data.length
  const barWidth = Math.min(30, band * 0.5)

  const xCenter = (index: number) => MARGIN.left + band * index + band / 2
  const yScale = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT

  const linePoints = data
    .map((item, index) =>
      item.cumulative === null ? null : `${xCenter(index)},${yScale(item.cumulative)}`,
    )
    .filter(Boolean)
    .join(' ')

  const lastLineIndex = data.reduce(
    (last, item, index) => (item.cumulative !== null ? index : last),
    -1,
  )

  const hovered = hoverIndex !== null ? data[hoverIndex] : null
  const tooltipLeft = hoverIndex !== null ? (xCenter(hoverIndex) / CHART_WIDTH) * 100 : 0

  return (
    <div className="perf-combo">
      <ul className="perf-combo-legend">
        <li><i className="perf-key-bar" style={{ background: CHART_COLORS[0] }} />월별 수료 인원</li>
        <li><i className="perf-key-line" style={{ background: CHART_COLORS[1] }} />연간 누적 인원</li>
        <li><i className="perf-key-target" />목표 {formatNumber(target)}명</li>
      </ul>

      <div className="perf-combo-plot" onMouseLeave={() => setHoverIndex(null)}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label="월별 수료 인원과 연간 누적 인원 그래프"
        >
          {/* 가로 눈금선 및 y축 값 */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={CHART_WIDTH - MARGIN.right}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke={tick === 0 ? '#D0D0D0' : '#F0F0F0'}
              />
              <text x={MARGIN.left - 10} y={yScale(tick) + 4} textAnchor="end" className="perf-axis-text">
                {formatNumber(tick)}
              </text>
            </g>
          ))}

          {/* 목표선 */}
          {target > 0 && (
            <g>
              <line
                x1={MARGIN.left}
                x2={CHART_WIDTH - MARGIN.right}
                y1={yScale(target)}
                y2={yScale(target)}
                stroke="#888888"
                strokeDasharray="5 4"
                strokeWidth={1.5}
              />
              <text
                x={CHART_WIDTH - MARGIN.right}
                y={yScale(target) - 6}
                textAnchor="end"
                className="perf-axis-text perf-target-text"
              >
                목표 {formatNumber(target)}명
              </text>
            </g>
          )}

          {/* 마우스 위치 강조 영역 */}
          {hoverIndex !== null && (
            <rect
              x={MARGIN.left + band * hoverIndex}
              y={MARGIN.top}
              width={band}
              height={PLOT_HEIGHT}
              fill="#F5F5F5"
            />
          )}

          {/* 월별 막대 */}
          {data.map((item, index) => (
            <path
              key={item.month}
              d={getBarPath(
                xCenter(index) - barWidth / 2,
                yScale(item.value),
                barWidth,
                yScale(0) - yScale(item.value),
              )}
              fill={CHART_COLORS[0]}
            />
          ))}

          {/* 20261125 추가: 월별 수료 인원 숫자 (막대 위 상시 표시)
              누적 꺾은선 점과 겹치면 막대 안쪽(흰 글자) 또는 점 위로 이동 */}
          {data.map((item, index) => {
            if (item.value <= 0) return null

            const barTop = yScale(item.value)
            const barHeight = yScale(0) - barTop
            const dotY = item.cumulative === null ? null : yScale(item.cumulative)

            let labelY = barTop - 7
            let isInside = false

            if (dotY !== null && Math.abs(dotY - labelY) < 14) {
              if (barHeight >= 22) {
                labelY = barTop + 15
                isInside = true
              } else {
                // 마지막 누적값 라벨과도 겹치지 않도록 한 줄 더 위로
                labelY = dotY - (index === lastLineIndex ? 28 : 12)
              }
            }

            return (
              <text
                key={`bar-label-${item.month}`}
                x={xCenter(index)}
                y={labelY}
                textAnchor="middle"
                className={`perf-bar-label ${isInside ? 'is-inside' : ''}`}
              >
                {formatNumber(item.value)}
              </text>
            )
          })}

          {/* 누적 꺾은선 */}
          {linePoints && (
            <polyline
              points={linePoints}
              fill="none"
              stroke={CHART_COLORS[1]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {data.map((item, index) =>
            item.cumulative === null ? null : (
              <circle
                key={item.month}
                cx={xCenter(index)}
                cy={yScale(item.cumulative)}
                r={hoverIndex === index || index === lastLineIndex ? 5 : 4}
                fill={CHART_COLORS[1]}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            ),
          )}

          {/* 마지막 누적값 직접 표시 */}
          {lastLineIndex >= 0 && data[lastLineIndex].cumulative !== null && (
            <text
              x={xCenter(lastLineIndex)}
              y={yScale(data[lastLineIndex].cumulative as number) - 12}
              textAnchor="middle"
              className="perf-value-label"
            >
              {formatNumber(data[lastLineIndex].cumulative as number)}명
            </text>
          )}

          {/* x축 월 */}
          {data.map((item, index) => (
            <text
              key={item.month}
              x={xCenter(index)}
              y={CHART_HEIGHT - 12}
              textAnchor="middle"
              className="perf-axis-text"
            >
              {item.month}월
            </text>
          ))}

          {/* 마우스 감지 영역 (막대보다 넓게) */}
          {data.map((item, index) => (
            <rect
              key={item.month}
              x={MARGIN.left + band * index}
              y={MARGIN.top}
              width={band}
              height={PLOT_HEIGHT + MARGIN.bottom}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
            />
          ))}
        </svg>

        {hovered && (
          <div
            className={`perf-tooltip ${tooltipLeft > 70 ? 'is-left' : ''}`}
            style={{ left: `${tooltipLeft}%` }}
            role="status"
          >
            <strong>{hovered.month}월</strong>
            <span><i style={{ background: CHART_COLORS[0] }} />월 수료 <b>{formatNumber(hovered.value)}명</b></span>
            <span>
              <i style={{ background: CHART_COLORS[1] }} />누적{' '}
              <b>{hovered.cumulative === null ? '-' : `${formatNumber(hovered.cumulative)}명`}</b>
            </span>
            {hovered.cumulative !== null && target > 0 && (
              <span className="perf-tooltip-rate">목표 달성률 {formatPercent(hovered.cumulative / target)}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}