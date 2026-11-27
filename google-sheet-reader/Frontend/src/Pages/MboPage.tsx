/**
 * @file MboPage.tsx
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-27
 * @description
 * MBO 화면 (시트: MBO, 최종목표지표 표(23행~) 기준 집계)
 *
 * 20261127 수정: 화면 구성 변경 (도넛·게이지·가로 막대 → 요약 숫자 + 세로 막대)
 * 1. 상단 요약 숫자 한 줄: 정량지표 달성 / 평균 달성률 / 전체 수료학생 / 강사양성 교육인원
 * 2. 집중 관리 필요 지표: 달성률 100% 미만(빨강) 또는 진행현황이 "완료"가 아닌 지표(노랑)
 * 3. 성과지표별 달성률 세로 막대
 *    - 12개 지표를 한 차트에 표시, 핵심 / 자율성과지표는 점선으로 구분
 *    - 막대 아래 짧은 지표명, 그 아래 대분류(①②③) 묶음선
 *    - 0 ~ 150% 눈금, 100% 목표선 / 150% 이상은 막대를 멈추고 진한 초록 + 숫자로 표시
 *    - 마우스 올리면 전체 지표명·실적/목표, 누르면 아래에 세부내용 표시
 *
 * 20261127 추가: 진행현황 수정
 * - 상세에서 "진행현황 수정" → 진행 상태(시트 드롭다운 선택지) · 진행실적 · 진행 메모 수정
 * - 저장하면 MBO 시트 최종목표지표 표의 해당 행에 바로 반영
 *   (진행실적을 바꾸면 진행율도 진행실적 ÷ 정량목표로 다시 기록)
 * - 시트의 행 지표 이름이 바뀐 경우 저장하지 않음 (새로고침 안내)
 *
 * 달성률 = 진행실적 ÷ 정량목표 (초과 달성 그대로 표시)
 * 평균 달성률 = 지표별 달성률을 100%로 상한 처리 후 평균 (시트 계산 방식과 동일)
 */

