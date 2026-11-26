/**
 * @file PerformanceOverview.tsx
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-26
 * @description
 * 교육 실적 현황 화면의 그래프(상단)와 집계 표(중단)
 *
 * 데이터: 수료실적_RAW 시트 (B:AN)
 * 20261125 수정: 교육 유형 집계 기준을 I열(교육 유형) → H열(근무유형)으로 변경, 표 문구 띄어쓰기 정리
 *
 * 상단 그래프
 * - 전체 수료 실적     : AN 합계 / 목표 대비 달성률
 * - 8차시 이상 수료 실적 : Q ≥ 8 인 행의 AN 합계 / 목표 대비 달성률
 * - 지역별 수료 실적    : D(지역)별 AN 합계
 * - 월별 수료 인원 + 연간 누적 인원 : B(종료 월)별 AN 합계와 누적 합계
 *
 * 중단 표
 * - 연간 전체 (연 누적 / 월 누적)
 * - 연간 수요처 유형별
 * - 연간 교육 유형별 (총 누적 / 월 누적)
 * - 연간 교육 차시별 (총 누적 / 월 누적 / 월별)
 * - 월별 전체 (목표 달성 / 교육 유형별 월×지역)
 * 20261126 수정: 조회 시각 문구 통일 ("마지막 조회" → "기준 데이터")
 */

import { useEffect, useMemo, useState } from 'react'

import { Icon } from './DashboardUI'
import {
  BreakdownDonut,
  MonthlyComboChart,
  ProgressDonut,
} from './PerformanceCharts'
import {
  DemandTypeTable,
  EduTypeTable,
  HourBucketTable,
  MonthSelect,
  MonthlyBucketTable,
  MonthlyGoalTable,
  MonthlyRegionTable,
  RegionSummaryTable,
  TableCaption,
} from './PerformanceTables'
import { getPerformanceData } from '../Services/PerformanceService'
import type { PerformanceResult } from '../Types/performance'
import {
  countDemandByType,
  countUniqueDemands,
  formatNumber,
  getDemandTypes,
  getEduTypes,
  getLatestMonth,
  getMonthlyProgress,
  getRegions,
  getYears,
  sumByEduType,
  sumHourBuckets,
  summarizeByRegion,
  toPerformanceRow,
} from '../Utils/performanceStats'

// =======================================
// 1. 목표 인원 (브라우저에 저장)
// =======================================
const TARGET_STORAGE_KEY = 'education-performance-targets'
const DEFAULT_TARGETS = { total: 8000, over8: 4000 }

type Targets = typeof DEFAULT_TARGETS

function loadTargets(): Targets {
  try {
    const saved = JSON.parse(window.localStorage.getItem(TARGET_STORAGE_KEY) ?? 'null')

    if (
      saved &&
      Number.isFinite(saved.total) &&
      Number.isFinite(saved.over8)
    ) {
      return { total: saved.total, over8: saved.over8 }
    }
  } catch {
    // 저장소를 사용할 수 없는 환경이면 기본값 사용
  }

  return DEFAULT_TARGETS
}

function saveTargets(targets: Targets) {
  try {
    window.localStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(targets))
  } catch {
    // 저장 실패 시에도 화면 값은 유지
  }
}

// =======================================
// 2. 조회 상태 타입
// =======================================
type LoadState = {
  requestKey: number
  result: PerformanceResult | null
  error: string
}

const ALL_EDU_TYPES = '전체'

