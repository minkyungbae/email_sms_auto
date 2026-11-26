/**
 * @file MaterialsPage.tsx
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 교구재 화면 (시트: 7.센터_교구재)
 *
 * 20261126 수정: 표 → 지역별 보관함(팬트리) 형식으로 변경
 * - 지역(강릉 / 원주 / 춘천 ...)을 공간처럼 선택
 * - 선택한 지역 안에서 "센터 교구" / "센터 기자재" 선반으로 나눠 5열 칸에 품목 배치
 *   (화면 폭에 따라 3열 → 2열로 줄어듦)
 * - 칸에는 품목명과 사용 가능 / 확인 수량 표시, 고장·분실이 있으면 표시
 * - 칸을 누르면 품목 상세(시트 컬럼 전체) 창 표시
 * - 교구재명·인계장소·관리 내용 검색
 */

import { useEffect, useMemo, useState } from 'react'

import { OperationPage, OpsSearch, OpsStat, OpsStatGrid, OpsTabs, OpsToolbar } from '../Components/OperationUI'
import { useOperationData } from '../Hooks/useOperationData'
import type { SheetRecord } from '../Types/operations'
import {
  formatNumber,
  formatSheetDate,
  matchesKeyword,
  sumBy,
  toNumber,
  uniqueValues,
} from '../Utils/operationFormat'


// =======================================
// 1. 설정 및 타입
// =======================================
const NO_REGION = '지역 미지정'
const QUANTITY_HEADERS = ['확인수량', '고장수량', '분실수량', '대여수량', '사용가능수량']

/** 보관함 칸 하나 (시트 한 행) */
type MaterialItem = {
  key: string
  shelf: string // 센터 교구 보유 현황 / 센터 기자재 보유 현황
  shelfIndex: number
  headers: string[]
  record: SheetRecord
}

const regionOf = (item: MaterialItem) => item.record['지역']?.trim() || NO_REGION
const quantity = (item: MaterialItem, header: string) => toNumber(item.record[header]) ?? 0
const problemCount = (item: MaterialItem) => quantity(item, '고장수량') + quantity(item, '분실수량')

// "센터 교구 보유 현황" → "센터 교구"
function shelfLabel(title: string, index: number): string {
  return title.replace(/\s*보유\s*현황\s*$/, '').trim() || `보관함 ${index + 1}`
}

function displayValue(header: string, value: string): string {
  if (!value) return '-'
  if (header === '인계일자') return formatSheetDate(value)
  return value
}