import { Fragment, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import { Icon } from '../Components/DashboardUI'
import { OpsLoadGuard, OpsPageHeading } from '../Components/OperationUI'
import { useOperationData } from '../Hooks/useOperationData'
import { updateMboProgress } from '../Services/OperationService'
import type { MboKpi, MboProgressResult } from '../Types/operations'
import { formatFetchedAt, formatNumber, toNumber } from '../Utils/operationFormat'


// =======================================
// 1. 설정
// =======================================
const BAR_MAX = 1.5 // 막대 최대 높이 150%
const Y_TICKS = [0, 0.5, 1, 1.5]

// 상단 요약 카드: 시트 L10·M10 카드와 같은 지표 (지표 이름에 포함된 글자로 찾음)
const SUMMARY_CARDS = [
  { label: '전체 수료학생', match: '전체교육인원' },
  { label: '강사양성 교육인원', match: '전체강사교육인원' },
]

// 막대 아래 짧은 지표명 (위에서부터 먼저 맞는 것 사용, 공백 무시)
const SHORT_NAMES: { match: string; label: string }[] = [
  { match: '전체강사교육인원', label: '강사 교육' },
  { match: '고급강사양성', label: '고급 강사' },
  { match: '위촉강사', label: '위촉 강사' },
  { match: '전체교육인원', label: '전체 교육' },
  { match: '4시간', label: '4시간 이상' },
  { match: '8시간', label: '8시간 이상' },
  { match: '소외지역', label: '소외 지역' },
  { match: '자격증', label: '자격증 경진' },
  { match: '역량향상지표', label: '역량 지표' },
  { match: '지역특화', label: '지역 특화' },
  { match: '협력체계', label: '협력 체계' },
  { match: '자립화', label: '강사 자립' },
]


// =======================================
// 2. 계산
// =======================================
type KpiView = MboKpi & {
  actual: number | null
  target: number | null
  rate: number | null // 실제 달성률 (1 = 100%)
  unit: string // 목표의 단위 ("명", "건")
  achieved: boolean
  isDone: boolean // 진행현황 "완료"
  shortName: string
}

const compactText = (value: string) => value.replace(/\s+/g, '')

function getShortName(name: string): string {
  const key = compactText(name)
  return SHORT_NAMES.find((item) => key.includes(item.match))?.label ?? name.slice(0, 8)
}

function toKpiView(kpi: MboKpi): KpiView {
  const actual = toNumber(kpi.진행실적)
  const target = toNumber(kpi.정량목표) ?? toNumber(kpi.목표)
  const rate = actual !== null && target !== null && target > 0 ? actual / target : toNumber(kpi.진행율)

  return {
    ...kpi,
    actual,
    target,
    rate,
    unit: kpi.목표.replace(/[\d,.\s]/g, ''),
    achieved: (rate ?? 0) >= 1,
    isDone: compactText(kpi.진행상태) === '완료',
    shortName: getShortName(kpi.성과지표),
  }
}

function formatRate(rate: number | null): string {
  return rate === null ? '-' : `${Math.round(rate * 100)}%`
}

function formatAmount(kpi: KpiView, value: number | null, fallback: string): string {
  if (value === null) return fallback || '-'
  return `${formatNumber(value)}${kpi.unit}`
}

const cappedAverage = (items: KpiView[]) =>
  items.length > 0 ? items.reduce((sum, kpi) => sum + Math.min(kpi.rate ?? 0, 1), 0) / items.length : 0

/** 진행 메모 첫 줄 ("- " 기호 제거) */
const firstLine = (text: string) => text.split('\n').map((line) => line.replace(/^[-•\s]+/, '').trim()).find(Boolean) ?? ''

const barTone = (kpi: KpiView) => (!kpi.achieved ? 'is-miss' : (kpi.rate ?? 0) >= BAR_MAX ? 'is-max' : 'is-hit')


// =======================================
// 3. 세로 막대 차트
// =======================================
type ChartGroup = {
  name: string
  summary: string
  items: KpiView[]
}

function VerticalBarChart({
  groups,
  selectedRow,
  onSelect,
}: {
  groups: ChartGroup[]
  selectedRow: string
  onSelect: (kpi: KpiView) => void
}) {
  // 열 구성: [y축] [그룹1 막대들] [구분선] [그룹2 막대들] ...
  const columns: string[] = ['44px']
  const groupStarts: number[] = []

  groups.forEach((group, index) => {
    if (index > 0) columns.push('18px')
    groupStarts.push(columns.length + 1) // CSS grid 열 번호 (1부터)
    group.items.forEach(() => columns.push('minmax(44px, 1fr)'))
  })

  const gridStyle: CSSProperties = { gridTemplateColumns: columns.join(' ') }
  const plotEnd = columns.length + 1

  return (
    <div className="mbo-vchart" style={gridStyle}>
      {/* 3-1. 구분 제목 */}
      {groups.map((group, index) => (
        <div
          key={`head-${group.name}`}
          className="mbo-vchart-group"
          style={{ gridColumn: `${groupStarts[index]} / span ${group.items.length}`, gridRow: 1 }}
        >
          <strong>{group.name}</strong>
          <span>{group.summary}</span>
        </div>
      ))}

      {/* 3-2. 눈금 / 목표선 */}
      <div className="mbo-vchart-axis" style={{ gridColumn: 1, gridRow: 2 }} aria-hidden="true">
        {Y_TICKS.map((tick) => (
          <span
            key={tick}
            className={tick === 1 ? 'is-target' : undefined}
            style={{ bottom: `${(tick / BAR_MAX) * 100}%` }}
          >
            {tick === 1 ? <>목표<br />100%</> : `${tick * 100}%`}
          </span>
        ))}
      </div>

      <div className="mbo-vchart-grid" style={{ gridColumn: `2 / ${plotEnd}`, gridRow: 2 }} aria-hidden="true">
        {Y_TICKS.map((tick) => (
          <i key={tick} className={tick === 1 ? 'is-target' : undefined} style={{ bottom: `${(tick / BAR_MAX) * 100}%` }} />
        ))}
      </div>

      {/* 3-3. 구분선 (핵심 / 자율) */}
      {groups.slice(1).map((group, index) => (
        <div
          key={`divider-${group.name}`}
          className="mbo-vchart-divider"
          style={{ gridColumn: groupStarts[index + 1] - 1, gridRow: '1 / 5' }}
          aria-hidden="true"
        />
      ))}

      {/* 3-4. 막대 / 짧은 이름 / 대분류 묶음 */}
      {groups.map((group, groupIndex) => {
        const start = groupStarts[groupIndex]

        // 연속된 같은 대분류 묶기
        const categories: { name: string; from: number; count: number }[] = []
        group.items.forEach((kpi, index) => {
          const last = categories[categories.length - 1]
          if (kpi.대분류 && last && last.name === kpi.대분류 && last.from + last.count === index) {
            last.count += 1
          } else if (kpi.대분류) {
            categories.push({ name: kpi.대분류, from: index, count: 1 })
          }
        })

        return (
          <Fragment key={`bars-${group.name}`}>
            {group.items.map((kpi, index) => {
              const rate = kpi.rate ?? 0
              const height = (Math.min(Math.max(rate, 0), BAR_MAX) / BAR_MAX) * 100
              const isSelected = selectedRow === kpi.행

              return (
                <Fragment key={kpi.행}>
                  <div className="mbo-vbar-cell" style={{ gridColumn: start + index, gridRow: 2 }}>
                    <button
                      type="button"
                      className={`mbo-vbar ${barTone(kpi)} ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => onSelect(kpi)}
                      aria-pressed={isSelected}
                      aria-label={`${kpi.성과지표} 달성률 ${formatRate(kpi.rate)}, 실적 ${formatAmount(kpi, kpi.actual, kpi.진행실적)} / 목표 ${kpi.목표}`}
                    >
                      <span className="mbo-vbar-value" style={{ bottom: `${height}%` }}>{formatRate(kpi.rate)}</span>
                      <span className="mbo-vbar-fill" style={{ height: `${height}%` }} />
                      <span className="mbo-vbar-tip" role="tooltip">
                        <b>{kpi.성과지표}</b>
                        <span>실적 {formatAmount(kpi, kpi.actual, kpi.진행실적)} / 목표 {kpi.목표}</span>
                        <span>달성률 {formatRate(kpi.rate)} · {kpi.진행상태 || '진행현황 없음'}</span>
                      </span>
                    </button>
                  </div>

                  <div
                    className={`mbo-vbar-label ${barTone(kpi)} ${isSelected ? 'is-selected' : ''}`}
                    style={{ gridColumn: start + index, gridRow: 3 }}
                  >
                    {kpi.shortName}
                  </div>
                </Fragment>
              )
            })}

            {categories.map((category) => (
              <div
                key={`${category.name}-${category.from}`}
                className="mbo-vchart-category"
                style={{ gridColumn: `${start + category.from} / span ${category.count}`, gridRow: 4 }}
              >
                {category.name}
              </div>
            ))}
          </Fragment>
        )
      })}
    </div>
  )
}


// =======================================
// 4. 선택한 지표 상세 (20261127 추가: 진행현황 수정)
// =======================================
const DEFAULT_STATUS_OPTIONS = ['완료', '미진행']

function KpiDetail({
  kpi,
  statusOptions,
  onClose,
  onSaved,
}: {
  kpi: KpiView
  statusOptions: string[]
  onClose: () => void
  onSaved: (result: MboProgressResult) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [status, setStatus] = useState(kpi.진행상태)
  const [note, setNote] = useState(kpi.진행현황)
  const [actualText, setActualText] = useState(kpi.actual === null ? '' : String(kpi.actual))
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  // 시트 드롭다운 선택지 (없으면 기본값) + 현재 값
  const options = [...(statusOptions.length > 0 ? statusOptions : DEFAULT_STATUS_OPTIONS)]
  if (kpi.진행상태 && !options.includes(kpi.진행상태)) options.unshift(kpi.진행상태)

  // 진행실적 입력값 (쉼표 허용, 0 이상 숫자)
  const actualTrimmed = actualText.replace(/,/g, '').trim()
  const actualInput = actualTrimmed === '' ? null : Number(actualTrimmed)
  const isActualValid = actualInput !== null && Number.isFinite(actualInput) && actualInput >= 0
  const isActualChanged = actualTrimmed !== '' && actualInput !== kpi.actual
  const previewRate = isActualValid && kpi.target ? (actualInput as number) / kpi.target : null

  const isChanged = status !== kpi.진행상태 || note !== kpi.진행현황 || isActualChanged

  const startEdit = () => {
    setStatus(kpi.진행상태)
    setNote(kpi.진행현황)
    setActualText(kpi.actual === null ? '' : String(kpi.actual))
    setMessage(null)
    setIsEditing(true)
  }

  const save = async () => {
    if (!isChanged) {
      setIsEditing(false)
      return
    }

    if (isActualChanged && !isActualValid) {
      setMessage({ tone: 'error', text: '진행실적은 0 이상의 숫자로 입력해 주세요.' })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const result = await updateMboProgress(kpi.행, {
        name: kpi.성과지표,
        ...(status !== kpi.진행상태 ? { status } : {}),
        ...(note !== kpi.진행현황 ? { note } : {}),
        ...(isActualChanged ? { actual: actualInput as number } : {}),
      })

      onSaved(result)
      setIsEditing(false)
      setMessage({ tone: 'success', text: '시트에 저장했습니다.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : '진행현황 저장에 실패했습니다.' })
    } finally {
      setIsSaving(false)
    }
  }

  const details = [
    { label: '세부내용', value: kpi.세부내용 },
    { label: '증빙방법', value: kpi.증빙방법 },
    { label: '진행예정', value: kpi.진행예정 },
    { label: '비고', value: kpi.비고 },
  ].filter((item) => item.value.trim())

  return (
    <section className="mbo-detail" aria-label={`${kpi.성과지표} 세부내용`}>
      <header>
        <div>
          <p>{[kpi.구분, kpi.대분류].filter(Boolean).join(' · ')}</p>
          <h3>{kpi.성과지표}</h3>
        </div>
        <div className="mbo-detail-figures">
          <span className={`mbo-detail-rate ${kpi.achieved ? 'is-hit' : 'is-miss'}`}>{formatRate(kpi.rate)}</span>
          <span>실적 <b>{formatAmount(kpi, kpi.actual, kpi.진행실적)}</b> / 목표 {kpi.목표}</span>
          {kpi.진행상태 && <span className={`mbo-pill ${kpi.isDone ? 'is-hit' : 'is-miss'}`}>{kpi.진행상태}</span>}
        </div>
        <button type="button" className="calendar-modal-close" onClick={onClose} disabled={isSaving} aria-label="세부내용 닫기">×</button>
      </header>

      {/* 4-1. 진행현황 (보기 / 수정) */}
      <div className={`mbo-progress ${isEditing ? 'is-editing' : ''}`}>
        <div className="mbo-progress-head">
          <h4>진행현황</h4>
          {!isEditing && (
            <button type="button" className="mbo-edit-button" onClick={startEdit}>
              진행현황 수정
            </button>
          )}
        </div>

        {isEditing ? (
          <>
            <label className="mbo-field">
              <span>진행 상태</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={isSaving}>
                {!status && <option value="">선택</option>}
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>

            <label className="mbo-field">
              <span>진행실적</span>
              <span className="mbo-actual-input">
                <input
                  type="text"
                  inputMode="decimal"
                  value={actualText}
                  onChange={(event) => setActualText(event.target.value)}
                  disabled={isSaving}
                  aria-invalid={actualTrimmed !== '' && !isActualValid}
                />
                {kpi.unit && <em>{kpi.unit}</em>}
                <small className={actualTrimmed !== '' && !isActualValid ? 'is-error' : undefined}>
                  {actualTrimmed !== '' && !isActualValid
                    ? '0 이상의 숫자로 입력해 주세요.'
                    : `정량목표 ${kpi.target === null ? kpi.정량목표 || '-' : formatNumber(kpi.target)}${kpi.unit}${previewRate !== null ? ` · 달성률 ${formatRate(previewRate)}` : ''}`}
                </small>
              </span>
            </label>

            <label className="mbo-field">
              <span>진행 메모</span>
              <textarea
                value={note}
                rows={Math.min(Math.max(note.split('\n').length + 1, 4), 12)}
                maxLength={5000}
                placeholder="예) - 12월 연구결과보고서 완성 예정"
                onChange={(event) => setNote(event.target.value)}
                disabled={isSaving}
              />
            </label>

            <div className="mbo-progress-actions">
              <span>저장하면 MBO 시트 {kpi.행}행에 바로 반영됩니다. (진행실적을 바꾸면 진행율도 다시 계산)</span>
              <button type="button" className="mbo-cancel-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
                취소
              </button>
              <button type="button" className="mbo-save-button" onClick={save} disabled={isSaving || !isChanged}>
                {isSaving ? '저장 중...' : '시트에 저장'}
              </button>
            </div>
          </>
        ) : (
          <p className="mbo-progress-note">{kpi.진행현황.trim() || '등록된 진행현황이 없습니다.'}</p>
        )}

        {message && (
          <p className={`mbo-progress-message is-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}
      </div>

      {/* 4-2. 나머지 상세 */}
      {details.length > 0 && (
        <dl>
          {details.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}


// =======================================
// 5. 화면
// =======================================
function MboPage() {
  const { result, data, error, isLoading, reload, mutate } = useOperationData('mbo')
  const [selectedRow, setSelectedRow] = useState('')

  const kpis = useMemo(() => (data?.kpis ?? []).map(toKpiView), [data])

  const groups = useMemo<ChartGroup[]>(() => {
    const names = kpis.map((kpi) => kpi.구분).filter((name, index, list) => list.indexOf(name) === index)

    return names.map((name) => {
      const items = kpis.filter((kpi) => kpi.구분 === name)
      const hit = items.filter((kpi) => kpi.achieved).length

      return {
        name: name || '성과지표',
        items,
        summary: `${hit} / ${items.length}개 달성 · 평균 ${Math.round(cappedAverage(items) * 100)}%`,
      }
    })
  }, [kpis])

  const achievedCount = kpis.filter((kpi) => kpi.achieved).length
  const averageRate = cappedAverage(kpis)
  const focusKpis = kpis.filter((kpi) => !kpi.achieved || (kpi.진행상태 && !kpi.isDone))
  const selectedKpi = kpis.find((kpi) => kpi.행 === selectedRow) ?? null

  const findKpi = (match: string) => kpis.find((kpi) => compactText(kpi.성과지표).includes(match))

  return (
    <div className="page-content">
      <OpsPageHeading
        eyebrow="MBO"
        title="MBO"
        subtitle={data?.title || '성과지표별 목표 대비 실적과 달성률을 확인합니다.'}
        sheetName={result?.sheetName ? `${result.sheetName} · 최종목표지표 기준` : undefined}
      >
        <button type="button" className="refresh-button" onClick={reload} disabled={isLoading}>
          <Icon name="refresh" size={16} />
          {isLoading ? '조회 중...' : '새로고침'}
        </button>
      </OpsPageHeading>

      <div className="ops-page">
        <OpsLoadGuard isLoading={isLoading} error={error} hasData={Boolean(data)}>
          {kpis.length === 0 ? (
            <section className="surface-card perf-placeholder">MBO 시트에 최종목표지표가 없습니다.</section>
          ) : (
            <>
              {/* 5-1. 상단 요약 숫자 */}
              <section className="mbo-summary">
                <article className="surface-card">
                  <span>정량지표 달성</span>
                  <strong>{achievedCount}<small> / {kpis.length}</small></strong>
                  <div className="mbo-summary-bar">
                    <i style={{ width: `${(achievedCount / kpis.length) * 100}%` }} />
                  </div>
                </article>

                <article className="surface-card">
                  <span>평균 달성률</span>
                  <strong>{Math.round(averageRate * 100)}%</strong>
                  <small>100% 상한 기준</small>
                </article>

                {SUMMARY_CARDS.map((card) => {
                  const kpi = findKpi(card.match)

                  return (
                    <article key={card.label} className="surface-card">
                      <span>{card.label}</span>
                      <strong>
                        {kpi?.actual !== null && kpi?.actual !== undefined ? formatNumber(kpi.actual) : '-'}
                        {kpi && <small>{kpi.unit}</small>}
                      </strong>
                      {kpi && (
                        <small className={kpi.achieved ? 'is-hit' : 'is-miss'}>
                          목표 {kpi.목표} · {formatRate(kpi.rate)} {kpi.achieved ? '▲' : '▼'}
                        </small>
                      )}
                    </article>
                  )
                })}
              </section>

              {/* 5-2. 집중 관리 필요 지표 */}
              {focusKpis.map((kpi) => (
                <button
                  key={kpi.행}
                  type="button"
                  className={`mbo-alert ${kpi.achieved ? 'is-warning' : ''}`}
                  onClick={() => setSelectedRow(kpi.행)}
                >
                  <strong className="mbo-alert-rate">{formatRate(kpi.rate)}</strong>
                  <span className="mbo-alert-body">
                    <span className="mbo-alert-title">
                      <b>{kpi.성과지표}</b>
                      {kpi.진행상태 && <span className={`mbo-pill ${kpi.isDone ? 'is-hit' : 'is-miss'}`}>{kpi.진행상태}</span>}
                    </span>
                    <span className="mbo-alert-text">
                      {kpi.achieved && '목표는 달성했지만 진행현황이 완료가 아닙니다 · '}
                      실적 {formatAmount(kpi, kpi.actual, kpi.진행실적)} / 목표 {kpi.목표}
                      {firstLine(kpi.진행현황) && ` · ${firstLine(kpi.진행현황)}`}
                    </span>
                    <span className="mbo-alert-bar">
                      <i style={{ width: `${Math.min(kpi.rate ?? 0, 1) * 100}%` }} />
                    </span>
                  </span>
                </button>
              ))}

              {/* 5-3. 성과지표별 달성률 */}
              <section className="surface-card mbo-chart-card">
                <div className="ops-table-heading">
                  <h2>성과지표별 달성률</h2>
                  <p>{result?.fetchedAt ? `${formatFetchedAt(result.fetchedAt)} 기준 · 막대를 누르면 세부내용이 아래에 표시됩니다` : ''}</p>
                </div>

                <div className="mbo-vchart-scroll">
                  <VerticalBarChart
                    groups={groups}
                    selectedRow={selectedKpi?.행 ?? ''}
                    onSelect={(kpi) => setSelectedRow((current) => (current === kpi.행 ? '' : kpi.행))}
                  />
                </div>

                <footer className="mbo-chart-legend">
                  <span><i className="is-hit" />달성 (100% 이상)</span>
                  <span><i className="is-max" />150% 이상 (막대는 150%에서 멈추고 숫자로 표시)</span>
                  <span><i className="is-miss" />미달 (100% 미만)</span>
                </footer>

                {selectedKpi && (
                  <KpiDetail
                    key={selectedKpi.행}
                    kpi={selectedKpi}
                    statusOptions={data?.statusOptions ?? []}
                    onClose={() => setSelectedRow('')}
                    onSaved={(saved) => mutate((current) => ({
                      ...current,
                      kpis: current.kpis.map((item) => (item.행 === saved.행
                        ? {
                          ...item,
                          진행상태: saved.진행상태,
                          진행현황: saved.진행현황,
                          진행실적: saved.진행실적 || item.진행실적,
                          진행율: saved.진행율 || item.진행율,
                        }
                        : item)),
                    }))}
                  />
                )}
              </section>
            </>
          )}
        </OpsLoadGuard>
      </div>
    </div>
  )
}

export default MboPage