// =======================================
// 3. 교육 실적 현황 (그래프 + 표)
// =======================================
function PerformanceOverview() {
  // ---------------------------------------
  // 3-1. 조회 상태
  // ---------------------------------------
  const [reloadToken, setReloadToken] = useState(0)
  const [loadState, setLoadState] = useState<LoadState | null>(null)

  // 화면 진입 시점의 오늘 날짜 (렌더링마다 바뀌지 않도록 고정)
  const [today] = useState(() => new Date())

  const isLoading = loadState?.requestKey !== reloadToken

  // ---------------------------------------
  // 3-2. 선택 조건 (null = 기본값 사용)
  // ---------------------------------------
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [targets, setTargets] = useState<Targets>(loadTargets)

  const [summaryMonth, setSummaryMonth] = useState<number | null>(null) // 연간 전체 - 월 누적
  const [eduTypeMonth, setEduTypeMonth] = useState<number | null>(null) // 교육 유형별 - 월 누적
  const [bucketMonth, setBucketMonth] = useState<number | null>(null) // 교육 차시별 - 월 누적
  const [monthlyEduType, setMonthlyEduType] = useState(ALL_EDU_TYPES) // 월별 전체 - 교육 유형

  // ---------------------------------------
  // 3-3. 수료 실적 조회
  // ---------------------------------------
  useEffect(() => {
    let isActive = true

    getPerformanceData(reloadToken > 0)
      .then((result) => {
        if (isActive) setLoadState({ requestKey: reloadToken, result, error: '' })
      })
      .catch((error: unknown) => {
        if (!isActive) return

        setLoadState((current) => ({
          requestKey: reloadToken,
          result: current?.result ?? null, // 새로고침 실패 시 이전 데이터 유지
          error: error instanceof Error ? error.message : '수료 실적 조회에 실패했습니다.',
        }))
      })

    return () => {
      isActive = false
    }
  }, [reloadToken])

  // ---------------------------------------
  // 3-4. 집계용 데이터 변환 및 기본 선택값
  // ---------------------------------------
  const allRows = useMemo(
    () => (loadState?.result?.records ?? []).map(toPerformanceRow),
    [loadState],
  )

  const years = useMemo(() => getYears(allRows), [allRows])
  const currentYear = today.getFullYear()
  const defaultYear = years.includes(currentYear) ? currentYear : years[0] ?? currentYear
  const year = selectedYear !== null && years.includes(selectedYear) ? selectedYear : defaultYear

  const rows = useMemo(() => allRows.filter((row) => row.year === year), [allRows, year])
  const unknownYearCount = allRows.filter((row) => row.year === null).length
  const unknownMonthCount = rows.filter((row) => row.month === null).length

  const regions = useMemo(() => getRegions(rows), [rows])
  const eduTypes = useMemo(() => getEduTypes(rows), [rows])
  const demandTypes = useMemo(() => getDemandTypes(rows), [rows])

  const latestMonth = getLatestMonth(rows)
  const defaultMonth =
    year === currentYear ? today.getMonth() + 1 : latestMonth ?? 1

  // ---------------------------------------
  // 3-5. 집계
  // ---------------------------------------
  const yearSummary = useMemo(() => summarizeByRegion(rows, regions), [rows, regions])
  const uniqueDemandCount = useMemo(() => countUniqueDemands(rows), [rows]) // 20261125 추가: 지역 구분 없는 수요처 수

  const selectedSummaryMonth = summaryMonth ?? defaultMonth
  const monthSummary = useMemo(
    () => summarizeByRegion(rows.filter((row) => row.month === selectedSummaryMonth), regions),
    [rows, regions, selectedSummaryMonth],
  )

  const demandMatrix = useMemo(
    () => countDemandByType(rows, regions, demandTypes),
    [rows, regions, demandTypes],
  )

  const eduTypeYear = useMemo(() => sumByEduType(rows, regions, eduTypes), [rows, regions, eduTypes])

  const selectedEduTypeMonth = eduTypeMonth ?? defaultMonth
  const eduTypeMonthData = useMemo(
    () => sumByEduType(rows.filter((row) => row.month === selectedEduTypeMonth), regions, eduTypes),
    [rows, regions, eduTypes, selectedEduTypeMonth],
  )

  const bucketYear = useMemo(() => sumHourBuckets(rows), [rows])

  const selectedBucketMonth = bucketMonth ?? defaultMonth
  const bucketMonthData = useMemo(
    () => sumHourBuckets(rows.filter((row) => row.month === selectedBucketMonth)),
    [rows, selectedBucketMonth],
  )

  const bucketByMonth = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        values: sumHourBuckets(rows.filter((row) => row.month === index + 1)),
      })),
    [rows],
  )

  // 월별 전체: 교육 유형 필터 적용
  const monthlyRows = useMemo(
    () =>
      monthlyEduType === ALL_EDU_TYPES
        ? rows
        : rows.filter((row) => row.eduType === monthlyEduType),
    [rows, monthlyEduType],
  )

  const monthlyProgress = useMemo(
    () => getMonthlyProgress(monthlyRows, targets.total, targets.over8),
    [monthlyRows, targets],
  )

  const monthlyRegion = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        ...summarizeByRegion(monthlyRows.filter((row) => row.month === index + 1), regions),
      })),
    [monthlyRows, regions],
  )

  // 그래프용: 전체 교육 유형 기준
  const chartProgress = useMemo(
    () => getMonthlyProgress(rows, targets.total, targets.over8),
    [rows, targets],
  )

  const lastChartMonth =
    year === currentYear
      ? Math.max(today.getMonth() + 1, latestMonth ?? 0)
      : latestMonth ?? 0

  const comboData = chartProgress.map((item) => ({
    month: item.month,
    value: item.completed,
    cumulative: item.month <= lastChartMonth ? item.cumulative : null,
  }))

  // ---------------------------------------
  // 3-6. 이벤트 처리
  // ---------------------------------------
  const updateTarget = (key: keyof Targets, value: string) => {
    const parsed = Math.max(0, Math.round(Number(value) || 0))
    const next = { ...targets, [key]: parsed }

    setTargets(next)
    saveTargets(next)
  }

  const yearLabel = `${year}년`
  const fetchedAt = loadState?.result?.fetchedAt
    ? new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(loadState.result.fetchedAt))
    : ''

  const hasData = Boolean(loadState?.result)

  // =======================================
  // 4. 화면 렌더링
  // =======================================
  return (
    <div className="perf-overview">
      {/* 4-1. 조회 조건 */}
      <section className="surface-card perf-toolbar" aria-label="교육 실적 조회 조건">
        <div className="perf-toolbar-title">
          <h2>수료 실적</h2>
          <p>
            수료실적_RAW 시트 기준
            {fetchedAt && ` · ${fetchedAt} 기준 데이터`}{/* 20261126 수정: 표시 문구 통일 */}
            {hasData && ` · ${formatNumber(rows.length)}건`}
          </p>
        </div>

        <div className="perf-toolbar-controls">
          <label>
            <span>연도</span>
            <select
              value={year}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              disabled={years.length === 0}
            >
              {(years.length > 0 ? years : [year]).map((item) => (
                <option key={item} value={item}>{item}년</option>
              ))}
            </select>
          </label>

          <label>
            <span>목표 수료 인원</span>
            <input
              type="number"
              min={0}
              step={100}
              value={targets.total}
              onChange={(event) => updateTarget('total', event.target.value)}
            />
          </label>

          <label>
            <span>8차시 이상 목표</span>
            <input
              type="number"
              min={0}
              step={100}
              value={targets.over8}
              onChange={(event) => updateTarget('over8', event.target.value)}
            />
          </label>

          <button
            type="button"
            className="refresh-button perf-refresh-button"
            onClick={() => setReloadToken((token) => token + 1)}
            disabled={isLoading}
          >
            <Icon name="refresh" size={16} />
            {isLoading ? '조회 중...' : '새로고침'}
          </button>
        </div>
      </section>

      {/* 4-2. 오류 및 안내 */}
      {loadState?.error && !isLoading && (
        <div className="perf-message perf-message-error" role="alert">
          {loadState.error}
        </div>
      )}

      {(loadState?.result?.headerWarnings.length ?? 0) > 0 && (
        <div className="perf-message perf-message-warning" role="note">
          시트 헤더가 예상과 다릅니다. 컬럼 위치를 확인해 주세요.
          ({loadState?.result?.headerWarnings.slice(0, 2).join(' / ')})
        </div>
      )}

      {hasData && (unknownYearCount > 0 || unknownMonthCount > 0) && (
        <div className="perf-message perf-message-warning" role="note">
          {unknownYearCount > 0 && `활동 연도를 확인할 수 없는 ${formatNumber(unknownYearCount)}건은 집계에서 제외했습니다. `}
          {unknownMonthCount > 0 && `종료 월이 없는 ${formatNumber(unknownMonthCount)}건은 연간 합계에만 포함됩니다.`}
        </div>
      )}

      {!hasData ? (
        <section className="surface-card perf-placeholder" aria-busy={isLoading}>
          {isLoading ? '수료 실적을 불러오고 있습니다.' : '수료 실적을 불러오지 못했습니다.'}
        </section>
      ) : (
        <>
          {/* 4-3. 상단 그래프 */}
          <section className="perf-donut-grid" aria-label="수료 실적 그래프">
            <ProgressDonut
              title="전체 수료 실적"
              description={`${yearLabel} 종료 수료 인원(총) 합계`}
              value={yearSummary.total.completed}
              target={targets.total}
            />
            <ProgressDonut
              title="8차시 이상 수료 실적"
              description="교육 시간 8교시 이상 과정의 수료 인원"
              value={yearSummary.total.over8}
              target={targets.over8}
            />
            <BreakdownDonut
              title="지역별 수료 실적"
              description="지역별 종료 수료 인원(총) 합계"
              items={yearSummary.items.map((item) => ({
                label: item.region,
                value: item.completed,
              }))}
            />
          </section>

          <section className="perf-trend-grid">
            <article className="surface-card perf-chart-card perf-combo-card">
              <header className="perf-chart-heading">
                <h3>월별 수료 인원 · 연간 누적 인원</h3>
                <p>종료 월 기준 월별 수료 인원과 연간 누적 합계</p>
              </header>
              <MonthlyComboChart data={comboData} target={targets.total} />
            </article>

            <article className="surface-card perf-chart-card perf-kpi-card">
              <header className="perf-chart-heading">
                <h3>{yearLabel} 실적 요약</h3>
                {/* 20261125 수정: 집계 기준 설명 */}
                <p>
                  활동 연도 {yearLabel} 과정 {formatNumber(rows.length)}건(반) 기준 · 전 지역 합계
                </p>
              </header>

              {/* 20261125 추가: 항목별 집계 기준 */}
              <dl className="perf-kpi-list">
                <div>
                  <dt>수요처</dt>
                  <dd>{formatNumber(yearSummary.total.demandCount)}<small>개</small></dd>
                  <p className="perf-kpi-hint">
                    수요처명 중복 제외 (지역별 집계 후 합산)
                    {uniqueDemandCount !== yearSummary.total.demandCount &&
                      ` · 지역 구분 없이 ${formatNumber(uniqueDemandCount)}개`}
                  </p>
                </div>
                <div>
                  <dt>교육 차시</dt>
                  <dd>{formatNumber(yearSummary.total.hours)}<small>차시</small></dd>
                  <p className="perf-kpi-hint">과정(반)별 교육 시간(교시) 합계</p>
                </div>
                <div>
                  <dt>전체 수료 인원</dt>
                  <dd>{formatNumber(yearSummary.total.completed)}<small>명</small></dd>
                  <p className="perf-kpi-hint">종료 수료 인원(총) 합계 · 중복 인원 포함</p>
                </div>
                <div>
                  <dt>4차시 이상</dt>
                  <dd>{formatNumber(yearSummary.total.over4)}<small>명</small></dd>
                  <p className="perf-kpi-hint">교육 시간 4교시 이상 과정의 수료 인원</p>
                </div>
                <div>
                  <dt>8차시 이상</dt>
                  <dd>{formatNumber(yearSummary.total.over8)}<small>명</small></dd>
                  <p className="perf-kpi-hint">교육 시간 8교시 이상 과정의 수료 인원</p>
                </div>
                <div>
                  <dt>50차시 이상</dt>
                  <dd>{formatNumber(yearSummary.total.over50)}<small>명</small></dd>
                  <p className="perf-kpi-hint">교육 시간 50교시 이상 과정의 수료 인원</p>
                </div>
              </dl>

              <p className="perf-kpi-footnote">
                ※ 4·8·50차시 이상은 서로 포함 관계입니다. (예: 8차시 이상 인원은 4차시 이상에도 포함)
              </p>
            </article>
          </section>

          {/* 4-4. 중단 표 */}
          <section className="surface-card perf-table-card">
            <h2 className="perf-table-title">연간 전체</h2>
            {/* 20261125 추가: 표 설명 */}
            <p className="perf-table-note">
              지역별 수요처 수, 교육 차시, 수료 인원을 집계한 표입니다.
              연 누적은 {yearLabel} 전체, 월 누적은 선택한 월(종료 월 기준)의 실적입니다.
            </p>
            <ul className="perf-criteria">
              <li><b>수요처(개)</b> 수요처명 중복 제외 개수 (총 합계는 지역별 개수의 합)</li>
              <li><b>교육 차시</b> 과정(반)별 교육 시간(교시) 합계</li>
              <li><b>전체 수료 인원</b> 종료 수료 인원(총) 합계</li>
              <li><b>N차시 이상 수료 인원</b> 교육 시간이 N교시 이상인 과정의 수료 인원 (서로 포함 관계)</li>
            </ul>

            <TableCaption>연 누적</TableCaption>
            <RegionSummaryTable
              periodLabel="연도"
              periodCell={yearLabel}
              items={yearSummary.items}
              total={yearSummary.total}
            />

            <TableCaption>월 누적</TableCaption>
            <RegionSummaryTable
              periodLabel="월"
              periodCell={
                <MonthSelect
                  value={selectedSummaryMonth}
                  onChange={setSummaryMonth}
                  label="연간 전체 월 선택"
                />
              }
              items={monthSummary.items}
              total={monthSummary.total}
            />
          </section>

          <section className="surface-card perf-table-card">
            <h2 className="perf-table-title">연간 수요처 유형별</h2>
            <p className="perf-table-note">학교 구분별 수요처 수 (수요처명 중복 제외)</p>

            <DemandTypeTable
              yearLabel={yearLabel}
              regions={regions}
              types={demandTypes}
              {...demandMatrix}
            />
          </section>

          <section className="surface-card perf-table-card">
            <h2 className="perf-table-title">연간 교육 유형별</h2>
            {/* 20261125 추가: 집계 기준 (근무유형 H열) */}
            <p className="perf-table-note">
              수료실적_RAW 시트의 근무유형(H열) 값 기준으로 교육 차시와 수료 인원을 집계한 표입니다.
            </p>

            <TableCaption>총 누적</TableCaption>
            <EduTypeTable
              periodLabel={null}
              periodCell={null}
              regions={regions}
              types={eduTypes}
              {...eduTypeYear}
            />

            <TableCaption>월 누적</TableCaption>
            <EduTypeTable
              periodLabel="월"
              periodCell={
                <MonthSelect
                  value={selectedEduTypeMonth}
                  onChange={setEduTypeMonth}
                  label="교육 유형별 월 선택"
                />
              }
              regions={regions}
              types={eduTypes}
              {...eduTypeMonthData}
            />
          </section>

          <section className="surface-card perf-table-card">
            <h2 className="perf-table-title">연간 교육 차시별</h2>
            <p className="perf-table-note">과정별 교육 시간(교시) 구간에 따른 교육 차시 합계</p>

            <TableCaption>총 누적</TableCaption>
            <HourBucketTable firstLabel="연도" firstCell={yearLabel} values={bucketYear} />

            <TableCaption>월 누적</TableCaption>
            <HourBucketTable
              firstLabel="월"
              firstCell={
                <MonthSelect
                  value={selectedBucketMonth}
                  onChange={setBucketMonth}
                  label="교육 차시별 월 선택"
                />
              }
              values={bucketMonthData}
            />

            <TableCaption>월별</TableCaption>
            <MonthlyBucketTable months={bucketByMonth} total={bucketYear} />
          </section>

          <section className="surface-card perf-table-card">
            <div className="perf-table-heading">
              <h2 className="perf-table-title">월별 전체</h2>

              <label className="perf-inline-filter">
                <span>교육 유형</span>
                <select
                  value={monthlyEduType}
                  onChange={(event) => setMonthlyEduType(event.target.value)}
                >
                  <option value={ALL_EDU_TYPES}>전체</option>
                  {eduTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="perf-table-note">
              진행 중 + 완료 인원 포함 · 교육 유형(근무유형 H열)을 선택하면 아래 두 표에 함께 적용됩니다.
            </p>

            <TableCaption>월 누적</TableCaption>
            <MonthlyGoalTable
              progress={monthlyProgress}
              target={targets.total}
              target8={targets.over8}
            />

            <TableCaption>월별 지역 현황</TableCaption>
            <MonthlyRegionTable months={monthlyRegion} />
          </section>
        </>
      )}
    </div>
  )
}

export default PerformanceOverview
