
/**
 * @file EducationDataPage.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-18
 * @description
 * GW·DS 교육 데이터 조회 화면
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getEducationByDateRange } from '../Services/EducationService'
import type {
  BusinessType,
  EducationRecord,
  EducationValue,
} from '../Types/education'

type EducationDataPageProps = {
  initialBusiness: BusinessType | null
  onBack: () => void
}

type BusinessFilter = 'ALL' | BusinessType

type TableColumn = {
  key: string
  label: string
}

const PAGE_SIZE = 20

const GW_COLUMNS: TableColumn[] = [
  { key: '근무날짜', label: '근무 날짜' },
  { key: '지역', label: '지역' },
  { key: '강사이름', label: '강사 이름' },
  { key: '내용(수요처명)', label: '수요처명' },
  { key: '반명', label: '반명' },
  { key: '근무시간', label: '근무시간' },
  { key: '근무유형', label: '근무유형' },
]

const DS_COLUMNS: TableColumn[] = [
  { key: '근무날짜', label: '수업 날짜' },
  { key: '학교명', label: '학교명' },
  { key: '과정명', label: '과정명' },
  { key: '학생수', label: '학생 수' },
  { key: '담당교사명', label: '담당교사' },
  { key: '주강사명', label: '주강사' },
  { key: '보조강사명', label: '보조강사' },
  { key: '시간', label: '수업 시간' },
]

function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getInitialStartDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 29)

  return formatIsoDate(date)
}

function getValue(
  record: EducationRecord,
  key: string,
): EducationValue | undefined {
  return (record as Record<string, EducationValue | undefined>)[key]
}

function displayValue(value: EducationValue | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  return String(value)
}

function EducationDataPage({
  initialBusiness,
  onBack,
}: EducationDataPageProps) {
  // 20261118 추가: 사업 및 조회 조건
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>(
    initialBusiness ?? 'ALL',
  )

  const [startDate, setStartDate] = useState(getInitialStartDate)
  const [endDate, setEndDate] = useState(formatIsoDate(new Date()))

  // 20261118 추가: 조회 데이터 및 상태
  const [educationData, setEducationData] = useState<EducationRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [searched, setSearched] = useState(false)

  // 20261118 추가: 페이지네이션
  const [currentPage, setCurrentPage] = useState(1)

  // 20261118 추가: 교육 데이터 조회
  const loadEducationData = useCallback(async () => {
    if (!startDate || !endDate) {
      setErrorMessage('조회 시작일과 종료일을 입력해 주세요.')
      return
    }

    if (startDate > endDate) {
      setErrorMessage('시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setSearched(true)
    setCurrentPage(1)

    const businessTypes: BusinessType[] =
      businessFilter === 'ALL'
        ? ['GW', 'DS']
        : [businessFilter]

    try {
      const results = await Promise.all(
        businessTypes.map((businessType) =>
          getEducationByDateRange({
            businessType,
            startDate,
            endDate,
          }),
        ),
      )

      const combinedData = results.flat()

      // 20261118 추가: 근무 날짜 내림차순 정렬
      combinedData.sort((a, b) =>
        b.근무날짜.localeCompare(a.근무날짜),
      )

      setEducationData(combinedData)
    } catch (error) {
      setEducationData([])

      setErrorMessage(
        error instanceof Error
          ? error.message
          : '교육 데이터 조회에 실패했습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [businessFilter, startDate, endDate])

  // 20261118 추가: 화면 진입 시 최초 조회
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadEducationData()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadEducationData])

  // 20261118 추가: 사업별 테이블 컬럼
  const columns = useMemo(() => {
    if (businessFilter === 'GW') return GW_COLUMNS
    if (businessFilter === 'DS') return DS_COLUMNS

    return [
      { key: '근무날짜', label: '교육 날짜' },
      { key: '사업구분', label: '사업' },
      { key: '지역', label: '지역' },
      { key: '학교명', label: '학교명' },
      { key: '강사이름', label: '강사 이름' },
      { key: '주강사명', label: '주강사' },
      { key: '내용(수요처명)', label: '수요처명' },
      { key: '과정명', label: '과정명' },
    ]
  }, [businessFilter])

  // 20261118 추가: 페이지별 데이터 계산
  const totalPages = Math.max(
    1,
    Math.ceil(educationData.length / PAGE_SIZE),
  )

  const paginatedData = educationData.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  // 20261118 추가: 사업별 건수
  const gwCount = educationData.filter(
    (record) => !('사업구분' in record) || record.사업구분 !== 'DS',
  ).length

  const dsCount = educationData.filter(
    (record) => '사업구분' in record && record.사업구분 === 'DS',
  ).length

  const pageTitle =
    businessFilter === 'GW'
      ? 'GW 교육 데이터'
      : businessFilter === 'DS'
        ? 'DS 교육 데이터'
        : '교육 데이터 조회'

  return (
    <div className="page-content education-data-page">
      {/* 20261118 추가: 페이지 제목 */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">EDUCATION DATA</p>
          <h1>{pageTitle}</h1>
          <p className="page-subtitle">
            교육사업 운영 데이터를 기간별로 조회하고 확인할 수 있습니다.
          </p>
        </div>

        <button
          className="refresh-button"
          type="button"
          onClick={onBack}
        >
          대시보드로 돌아가기
        </button>
      </section>

      {/* 20261118 추가: 검색 조건 */}
      <section className="surface-card education-filter-card">
        <div className="education-filter-heading">
          <div>
            <h2>조회 조건</h2>
            <p>사업과 교육 기간을 선택해 주세요.</p>
          </div>
        </div>

        <div className="education-filter-controls">
          <label>
            <span>사업 구분</span>
            <select
              value={businessFilter}
              onChange={(event) => {
                setBusinessFilter(event.target.value as BusinessFilter)
              }}
            >
              <option value="ALL">전체 사업</option>
              <option value="GW">GW · 강원SW미래채움</option>
              <option value="DS">DS · 디지털새싹</option>
            </select>
          </label>

          <label>
            <span>시작일</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label>
            <span>종료일</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="education-search-button"
            onClick={() => void loadEducationData()}
            disabled={isLoading}
          >
            {isLoading ? '조회 중...' : '데이터 조회'}
          </button>
        </div>
      </section>

      {/* 20261118 추가: 조회 결과 요약 */}
      <section className="education-result-summary">
        <div>
          <span>조회 결과</span>
          <strong>
            {isLoading ? '조회 중...' : `${educationData.length.toLocaleString()}건`}
          </strong>
        </div>

        {businessFilter === 'ALL' && (
          <>
            <div>
              <span>GW</span>
              <strong>{gwCount.toLocaleString()}건</strong>
            </div>

            <div>
              <span>DS</span>
              <strong>{dsCount.toLocaleString()}건</strong>
            </div>
          </>
        )}

        <span className="education-result-period">
          {startDate} ~ {endDate}
        </span>
      </section>

      {/* 20261118 추가: 데이터 테이블 */}
      <section className="surface-card education-table-card">
        <div className="education-table-heading">
          <div>
            <h2>교육 데이터 목록</h2>
            <p>
              {isLoading
                ? '데이터를 불러오고 있습니다.'
                : `총 ${educationData.length.toLocaleString()}건의 조회 결과`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="education-table-message">
            교육 데이터를 조회하고 있습니다.
          </div>
        ) : errorMessage ? (
          <div className="education-table-message education-table-error">
            {errorMessage}
          </div>
        ) : educationData.length === 0 ? (
          <div className="education-table-message">
            {searched
              ? '조회 조건에 해당하는 교육 데이터가 없습니다.'
              : '조회 조건을 선택해 주세요.'}
          </div>
        ) : (
          <>
            <div className="education-table-scroll">
              <table className="education-table">
                <thead>
                  <tr>
                    <th>번호</th>
                    {columns.map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {paginatedData.map((record, index) => {
                    const isDs =
                      '사업구분' in record && record.사업구분 === 'DS'

                    return (
                      <tr key={`${record.근무날짜}-${index}`}>
                        <td>
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </td>

                        {columns.map((column) => {
                          const value =
                            column.key === '사업구분'
                              ? isDs ? 'DS' : 'GW'
                              : getValue(record, column.key)

                          return (
                            <td key={column.key}>
                              {column.key === '사업구분' ? (
                                <span
                                  className={`education-business-badge ${isDs ? 'badge-ds' : 'badge-gw'}`}
                                >
                                  {displayValue(value)}
                                </span>
                              ) : (
                                displayValue(value)
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 20261118 추가: 페이지 이동 */}
            <div className="education-pagination">
              <span>
                {currentPage} / {totalPages} 페이지
              </span>

              <div>
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                >
                  이전
                </button>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default EducationDataPage
