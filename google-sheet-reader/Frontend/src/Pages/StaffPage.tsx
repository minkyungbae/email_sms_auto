/**
 * @file StaffPage.tsx
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 운영 인력 화면 (시트: 1.운영인력정보_ROW)
 * - 지역 / 담당 역할 / 강사 구분 / 소속기관 필터, 검색
 * - 주민번호는 표시하지 않음, 계좌번호는 끝 4자리만 표시 (Apps Script·서버에서 처리)
 *
 * 20261126 수정: 강사 구분 컬럼 배지 강조 삭제 (일반 텍스트)
 * 20261126 추가: 지역 컬럼·필터 (시트 B열 "지역" 추가 반영)
 * 20261126 수정: 표를 줄이고 행을 누르면 상세 보기
 * - 표: No. / 지역 / 성명 / 소속기관 / 담당 역할 / 연락처
 * - 오른쪽 상세 패널: 기본 정보(소속·직책·강사 구분·연락처·이메일) / 계좌 정보(은행·예금주·계좌번호)
 * - 중복 의심 행은 빨간 배경 유지, 상세 패널에 중복 안내
 */

import { useMemo, useState } from 'react'

import {
  OperationPage,
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
  isChecked,
  matchesKeyword,
  toNumber,
  uniqueValues,
} from '../Utils/operationFormat'

// 시트의 "담당 역할 구분" 체크박스 컬럼
const ROLE_HEADERS = ['학교담당자', '주강사', '보조강사1', '보조강사2', '코디네이터', '기술지원']

const EMPTY_FILTERS = {
  region: '',
  role: '',
  instructorType: '',
  organization: '',
  keyword: '',
}

const getRoles = (row: SheetRecord) => ROLE_HEADERS.filter((role) => isChecked(row[role]))
const isDuplicate = (row: SheetRecord) => (toNumber(row['성명+연락처 중복 확인']) ?? 0) > 1

const COLUMNS: OpsColumn<SheetRecord>[] = [
  { key: 'No.', label: 'No.', align: 'right' },
  { key: '지역', label: '지역' },
  { key: '성명', label: '성명', render: (row) => <strong className="ops-cell-title">{row['성명']}</strong> },
  { key: '소속기관명', label: '소속기관' },
  { key: '담당 역할', label: '담당 역할', value: (row) => getRoles(row).join(', ') },
  { key: '연락처', label: '연락처', render: (row) => <span className="ops-cell-mono">{row['연락처']}</span> },
]


// =======================================
// 상세 패널
// =======================================
function StaffDetail({ person, onClose }: { person: SheetRecord | null; onClose: () => void }) {
  if (!person) {
    return (
      <aside className="surface-card staff-detail staff-detail-empty">
        표에서 인력을 선택하면 상세 정보가 여기에 표시됩니다.
      </aside>
    )
  }

  const roles = getRoles(person)
  const field = (label: string, value: string | undefined) => (
    <div className="staff-detail-row">
      <dt>{label}</dt>
      <dd>{value?.trim() || '-'}</dd>
    </div>
  )

  return (
    <aside className="surface-card staff-detail" aria-label={`${person['성명']} 상세 정보`}>
      <header className="staff-detail-header">
        <div>
          <h2>{person['성명'] || '-'}</h2>
          <p>{[person['지역'], roles.join(', ')].filter(Boolean).join(' · ') || '역할 미지정'}</p>
        </div>
        <button type="button" className="calendar-modal-close" onClick={onClose} aria-label="상세 닫기">
          ×
        </button>
      </header>

      {isDuplicate(person) && (
        <div className="perf-message perf-message-error staff-detail-alert" role="note">
          성명+연락처가 같은 인력이 {person['성명+연락처 중복 확인']}건 있습니다.
        </div>
      )}

      <dl className="staff-detail-section">
        {field('No.', person['No.'])}
        {field('소속기관', person['소속기관명'])}
        {field('직급/직책', person['직급 및 직책'])}
        {field('강사 구분', person['강사 구분'])}
        {field('연락처', person['연락처'])}
        {field('이메일', person['이메일'])}
      </dl>

      <dl className="staff-detail-section">
        {field('은행', person['은행명'])}
        {field('예금주', person['예금주명'])}
        {field('계좌번호', person['계좌번호'])}
      </dl>

      <p className="staff-detail-note">계좌번호는 끝 4자리만 표시합니다. 시트 {person['행']}행</p>
    </aside>
  )
}


