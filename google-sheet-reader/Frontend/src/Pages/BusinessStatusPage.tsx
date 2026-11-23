/**
 * @file BusinessStatusPage.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-18
 * @description
 * GW·DS 교육사업 현황 통합 조회 페이지
 *
 * 주요 기능:
 * - 날짜 범위 조회
 * - 사업별 필터링
 * - 핵심 운영 지표
 * - GW·DS 사업별 교육 건수 비교
 * - 지역별 교육 현황
 * - 수요처 및 학교별 현황
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getEducationByDateRange } from '../Services/EducationService'

import type {
  EducationRecord,
  BusinessType,
  GWEducationRecord,
  DSEducationRecord,
} from '../Types/education'

// =====================================================
// 타입 정의
// =====================================================
type BusinessFilter = 'ALL' | BusinessType

type ApiStatus = 'loading' | 'connected' | 'error'

interface CountItem {
  name: string
  count: number
}

interface BusinessStatus {
  gw: ApiStatus
  ds: ApiStatus
}

// =====================================================
// 공통 함수
// =====================================================

// 날짜를 YYYY-MM-DD 형식으로 변환
function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// 날짜 입력 기본값 생성
function getDefaultDates() {
  const endDate = new Date()
  const startDate = new Date()

  startDate.setDate(startDate.getDate() - 29)

  return {
    startDate: formatIsoDate(startDate),
    endDate: formatIsoDate(endDate),
  }
}

// 문자열 정리
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return ''

  return String(value).trim()
}

// 숫자 변환
function toNumber(value: unknown): number {
  const number = Number(
    String(value ?? '').replace(/,/g, ''),
  )

  return Number.isFinite(number) ? number : 0
}

// 사업 구분 확인
function isDSRecord(
  record: EducationRecord,
): record is DSEducationRecord {
  return '사업구분' in record && record.사업구분 === 'DS'
}

// 상위 N개 항목 집계
function getTopItems(
  items: string[],
  limit = 5,
): CountItem[] {
  const counts = new Map<string, number>()

  items.forEach((item) => {
    const name = normalizeValue(item)

    if (!name) return

    counts.set(name, (counts.get(name) ?? 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

// =====================================================
// 공통 UI 컴포넌트
// =====================================================
interface MetricCardProps {
  title: string
  value: number
  description: string
  tone: string
}

function MetricCard({
  title,
  value,
  description,
  tone,
}: MetricCardProps) {
  return (
    <article className="business-metric-card">
      <span className={`business-metric-indicator ${tone}`} />

      <p>{title}</p>

      <strong>{value.toLocaleString('ko-KR')}</strong>

      <span>{description}</span>
    </article>
  )
}

interface RankingListProps {
  title: string
  description: string
  items: CountItem[]
  unit?: string
}

function RankingList({
  title,
  description,
  items,
  unit = '건',
}: RankingListProps) {
  const maxCount = Math.max(
    ...items.map((item) => item.count),
    1,
  )

  return (
    <article className="business-status-card">
      <div className="business-status-card-heading">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{items.length}개 항목</span>
      </div>

      {items.length === 0 ? (
        <div className="business-empty-state">
          조회된 데이터가 없습니다.
        </div>
      ) : (
        <div className="business-ranking-list">
          {items.map((item, index) => (
            <div className="business-ranking-item" key={item.name}>
              <div className="business-ranking-top">
                <span>
                  <i>{index + 1}</i>
                  {item.name}
                </span>
                <strong>
                  {item.count.toLocaleString('ko-KR')}
                  {unit}
                </strong>
              </div>
              <div className="business-ranking-track">
                <div
                  className="business-ranking-bar"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

// =====================================================
// 메인 컴포넌트
// =====================================================
function BusinessStatusPage() {
  // 조회 기간
  const defaultDates = getDefaultDates()

  const [startDate, setStartDate] = useState(defaultDates.startDate)
  const [endDate, setEndDate] = useState(defaultDates.endDate)

  // 사업 필터
  const [businessFilter, setBusinessFilter] =
    useState<BusinessFilter>('ALL')

  // 원본 데이터
  const [gwData, setGwData] = useState<EducationRecord[]>([])
  const [dsData, setDsData] = useState<EducationRecord[]>([])

  // API 상태
  const [apiStatus, setApiStatus] = useState<BusinessStatus>({
    gw: 'loading',
    ds: 'loading',
  })

  // 로딩 및 오류
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  // ===================================================
  // API 데이터 조회
  // ===================================================
  const loadBusinessData = useCallback(async () => {

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

    setApiStatus({
      gw: 'loading',
      ds: 'loading',
    })

    try {
      const results = await Promise.allSettled([
        getEducationByDateRange({
          businessType: 'GW',
          startDate,
          endDate,
        }),

        getEducationByDateRange({
          businessType: 'DS',
          startDate,
          endDate,
        }),
      ])

      // GW 결과 처리
      if (results[0].status === 'fulfilled') {
        setGwData(results[0].value)

        setApiStatus((prev) => ({
          ...prev,
          gw: 'connected',
        }))
      } else {
        setGwData([])

        setApiStatus((prev) => ({
          ...prev,
          gw: 'error',
        }))
      }

      // DS 결과 처리
      if (results[1].status === 'fulfilled') {
        setDsData(results[1].value)

        setApiStatus((prev) => ({
          ...prev,
          ds: 'connected',
        }))
      } else {
        setDsData([])

        setApiStatus((prev) => ({
          ...prev,
          ds: 'error',
        }))
      }

      // 두 사업 모두 실패한 경우
      if (
        results[0].status === 'rejected' &&
        results[1].status === 'rejected'
      ) {
        setErrorMessage(
          'GW·DS 교육 데이터를 모두 조회하지 못했습니다.',
        )
      } else if (
        results[0].status === 'rejected' ||
        results[1].status === 'rejected'
      ) {
        setErrorMessage(
          '일부 사업의 데이터 조회에 실패했습니다.',
        )
      }

      setLastUpdated(
        new Intl.DateTimeFormat('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '데이터 조회 중 오류가 발생했습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [startDate, endDate])

    // 페이지 최초 진입 시 조회
    useEffect(() => {
    // 20261118 수정: Promise 콜백에서 데이터 조회 실행
    void Promise.resolve().then(() => loadBusinessData())
    }, [loadBusinessData])

  // ===================================================
  // 사업별 필터링
  // ===================================================
  const filteredGwData = useMemo(
    () =>
      businessFilter === 'DS'
        ? []
        : gwData.filter((record) => !isDSRecord(record)),
    [gwData, businessFilter],
  )

  const filteredDsData = useMemo(
    () =>
      businessFilter === 'GW'
        ? []
        : dsData.filter(isDSRecord),
    [dsData, businessFilter],
  )

  const totalCount = filteredGwData.length + filteredDsData.length

  // ===================================================
  // 지역 / 권역 집계
  // ===================================================
  const regionItems = useMemo(() => {
    const gwRegions = filteredGwData.map((record) =>
      normalizeValue((record as GWEducationRecord).지역)
        ? `GW · ${normalizeValue((record as GWEducationRecord).지역)}`
        : '',
    )

    const dsRegions = filteredDsData.map((record) =>
      normalizeValue((record as DSEducationRecord).권역)
        ? `DS · ${normalizeValue((record as DSEducationRecord).권역)}`
        : '',
    )

    return getTopItems([...gwRegions, ...dsRegions], 10)
  }, [filteredGwData, filteredDsData])

    // 전체 운영 지역 수 계산
    const regionCount = new Set([
    ...filteredGwData.map((record) => {
        const region = normalizeValue(
        (record as GWEducationRecord).지역,
        )

        return region ? `GW · ${region}` : ''
    }),

    ...filteredDsData.map((record) => {
        const region = normalizeValue(
        (record as DSEducationRecord).권역,
        )

        return region ? `DS · ${region}` : ''
    }),
    ].filter(Boolean)).size

  // ===================================================
  // 수요처 / 학교 집계
  // ===================================================
  const destinationItems = useMemo(() => {
    const gwDestinations = filteredGwData.map((record) => {
      const name = normalizeValue(
        (record as GWEducationRecord)['내용(수요처명)'],
      )

      return name ? `GW · ${name}` : ''
    })

    const dsDestinations = filteredDsData.map((record) => {
      const name = normalizeValue(
        (record as DSEducationRecord).학교명,
      )

      return name ? `DS · ${name}` : ''
    })

    return getTopItems(
      [...gwDestinations, ...dsDestinations],
      10,
    )
  }, [filteredGwData, filteredDsData])


  // ===================================================
  // 학생 수 집계
  // ===================================================
  const totalStudents = useMemo(
    () =>
      filteredDsData.reduce(
        (sum, record) =>
          sum + toNumber((record as DSEducationRecord).학생수),
        0,
      ),
    [filteredDsData],
  )

  // ===================================================
  // 화면 렌더링
  // ===================================================
  const gwCount = filteredGwData.length
  const dsCount = filteredDsData.length

  const comparisonMax = Math.max(gwCount, dsCount, 1)

  const gwPercentage = (gwCount / comparisonMax) * 100
  const dsPercentage = (dsCount / comparisonMax) * 100

  const isConnected =
    apiStatus.gw === 'connected' &&
    apiStatus.ds === 'connected'

  const hasPartialConnection =
    apiStatus.gw === 'connected' ||
    apiStatus.ds === 'connected'

  return (
    <div className="page-content business-status-page">
      {/* 페이지 제목 */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">BUSINESS OVERVIEW</p>
          <h1>사업 현황</h1>
          <p className="page-subtitle">
            GW·DS 교육사업의 실적과 운영 현황을 통합 조회합니다.
          </p>
        </div>

        <button
          type="button"
          className="refresh-button business-refresh-button"
          onClick={() => void loadBusinessData()}
          disabled={isLoading}
        >
          {isLoading ? '조회 중...' : '데이터 새로고침'}
        </button>
      </section>

      {/* 조회 조건 */}
      <section className="business-filter-panel">
        <div className="business-filter-heading">
          <strong>조회 조건</strong>
          <span>조회 기준을 선택해 주세요.</span>
        </div>

        <div className="business-filter-controls">
          <label>
            <span>시작일</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
            />
          </label>
          <label>
            <span>종료일</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
            />
          </label>
          <label>
            <span>사업 구분</span>
            <select
              value={businessFilter}
              onChange={(event) =>
                setBusinessFilter(
                  event.target.value as BusinessFilter,
                )
              }
            >
              <option value="ALL">전체 사업</option>
              <option value="GW">GW · 강원SW미래채움</option>
              <option value="DS">DS · 디지털새싹</option>
            </select>
          </label>
          <button
            type="button"
            className="business-search-button"
            onClick={() => void loadBusinessData()}
            disabled={isLoading}
          >
            조회하기
          </button>
        </div>
      </section>

      {/* 데이터 상태 */}
      <div className="business-data-status">
        <span className="business-data-status-dot" />

        {isLoading
          ? '교육 데이터를 조회하고 있습니다.'
          : isConnected
            ? 'GW·DS 데이터 연결 완료'
            : hasPartialConnection
              ? '일부 사업 데이터 연결 완료'
              : '데이터 연결을 확인해 주세요.'}

        {lastUpdated && (
          <span>마지막 조회 {lastUpdated}</span>
        )}
      </div>

      {errorMessage && (
        <div className="business-error-message">
          {errorMessage}
        </div>
      )}

      {/* 핵심 지표 */}
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>핵심 지표</h2>
            <p>선택한 기간과 사업을 기준으로 집계한 결과입니다.</p>
          </div>
        </div>
        <div className="business-metric-grid">
          <MetricCard
            title="전체 교육 건수"
            value={totalCount}
            description="GW + DS 교육 데이터"
            tone="business-tone-blue"
          />
          <MetricCard
            title="운영 지역 수"
            value={regionCount}
            description="GW 지역 + DS 권역"
            tone="business-tone-amber"
          />
          <MetricCard
            title="GW 교육 건수"
            value={gwCount}
            description="강원SW미래채움"
            tone="business-tone-violet"
          />
          <MetricCard
            title="DS 교육 건수"
            value={dsCount}
            description="디지털새싹"
            tone="business-tone-green"
          />
        </div>
      </section>

      {/* 사업별 비교 */}
      <section className="section-block">
        <div className="section-heading">
          <div>
            <h2>사업별 운영 현황</h2>
            <p>사업별 교육 데이터 건수를 비교합니다.</p>
          </div>
        </div>
        <article className="business-status-card comparison-card">
          <div className="comparison-summary">
            <div>
              <span className="comparison-dot comparison-dot-gw" />
              <strong>GW · 강원SW미래채움</strong>
              <b>{gwCount.toLocaleString()}건</b>
            </div>
            <div>
              <span className="comparison-dot comparison-dot-ds" />
              <strong>DS · 디지털새싹</strong>
              <b>{dsCount.toLocaleString()}건</b>
            </div>
          </div>
          <div className="comparison-bar-group">
            <div className="comparison-bar-row">
              <span>GW</span>
              <div className="comparison-track">
                <div
                  className="comparison-bar comparison-bar-gw"
                  style={{ width: `${gwPercentage}%` }}
                />
              </div>
              <strong>{gwCount.toLocaleString()}</strong>
            </div>
            <div className="comparison-bar-row">
              <span>DS</span>
              <div className="comparison-track">
                <div
                  className="comparison-bar comparison-bar-ds"
                  style={{ width: `${dsPercentage}%` }}
                />
              </div>
              <strong>{dsCount.toLocaleString()}</strong>
            </div>
          </div>

          {businessFilter !== 'GW' && (
            <div className="comparison-student-summary">
              DS 등록 학생 수 합계
              <strong>{totalStudents.toLocaleString()}명</strong>
            </div>
          )}

        </article>
      </section>

      {/* 지역별 / 수요처별 */}
      <section className="business-status-grid section-block">
        <RankingList
          title="지역별 운영 현황"
          description="GW 지역 및 DS 권역별 교육 건수"
          items={regionItems}
        />
        <RankingList
          title="수요처 및 학교 현황"
          description="수요처 및 학교별 교육 건수"
          items={destinationItems}
        />
      </section>

      {/* 하단 안내 */}
      <footer className="page-footer">
        <span>GOOGLE SHEET READER</span>
        <span>Business Status Management</span>
      </footer>
    </div>
  )
}

export default BusinessStatusPage
