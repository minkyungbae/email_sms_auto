/**
 * @file OperationUI.tsx
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 운영 데이터 화면 공통 UI
 * - OperationPage / OpsPageHeading / OpsLoadGuard: 페이지 제목 + 오류/로딩 처리
 * - OpsToolbar: 필터 + 새로고침 + 조회 시각
 * - OpsSelect / OpsSearch: 필터 입력
 * - OpsStatGrid / OpsStat: 요약 지표
 * - OpsTable: 머리글 고정 표 (20261126 추가: 행 클릭·선택 표시)
 */

import type { ReactNode } from 'react'

import { Icon } from './DashboardUI'
import { formatFetchedAt } from '../Utils/operationFormat'


// =======================================
// 1. 페이지 틀
// =======================================
type PageHeadingProps = {
  eyebrow: string
  title: string
  subtitle: string
  sheetName?: string
  children?: ReactNode // 제목 아래 영역 (예: 탭)
}

export function OpsPageHeading({ eyebrow, title, subtitle, sheetName, children }: PageHeadingProps) {
  return (
    <section className="page-heading ops-page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">
          {subtitle}
          {sheetName && <span className="ops-sheet-name"> · 시트: {sheetName}</span>}
        </p>
      </div>
      {children}
    </section>
  )
}

// 오류 / 로딩 안내 후 데이터가 있으면 내용 표시
export function OpsLoadGuard({
  isLoading,
  error,
  hasData,
  children,
}: {
  isLoading: boolean
  error: string
  hasData: boolean
  children: ReactNode
}) {
  return (
    <>
      {error && !isLoading && (
        <div className="perf-message perf-message-error" role="alert">
          {error}
        </div>
      )}

      {hasData ? children : (
        <section className="surface-card perf-placeholder" aria-busy={isLoading}>
          {isLoading ? '시트를 불러오고 있습니다.' : '시트를 불러오지 못했습니다.'}
        </section>
      )}
    </>
  )
}

type OperationPageProps = PageHeadingProps & {
  isLoading: boolean
  error: string
  hasData: boolean
  children: ReactNode
}

export function OperationPage({ isLoading, error, hasData, children, ...heading }: OperationPageProps) {
  return (
    <div className="page-content">
      <OpsPageHeading {...heading} />

      <div className="ops-page">
        <OpsLoadGuard isLoading={isLoading} error={error} hasData={hasData}>
          {children}
        </OpsLoadGuard>
      </div>
    </div>
  )
}


// =======================================
// 2. 툴바 (필터 + 새로고침)
// =======================================
type OpsToolbarProps = {
  children?: ReactNode
  fetchedAt?: string
  isLoading: boolean
  onRefresh: () => void
  onReset?: () => void
}

export function OpsToolbar({ children, fetchedAt, isLoading, onRefresh, onReset }: OpsToolbarProps) {
  return (
    <section className="surface-card ops-toolbar" aria-label="조회 조건">
      <div className="ops-filters">{children}</div>

      <div className="ops-toolbar-actions">
        {fetchedAt && <span className="ops-fetched-at">{formatFetchedAt(fetchedAt)} 기준</span>}
        {onReset && (
          <button type="button" className="ops-reset-button" onClick={onReset}>
            초기화
          </button>
        )}
        <button type="button" className="refresh-button" onClick={onRefresh} disabled={isLoading}>
          <Icon name="refresh" size={16} />
          {isLoading ? '조회 중...' : '새로고침'}
        </button>
      </div>
    </section>
  )
}


// =======================================
// 3. 필터 입력
// =======================================
type OpsSelectProps = {
  label: string
  value: string
  options: (string | { value: string; label: string })[]
  allLabel?: string
  onChange: (value: string) => void
}

export function OpsSelect({ label, value, options, allLabel = '전체', onChange }: OpsSelectProps) {
  return (
    <label className="ops-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          )
        })}
      </select>
    </label>
  )
}

type OpsSearchProps = {
  label?: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}

export function OpsSearch({ label = '검색', value, placeholder, onChange }: OpsSearchProps) {
  return (
    <label className="ops-field ops-field-wide">
      <span>{label}</span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}


// =======================================
// 4. 요약 지표
// =======================================
export function OpsStatGrid({ children }: { children: ReactNode }) {
  return <section className="ops-stat-grid">{children}</section>
}

type OpsStatProps = {
  label: string
  value: string
  detail?: string
  tone?: 'default' | 'warning' | 'danger'
}

export function OpsStat({ label, value, detail, tone = 'default' }: OpsStatProps) {
  return (
    <article className={`surface-card ops-stat ops-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  )
}


// =======================================
// 5. 표
// =======================================
export type OpsColumn<T> = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  render?: (row: T) => ReactNode
  value?: (row: T) => string // render 없을 때 표시 값 (기본: row[key])
}

type OpsTableProps<T> = {
  title?: string
  caption?: string
  columns: OpsColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  emptyText?: string
  rowClassName?: (row: T) => string | undefined
  footer?: ReactNode
  compact?: boolean
  onRowClick?: (row: T) => void // 20261126 추가: 행 클릭 (상세 보기)
  isRowSelected?: (row: T) => boolean // 20261126 추가: 선택된 행 강조
}

export function OpsTable<T>({
  title,
  caption,
  columns,
  rows,
  rowKey,
  emptyText = '표시할 데이터가 없습니다.',
  rowClassName,
  footer,
  compact = false,
  onRowClick,
  isRowSelected,
}: OpsTableProps<T>) {
  return (
    <section className="surface-card ops-table-card">
      {(title || caption) && (
        <div className="ops-table-heading">
          {title && <h2>{title}</h2>}
          {caption && <p>{caption}</p>}
        </div>
      )}

      <div className={`ops-table-scroll ${compact ? 'is-compact' : ''}`}>
        <table className="ops-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.align ? `is-${column.align}` : undefined} scope="col">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="ops-empty" colSpan={columns.length}>{emptyText}</td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className={[
                    rowClassName?.(row),
                    onRowClick ? 'is-clickable' : '',
                    isRowSelected?.(row) ? 'is-selected' : '',
                  ].filter(Boolean).join(' ') || undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onRowClick(row)
                    }
                  } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={isRowSelected ? isRowSelected(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={column.align ? `is-${column.align}` : undefined}>
                      {column.render
                        ? column.render(row)
                        : column.value
                          ? column.value(row)
                          : String((row as Record<string, unknown>)[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    </section>
  )
}


// =======================================
// 6. 배지
// =======================================
export function OpsBadge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'dark' | 'warning' | 'danger' }) {
  return <span className={`ops-badge ops-badge-${tone}`}>{children}</span>
}

export function OpsTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[]
  value: K
  onChange: (key: K) => void
}) {
  return (
    <div className="ops-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          className={`ops-tab ${value === tab.key ? 'is-active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