// =======================================
// 화면
// =======================================
function StaffPage() {
  const { result, data, error, isLoading, reload } = useOperationData('staff')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selectedRow, setSelectedRow] = useState('')

  const records = useMemo(() => data?.records ?? [], [data])
  const roleHeaders = useMemo(() => ROLE_HEADERS.filter((role) => data?.headers.includes(role)), [data])

  const options = useMemo(() => ({
    region: uniqueValues(records, (row) => row['지역']),
    instructorType: uniqueValues(records, (row) => row['강사 구분']),
    organization: uniqueValues(records, (row) => row['소속기관명']),
  }), [records])

  const rows = useMemo(() => records.filter((row) =>
    (!filters.region || row['지역'] === filters.region) &&
    (!filters.role || isChecked(row[filters.role])) &&
    (!filters.instructorType || row['강사 구분'] === filters.instructorType) &&
    (!filters.organization || row['소속기관명'] === filters.organization) &&
    matchesKeyword([row['성명'], row['연락처'], row['이메일'], row['소속기관명']], filters.keyword),
  ), [records, filters])

  // 필터로 목록에서 빠지면 상세도 닫힘
  const selectedPerson = rows.find((row) => row['행'] === selectedRow) ?? null

  const setFilter = (name: keyof typeof EMPTY_FILTERS) => (value: string) =>
    setFilters((current) => ({ ...current, [name]: value }))

  const countRole = (role: string) => rows.filter((row) => isChecked(row[role])).length
  const duplicateCount = rows.filter(isDuplicate).length

  return (
    <OperationPage
      eyebrow="STAFF"
      title="운영 인력"
      subtitle="학교 담당자·강사·코디네이터 등 운영 인력을 확인하고, 행을 눌러 상세 정보를 봅니다."
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
        <OpsSelect label="지역" value={filters.region} options={options.region} onChange={setFilter('region')} />
        <OpsSelect label="담당 역할" value={filters.role} options={roleHeaders} onChange={setFilter('role')} />
        <OpsSelect label="강사 구분" value={filters.instructorType} options={options.instructorType} onChange={setFilter('instructorType')} />
        <OpsSelect label="소속기관" value={filters.organization} options={options.organization} onChange={setFilter('organization')} />
        <OpsSearch value={filters.keyword} placeholder="성명, 소속, 연락처, 이메일" onChange={setFilter('keyword')} />
      </OpsToolbar>

      <OpsStatGrid>
        <OpsStat label="전체 인원" value={`${formatNumber(rows.length)}명`} />
        <OpsStat label="학교담당자" value={`${formatNumber(countRole('학교담당자'))}명`} />
        <OpsStat
          label="강사"
          value={`${formatNumber(rows.filter((row) => ['주강사', '보조강사1', '보조강사2'].some((role) => isChecked(row[role]))).length)}명`}
          detail={`주강사 ${countRole('주강사')} · 보조 ${countRole('보조강사1') + countRole('보조강사2')}`}
        />
        <OpsStat
          label="코디네이터 · 기술지원"
          value={`${formatNumber(countRole('코디네이터') + countRole('기술지원'))}명`}
          detail={`코디 ${countRole('코디네이터')} · 기술 ${countRole('기술지원')}`}
        />
        <OpsStat
          label="중복 의심"
          value={`${formatNumber(duplicateCount)}건`}
          detail="성명+연락처 기준"
          tone={duplicateCount > 0 ? 'danger' : 'default'}
        />
      </OpsStatGrid>

      <div className="staff-layout">
        <OpsTable
          title="운영 인력 목록"
          caption={`${formatNumber(rows.length)}명 / 전체 ${formatNumber(records.length)}명`}
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row['행']}
          rowClassName={(row) => isDuplicate(row) ? 'is-danger' : undefined}
          onRowClick={(row) => setSelectedRow((current) => current === row['행'] ? '' : row['행'])}
          isRowSelected={(row) => row['행'] === selectedPerson?.['행']}
          emptyText="조건에 맞는 인력이 없습니다."
        />

        <StaffDetail person={selectedPerson} onClose={() => setSelectedRow('')} />
      </div>
    </OperationPage>
  )
}

export default StaffPage
