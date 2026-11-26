/**
 * @file InstructorFeePage.tsx
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 강사비 화면
 * - 연간 현황 (시트: 5.센터_강사비(연간))
 *   예산 현황 / 항목별 월 합계 (일치여부 불일치 강조) / 강사별 월 지급 상세
 * - 지역별 현황 (시트: 6.센터_강사비(지역))
 *   지역별 월별 현황 / 지역별 연간 현황 / 월별 지역 현황 / 지역별 주유비·이동비
 * 탭을 처음 열 때 해당 시트를 조회
 */

import { useMemo, useState } from 'react'

import {
  OpsLoadGuard,
  OpsPageHeading,
  OpsSearch,
  OpsSelect,
  OpsStat,
  OpsStatGrid,
  OpsTable,
  OpsTabs,
  OpsToolbar,
} from '../Components/OperationUI'
import type { OpsColumn } from '../Components/OperationUI'
import { useOperationData } from '../Hooks/useOperationData'
import type { FeeAnnualSheet, RowTable, SheetRecord } from '../Types/operations'
import {
  formatNumber,
  formatWon,
  matchesKeyword,
  toNumber,
  uniqueValues,
} from '../Utils/operationFormat'

type FeeTab = 'annual' | 'region'

const TOTAL_LABELS = ['합계', '운영국 총 합계', '진흥원 파일 총 합계']
const MATCH_LABEL = '일치여부'

const isTotalLabel = (label: string) => TOTAL_LABELS.includes(label.trim())


// =======================================
// 1. 공통: 시트 헤더 그대로 표시하는 표
// 첫 칸(월·지역 등)은 왼쪽, 나머지는 오른쪽 정렬 / 합계 행 강조
// =======================================
function DynamicTable({
  title,
  caption,
  table,
  groupHeaders = 1,
  scroll = false,
}: {
  title: string
  caption?: string
  table: RowTable
  groupHeaders?: number // 왼쪽 정렬할 앞쪽 컬럼 수
  scroll?: boolean // 행이 많은 표는 세로 스크롤
}) {
  const columns: OpsColumn<SheetRecord>[] = table.headers.map((header, index) => ({
    key: header,
    label: header,
    align: index < groupHeaders ? 'left' : 'right',
  }))

  return (
    <OpsTable
      title={title}
      caption={caption}
      columns={columns}
      rows={table.rows}
      rowKey={(row, index) => `${row['행'] ?? ''}-${index}`}
      rowClassName={(row) => table.headers.slice(0, groupHeaders).some((header) => isTotalLabel(row[header] ?? '')) ? 'is-total' : undefined}
      compact={!scroll}
    />
  )
}


// =======================================
// 2. 연간 현황
// =======================================
function formatRate(value: string): string {
  if (!value) return '-'
  if (value.includes('%')) return value

  const number = toNumber(value)
  if (number === null) return value

  return `${formatNumber(number <= 1 ? number * 100 : number)}%`
}

// 강사별 상세에서 보여줄 컬럼 (시트에 있는 컬럼만 표시)
const DETAIL_COLUMNS = [
  '강의월',
  '지역',
  '강사명',
  '강사유형',
  '시급',
  '총 강의시간',
  '총 강의비(A)',
  '총 이동거리',
  '총 교통비(B)',
  '총 기타수당(C)',
  '총 교육수강&교안개발비(D)',
  '총 지급액(월)(A~D)',
  '은행명',
  '예금주',
  '계좌번호',
]
const DETAIL_TEXT_COLUMNS = ['강의월', '지역', '강사명', '강사유형', '은행명', '예금주', '계좌번호']

const EMPTY_DETAIL_FILTERS = { month: '', region: '', type: '', keyword: '' }

