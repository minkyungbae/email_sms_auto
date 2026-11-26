/**
 * @file DemandPage.tsx
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 수요처 정보 화면 (시트: 1.수요처정보_ROW)
 * - 권역 / 수요처 유형 / 학교구분 / 신규·기존 필터, 검색
 * - 수요처·반 수, 교육신청인원, 전체교육차시 요약
 * - "중복 확인" 이 2 이상인 행 강조
 *
 * 20261126 삭제: 진행여부 관련 항목 (표의 진행 컬럼, 진행여부 필터)
 */

import { useMemo, useState } from 'react'

import {
  OperationPage,
  OpsBadge,
  OpsSearch,
  OpsSelect,
  OpsStat,
  OpsStatGrid,
  OpsTable,
  OpsToolbar,
} from '../Components/OperationUI'
import type { OpsColumn } from '../Components/OperationUI'
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

const EMPTY_FILTERS = {
  region: '',
  type: '',
  school: '',
  newOrOld: '',
  keyword: '',
}

const isDuplicate = (row: SheetRecord) => (toNumber(row['중복 확인']) ?? 0) > 1

const COLUMNS: OpsColumn<SheetRecord>[] = [
  { key: 'No.', label: 'No.', align: 'right' },
  { key: '권역', label: '권역' },
  { key: '수요처 유형', label: '수요처 유형' },
  { key: '학교구분', label: '학교구분' },
  {
    key: '수요처명',
    label: '수요처 / 반',
    render: (row) => (
      <>
        <strong className="ops-cell-title">{row['수요처명']}</strong>
        <span className="ops-cell-sub">{row['반명']}</span>
      </>
    ),
  },
  { key: '학년', label: '학년' },
  { key: '교육과정명', label: '교육과정' },
  {
    key: '교육기간',
    label: '교육 기간',
    value: (row) => [row['교육 시작일'], row['교육 종료일']].filter(Boolean).map(formatSheetDate).join(' ~ '),
  },
  { key: '교육신청인원', label: '신청인원', align: 'right' },
  { key: '전체교육차시', label: '차시', align: 'right' },
  { key: '왕복 거리(km)', label: '왕복(km)', align: 'right' },
  { key: '신규/기존', label: '신규/기존', align: 'center' },
  { key: '주소', label: '주소', render: (row) => <span className="ops-cell-wrap">{row['주소']}</span> },
  { key: '메모', label: '메모', render: (row) => <span className="ops-cell-wrap">{row['메모']}</span> },
  {
    key: '중복 확인',
    label: '중복',
    align: 'center',
    render: (row) => isDuplicate(row) ? <OpsBadge tone="danger">중복 {row['중복 확인']}</OpsBadge> : '',
  },
]

function DemandPage() {
  const { result, data, error, isLoading, reload } = useOperationData('demand')
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  const records = useMemo(() => data?.records ?? [], [data])

  const options = useMemo(() => ({
    region: uniqueValues(records, (row) => row['권역']),
    type: uniqueValues(records, (row) => row['수요처 유형']),
    school: uniqueValues(records, (row) => row['학교구분']),
    newOrOld: uniqueValues(records, (row) => row['신규/기존']),
  }), [records])

  const rows = useMemo(() => records.filter((row) =>
    (!filters.region || row['권역'] === filters.region) &&
    (!filters.type || row['수요처 유형'] === filters.type) &&
    (!filters.school || row['학교구분'] === filters.school) &&
    (!filters.newOrOld || row['신규/기존'] === filters.newOrOld) &&
    matchesKeyword([row['수요처명'], row['반명'], row['주소'], row['교육과정명'], row['메모']], filters.keyword),
  ), [records, filters])

  const setFilter = (name: keyof typeof EMPTY_FILTERS) => (value: string) =>
    setFilters((current) => ({ ...current, [name]: value }))

  const demandCount = uniqueValues(rows, (row) => row['수요처명']).length
  const duplicateCount = rows.filter(isDuplicate).length

  return (
    <OperationPage
      eyebrow="DEMAND"
      title="수요처 정보"
      subtitle="수요처별 반·교육과정·일정을 확인합니다."
      sheetName={result?.sheetName}
      isLoading={isLoading}
      error={error}
      hasData={Boolean(data)}
    >
      <OpsToolbar
        fetchedAt={result?.fetchedAt}
        isLoading={isLoading}
        onRefresh={reload}
        onReset={() => setFilters(EMPTY_FILTERS)}
      >
        <OpsSelect label="권역" value={filters.region} options={options.region} onChange={setFilter('region')} />
        <OpsSelect label="수요처 유형" value={filters.type} options={options.type} onChange={setFilter('type')} />
        <OpsSelect label="학교구분" value={filters.school} options={options.school} onChange={setFilter('school')} />
        <OpsSelect label="신규/기존" value={filters.newOrOld} options={options.newOrOld} onChange={setFilter('newOrOld')} />
        <OpsSearch value={filters.keyword} placeholder="수요처명, 반명, 주소, 교육과정" onChange={setFilter('keyword')} />
      </OpsToolbar>

      <OpsStatGrid>
        <OpsStat label="수요처" value={`${formatNumber(demandCount)}곳`} detail={`반 ${formatNumber(rows.length)}개`} />
        <OpsStat label="교육신청인원" value={`${formatNumber(sumBy(rows, (row) => row['교육신청인원']))}명`} />
        <OpsStat label="전체 교육차시" value={`${formatNumber(sumBy(rows, (row) => row['전체교육차시']))}차시`} />
        <OpsStat
          label="중복 의심"
          value={`${formatNumber(duplicateCount)}건`}
          detail="수요처명+반명+교육과정명 기준"
          tone={duplicateCount > 0 ? 'danger' : 'default'}
        />
      </OpsStatGrid>

      <OpsTable
        title="수요처 목록"
        caption={`${formatNumber(rows.length)}건 / 전체 ${formatNumber(records.length)}건`}
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row['행']}
        rowClassName={(row) => isDuplicate(row) ? 'is-danger' : undefined}
        emptyText="조건에 맞는 수요처가 없습니다."
      />
    </OperationPage>
  )
}

export default DemandPage