// =======================================
// 2. 품목 상세 창
// =======================================
function MaterialModal({ item, onClose }: { item: MaterialItem; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const quantityHeaders = item.headers.filter((header) => QUANTITY_HEADERS.includes(header))
  const infoHeaders = item.headers.filter((header) => !QUANTITY_HEADERS.includes(header) && header !== '교구재명')

  return (
    <div
      className="calendar-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="material-modal-title">
        <header className="calendar-modal-header">
          <div>
            <p className="calendar-modal-eyebrow">{shelfLabel(item.shelf, item.shelfIndex)}</p>
            <h2 id="material-modal-title">{item.record['교구재명'] || '-'}</h2>
            <p>{regionOf(item)} · 시트 {item.record['행']}행</p>
          </div>

          <button type="button" className="calendar-modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="calendar-modal-body">
          {problemCount(item) > 0 && (
            <div className="perf-message perf-message-warning material-modal-alert" role="note">
              고장 {formatNumber(quantity(item, '고장수량'))} · 분실 {formatNumber(quantity(item, '분실수량'))}
              {item.record['관리(고장/분실 등)'] ? ` — ${item.record['관리(고장/분실 등)']}` : ''}
            </div>
          )}

          <div className="material-quantity-grid">
            {quantityHeaders.map((header) => (
              <div key={header} className={header === '사용가능수량' ? 'is-primary' : undefined}>
                <span>{header}</span>
                <strong>{item.record[header] || '0'}</strong>
              </div>
            ))}
          </div>

          <dl className="calendar-detail-grid material-detail-grid">
            {infoHeaders.map((header) => (
              <div key={header} className="calendar-detail-field">
                <dt>{header}</dt>
                <dd>{displayValue(header, item.record[header] ?? '')}</dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="calendar-modal-footer">
          <button type="button" className="calendar-modal-confirm" onClick={onClose}>
            닫기
          </button>
        </footer>
      </section>
    </div>
  )
}


// =======================================
// 3. 화면
// =======================================
function MaterialsPage() {
  const { result, data, error, isLoading, reload } = useOperationData('materials')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [keyword, setKeyword] = useState('')
  const [openItem, setOpenItem] = useState<MaterialItem | null>(null)

  // 두 표(교구 / 기자재)의 행을 하나의 품목 목록으로
  const items = useMemo<MaterialItem[]>(() => (data?.tables ?? []).flatMap((table, shelfIndex) =>
    table.records.map((record, index) => ({
      key: `${shelfIndex}-${record['행'] ?? index}`,
      shelf: table.title,
      shelfIndex,
      headers: table.headers,
      record,
    })),
  ), [data])

  const shelves = useMemo(
    () => (data?.tables ?? []).map((table, index) => ({ index, title: table.title })),
    [data],
  )

  const regions = useMemo(() => uniqueValues(items, regionOf), [items])
  const region = regions.includes(selectedRegion) ? selectedRegion : regions[0] ?? ''

  const regionItems = useMemo(
    () => items.filter((item) => regionOf(item) === region),
    [items, region],
  )

  const visibleItems = useMemo(
    () => regionItems.filter((item) => matchesKeyword(
      [item.record['교구재명'], item.record['인계장소'], item.record['관리(고장/분실 등)'], item.record['비고']],
      keyword,
    )),
    [regionItems, keyword],
  )

  const total = (header: string) => sumBy(visibleItems, (item) => item.record[header])
  const problemTotal = total('고장수량') + total('분실수량')

  return (
    <OperationPage
      eyebrow="MATERIALS"
      title="교구재"
      subtitle="지역별 보관함에서 교구·기자재를 확인하고, 품목을 눌러 상세 정보를 봅니다."
      sheetName={result?.sheetName}
      isLoading={isLoading}
      error={error}
      hasData={Boolean(data)}
    >
      {items.length === 0 ? (
        <section className="surface-card perf-placeholder">
          시트에 등록된 교구재가 아직 없습니다.
        </section>
      ) : (
        <>
          {/* 3-1. 지역(공간) 선택 */}
          <OpsTabs
            tabs={regions.map((name) => ({
              key: name,
              label: `${name} ${formatNumber(items.filter((item) => regionOf(item) === name).length)}`,
            }))}
            value={region}
            onChange={(key) => {
              setSelectedRegion(key)
              setOpenItem(null)
            }}
          />

          <OpsToolbar fetchedAt={result?.fetchedAt} isLoading={isLoading} onRefresh={reload} onReset={() => setKeyword('')}>
            <OpsSearch value={keyword} placeholder="교구재명, 인계장소, 관리 내용" onChange={setKeyword} />
          </OpsToolbar>

          <OpsStatGrid>
            <OpsStat label={`${region} 품목`} value={`${formatNumber(visibleItems.length)}개`} />
            <OpsStat label="확인 수량" value={formatNumber(total('확인수량'))} />
            <OpsStat label="사용 가능" value={formatNumber(total('사용가능수량'))} />
            <OpsStat label="대여 중" value={formatNumber(total('대여수량'))} />
            <OpsStat
              label="고장 · 분실"
              value={formatNumber(problemTotal)}
              detail={`고장 ${formatNumber(total('고장수량'))} · 분실 ${formatNumber(total('분실수량'))}`}
              tone={problemTotal > 0 ? 'warning' : 'default'}
            />
          </OpsStatGrid>

          {/* 3-2. 선반별 품목 칸 */}
          {shelves.map((shelf) => {
            const shelfItems = visibleItems.filter((item) => item.shelfIndex === shelf.index)

            return (
              <section key={shelf.index} className="surface-card material-shelf">
                <div className="ops-table-heading">
                  <h2>{region} · {shelfLabel(shelf.title, shelf.index)}</h2>
                  <p>{formatNumber(shelfItems.length)}개</p>
                </div>

                {shelfItems.length === 0 ? (
                  <p className="material-shelf-empty">
                    {keyword ? '검색 조건에 맞는 품목이 없습니다.' : '이 보관함에 등록된 품목이 없습니다.'}
                  </p>
                ) : (
                  <div className="material-grid">
                    {shelfItems.map((item) => {
                      const available = item.record['사용가능수량']
                      const checked = item.record['확인수량']

                      return (
                        <button
                          key={item.key}
                          type="button"
                          className={`material-tile ${problemCount(item) > 0 ? 'has-problem' : ''}`}
                          onClick={() => setOpenItem(item)}
                        >
                          <strong>{item.record['교구재명'] || '-'}</strong>
                          <span className="material-tile-quantity">
                            사용 가능 <b>{available || '0'}</b>
                            {checked && <> / {checked}</>}
                          </span>
                          {problemCount(item) > 0 && (
                            <span className="material-tile-alert">
                              고장·분실 {formatNumber(problemCount(item))}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </>
      )}

      {openItem && <MaterialModal item={openItem} onClose={() => setOpenItem(null)} />}
    </OperationPage>
  )
}

export default MaterialsPage