function ItemTable({ sheet }: { sheet: FeeAnnualSheet }) {
  const columns: OpsColumn<FeeAnnualSheet['items'][number]>[] = [
    { key: '항목', label: '항목', render: (row) => <strong className="ops-cell-title">{row.항목}</strong> },
    ...sheet.months.map((month) => ({
      key: month,
      label: month,
      align: 'right' as const,
      render: (row: FeeAnnualSheet['items'][number]) => {
        const value = row.values[month] ?? ''
        const isMismatch = row.항목 === MATCH_LABEL && (toNumber(value) ?? 0) !== 0

        return <span className={isMismatch ? 'ops-cell-danger' : undefined}>{value}</span>
      },
    })),
  ]

  const mismatchMonths = sheet.months.filter((month) => {
    const row = sheet.items.find((item) => item.항목 === MATCH_LABEL)
    return month !== '총합계' && (toNumber(row?.values[month]) ?? 0) !== 0
  })

  return (
    <>
      <OpsTable
        title="항목별 월 합계"
        caption={sheet.notes.join(' · ')}
        columns={columns}
        rows={sheet.items}
        rowKey={(row) => row.항목}
        rowClassName={(row) => isTotalLabel(row.항목) ? 'is-total' : row.항목 === MATCH_LABEL ? 'is-muted' : undefined}
        compact
      />
      {mismatchMonths.length > 0 && (
        <div className="perf-message perf-message-warning" role="note">
          운영국 합계와 진흥원 파일 합계가 다른 달이 있습니다: {mismatchMonths.join(', ')}
        </div>
      )}
    </>
  )
}

function FeeAnnualView() {
  const { result, data, error, isLoading, reload } = useOperationData('fee-annual')
  const [filters, setFilters] = useState(EMPTY_DETAIL_FILTERS)

  const records = useMemo(() => data?.detail.records ?? [], [data])
  const headers = useMemo(() => data?.detail.headers ?? [], [data])

  const options = useMemo(() => ({
    month: uniqueValues(records, (row) => row['강의월']),
    region: uniqueValues(records, (row) => row['지역']),
    type: uniqueValues(records, (row) => row['강사유형']),
  }), [records])

  const rows = useMemo(() => records.filter((row) =>
    (!filters.month || row['강의월'] === filters.month) &&
    (!filters.region || row['지역'] === filters.region) &&
    (!filters.type || row['강사유형'] === filters.type) &&
    matchesKeyword([row['강사명'], row['예금주']], filters.keyword),
  ), [records, filters])

  const detailColumns: OpsColumn<SheetRecord>[] = DETAIL_COLUMNS
    .filter((header) => headers.includes(header))
    .map((header) => ({
      key: header,
      label: header,
      align: DETAIL_TEXT_COLUMNS.includes(header) ? 'left' : 'right',
    }))

  const totalHeader = headers.find((header) => header.startsWith('총 지급액'))
  const setFilter = (name: keyof typeof EMPTY_DETAIL_FILTERS) => (value: string) =>
    setFilters((current) => ({ ...current, [name]: value }))

  const budget = (label: string) => data?.budget.find((item) => item.label === label)?.value ?? ''

  return (
    <OpsLoadGuard isLoading={isLoading} error={error} hasData={Boolean(data)}>
      {data && (
        <>
          <OpsToolbar fetchedAt={result?.fetchedAt} isLoading={isLoading} onRefresh={reload} onReset={() => setFilters(EMPTY_DETAIL_FILTERS)}>
            <OpsSelect label="강의월" value={filters.month} options={options.month} onChange={setFilter('month')} />
            <OpsSelect label="지역" value={filters.region} options={options.region} onChange={setFilter('region')} />
            <OpsSelect label="강사유형" value={filters.type} options={options.type} onChange={setFilter('type')} />
            <OpsSearch value={filters.keyword} placeholder="강사명, 예금주" onChange={setFilter('keyword')} />
          </OpsToolbar>

          <OpsStatGrid>
            <OpsStat label="전체 인건비 (A)" value={formatWon(toNumber(budget('전체인건비 (A)')))} />
            <OpsStat label="사용 총액 (B)" value={formatWon(toNumber(budget('사용총액 (B)')))} />
            <OpsStat label="잔액 (A-B)" value={formatWon(toNumber(budget('잔액 (A-B)')))} />
            <OpsStat label="예산 대비 사용률" value={formatRate(budget('예산대비사용률'))} />
          </OpsStatGrid>

          <ItemTable sheet={data} />

          <OpsTable
            title="강사별 월 지급 상세"
            caption={`${formatNumber(rows.length)}건${totalHeader ? ` · 지급액 합계 ${formatWon(rows.reduce((sum, row) => sum + (toNumber(row[totalHeader]) ?? 0), 0))}` : ''} · 계좌번호는 끝 4자리만 표시`}
            columns={detailColumns}
            rows={rows}
            rowKey={(row) => row['행']}
            emptyText={records.length === 0 ? '시트에 강사별 지급 내역이 아직 없습니다.' : '조건에 맞는 지급 내역이 없습니다.'}
          />
        </>
      )}
    </OpsLoadGuard>
  )
}


// =======================================
// 3. 지역별 현황
// =======================================
function FeeRegionView() {
  const { result, data, error, isLoading, reload } = useOperationData('fee-region')
  const [region, setRegion] = useState('')
  const [month, setMonth] = useState('')

  const regionNames = useMemo(() => data?.regions.map((item) => item.region) ?? [], [data])
  const selectedRegion = data?.regions.find((item) => item.region === region) ?? data?.regions[0]

  const monthHeader = data?.monthly.headers[0] ?? '해당월'
  const monthOptions = useMemo(() => uniqueValues(data?.monthly.rows ?? [], (row) => row[monthHeader]), [data, monthHeader])
  const monthlyRows = useMemo(
    () => (data?.monthly.rows ?? []).filter((row) => !month || row[monthHeader] === month),
    [data, month, monthHeader],
  )

  return (
    <OpsLoadGuard isLoading={isLoading} error={error} hasData={Boolean(data)}>
      {data && (
        <>
          <OpsToolbar fetchedAt={result?.fetchedAt} isLoading={isLoading} onRefresh={reload}>
            <OpsSelect label="월별 지역 현황 - 월" value={month} options={monthOptions} onChange={setMonth} />
          </OpsToolbar>

          {data.annual.rows.length > 0 && (
            <DynamicTable title="지역별 연간 현황" table={data.annual} groupHeaders={2} />
          )}

          {selectedRegion && (
            <section className="ops-section">
              <div className="ops-section-heading">
                <h2>지역별 월별 현황</h2>
                <OpsTabs
                  tabs={regionNames.map((name) => ({ key: name, label: name }))}
                  value={selectedRegion.region}
                  onChange={setRegion}
                />
              </div>
              <DynamicTable title={`${selectedRegion.region} 월별 현황`} table={selectedRegion} />
            </section>
          )}

          <DynamicTable
            title="월별 지역 현황"
            caption={month ? `${month}` : '전체 월'}
            table={{ headers: data.monthly.headers, rows: monthlyRows }}
            groupHeaders={2}
            scroll
          />

          {data.paymentTables.length > 0 && (
            <div className="ops-two-column">
              {data.paymentTables.map((table) => (
                <DynamicTable key={table.title} title={table.title || '지급 현황'} table={table} />
              ))}
            </div>
          )}
        </>
      )}
    </OpsLoadGuard>
  )
}


// =======================================
// 4. 화면
// =======================================
function InstructorFeePage() {
  const [tab, setTab] = useState<FeeTab>('annual')

  return (
    <div className="page-content">
      <OpsPageHeading
        eyebrow="INSTRUCTOR FEE"
        title="강사비"
        subtitle="센터 강사비를 연간·지역별로 확인합니다."
        sheetName={tab === 'annual' ? '5.센터_강사비(연간)' : '6.센터_강사비(지역)'}
      />

      <div className="ops-page">
        <OpsTabs
          tabs={[
            { key: 'annual', label: '연간 현황' },
            { key: 'region', label: '지역별 현황' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'annual' ? <FeeAnnualView /> : <FeeRegionView />}
      </div>
    </div>
  )
}

export default InstructorFeePage
