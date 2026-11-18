/**
 * @file Dashboard.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-18
 * @description
 * 메인 화면 구성.
 * 
 * 주요 기능:
 * - 좌측 사이드바 및 메뉴
 * - 상단 날짜 및 관리자 영역
 * - GW·DS 사업 정보
 * - 전체 교육 건수 등 핵심 지표
 * - 교육 운영 추이 영역
 * - 데이터 연결 상태
 * - 반응형 레이아웃
 */


import { useCallback, useEffect, useState } from 'react'

import { getEducationByDateRange } from '../Services/EducationService' 
import EducationTrendChart from '../Components/EducationTrendChart' // 20261118 추가: 교육 운영 추이 차트

import EducationDataPage from './EducationDataPage' // 20261118 추가: 교육 데이터 조회 화면
import type { BusinessType } from '../Types/education' // 20261118 추가: 사업 구분 타입

import type {
  EducationRecord,
} from '../Types/education'


type IconName =
  | 'dashboard'
  | 'book'
  | 'chart'
  | 'database'
  | 'calendar'
  | 'refresh'
  | 'chevron'
  | 'layers'
  | 'info'
  | 'file'
  | 'grid'
  | 'bell'

type IconProps = {
  name: IconName
  size?: number
  strokeWidth?: number
}

function Icon({ name, size = 18, strokeWidth = 1.8 }: IconProps) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'dashboard':
      return (
        <svg {...shared}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      )
    case 'book':
      return (
        <svg {...shared}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
          <path d="M4 5.5v16M8 7h8M8 11h7" />
        </svg>
      )
    case 'chart':
      return (
        <svg {...shared}>
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 3 3 6-7" />
          <path d="M16 6h4v4" />
        </svg>
      )
    case 'database':
      return (
        <svg {...shared}>
          <ellipse cx="12" cy="5" rx="8" ry="3" />
          <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
          <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...shared}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...shared}>
          <path d="M20 7v5h-5M4 17v-5h5" />
          <path d="M5.6 9A7 7 0 0 1 17.3 6L20 12M4 12l2.7 6A7 7 0 0 0 18.4 15" />
        </svg>
      )
    case 'chevron':
      return (
        <svg {...shared}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      )
    case 'layers':
      return (
        <svg {...shared}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
        </svg>
      )
    case 'info':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      )
    case 'file':
      return (
        <svg {...shared}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h8" />
        </svg>
      )
    case 'grid':
      return (
        <svg {...shared}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...shared}>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
      )
  }
}

type MetricCardProps = {
  label: string
  value: string
  detail: string
  icon: IconName
  tone: 'blue' | 'violet' | 'mint' | 'amber'
}

function MetricCard({ label, value, detail, icon, tone }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-icon metric-icon-${tone}`}>
        <Icon name={icon} size={19} />
      </div>
      <p className="metric-label">{label}</p>
      <p className={`metric-value ${value === '연동 대기' ? 'metric-value-text' : ''}`}>
        {value}
      </p>
      <p className="metric-detail">{detail}</p>
    </article>
  )
}

type ConnectionRowProps = {
  name: string
  description: string
  status: string
  statusType: 'ready' | 'waiting'
  icon: IconName
}

function ConnectionRow({
  name,
  description,
  status,
  statusType,
  icon,
}: ConnectionRowProps) {
  return (
    <div className="connection-row">
      <div className="connection-icon">
        <Icon name={icon} size={17} />
      </div>
      <div className="connection-copy">
        <strong>{name}</strong>
        <span>{description}</span>
      </div>
      <span className={`status-pill status-${statusType}`}>
        <span className="status-dot" />
        {status}
      </span>
    </div>
  )
}

// 20261118 추가: API 조회 상태
type ApiStatus = 'loading' | 'connected' | 'error'

// 20261118 추가: 날짜를 YYYY-MM-DD 형식으로 변환
function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}


// 대시보드 메인 컴포넌트
function Dashboard() {
  // 20261118 추가: 교육 데이터 상태
  const [gwData, setGwData] = useState<EducationRecord[]>([])
  const [dsData, setDsData] = useState<EducationRecord[]>([])

  // 20261118 추가: API 연결 상태
  const [gwStatus, setGwStatus] = useState<ApiStatus>('loading')
  const [dsStatus, setDsStatus] = useState<ApiStatus>('loading')

  // 20261118 추가: 로딩 및 오류 상태
  const [isLoading, setIsLoading] = useState(false)
  const [gwError, setGwError] = useState('')
  const [dsError, setDsError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  // 20261118 추가: 현재 화면 상태
  const [currentView, setCurrentView] = useState<'dashboard' | 'education'>('dashboard')

  // 20261118 추가: 선택한 사업 구분
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessType | null>(null)

  // 20261118 추가: 교육 데이터 화면 열기
  const openEducationPage = (business: BusinessType | null = null) => {
    setSelectedBusiness(business)
    setCurrentView('education')
  }

  // 20261118 추가: GW·DS 교육 데이터 조회
  const loadEducationData = useCallback(async () => {
    setIsLoading(true)

    setGwStatus('loading')
    setDsStatus('loading')

    setGwError('')
    setDsError('')

    const endDate = new Date()
    const startDate = new Date(endDate)

    // 오늘 포함 최근 30일
    startDate.setDate(startDate.getDate() - 29)

    const params = {
      startDate: formatIsoDate(startDate),
      endDate: formatIsoDate(endDate),
    }

    try {
      const results = await Promise.allSettled([
        getEducationByDateRange({
          businessType: 'GW',
          ...params,
        }),
        getEducationByDateRange({
          businessType: 'DS',
          ...params,
        }),
      ])

      // GW 조회 결과
      if (results[0].status === 'fulfilled') {
        setGwData(results[0].value)
        setGwStatus('connected')
      } else {
        setGwData([])
        setGwStatus('error')
        setGwError(
          results[0].reason instanceof Error
            ? results[0].reason.message
            : 'GW 데이터 조회 실패',
        )
      }

      // DS 조회 결과
      if (results[1].status === 'fulfilled') {
        setDsData(results[1].value)
        setDsStatus('connected')
      } else {
        setDsData([])
        setDsStatus('error')
        setDsError(
          results[1].reason instanceof Error
            ? results[1].reason.message
            : 'DS 데이터 조회 실패',
        )
      }

      setLastUpdated(
        new Intl.DateTimeFormat('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 20261118 추가: 대시보드 최초 진입 시 조회
  useEffect(() => {
  const timerId = window.setTimeout(() => {
    void loadEducationData()
  }, 0)

  return () => {
    window.clearTimeout(timerId)
  }
}, [loadEducationData])

  // 20261118 추가: 전체 데이터 건수
  const totalCount = gwData.length + dsData.length

  // 20261118 추가: 통합 API 연결 상태
  const isConnected =
    gwStatus === 'connected' && dsStatus === 'connected'

  const hasPartialConnection =
    gwStatus === 'connected' || dsStatus === 'connected'

  const today = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())

  return (
    <div className="app-shell">
      {/* 사이드바 */}
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="brand-name">
            <span>GOOGLE SHEET</span>
            <strong>READER</strong>
          </div>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">GS</div>
          <div className="workspace-copy">
            <span>WORKSPACE</span>
            <strong>교육사업 운영</strong>
          </div>
          <span className="workspace-chevron">
            <Icon name="chevron" size={15} />
          </span>
        </div>

        <nav className="side-navigation" aria-label="주 메뉴">
          <p className="nav-caption">MENU</p>

          {/* 20261118 수정: 대시보드 화면 전환 연결 */}
          <button
            type="button"
            className={`nav-item ${currentView === 'dashboard' ? 'nav-item-active' : ''}`}
            onClick={() => setCurrentView('dashboard')}
          >
            <Icon name="dashboard" size={18} />
            <span>대시보드</span>
          </button>

          {/* 20261118 수정: 교육 데이터 메뉴 연결 */}
          <button
            type="button"
            className={`nav-item ${currentView === 'education' ? 'nav-item-active' : ''}`}
            onClick={() => openEducationPage()}
          >
            <Icon name="book" size={18} />
            <span>교육 데이터</span>
          </button>

          <div className="nav-item nav-item-disabled" aria-disabled="true">
            <Icon name="chart" size={18} />
            <span>운영 통계</span>
            <span className="nav-soon">준비 중</span>
          </div>

          <div className="nav-item nav-item-disabled" aria-disabled="true">
            <Icon name="file" size={18} />
            <span>발송 로그</span>
            <span className="nav-soon">준비 중</span>
          </div>

          <p className="nav-caption nav-caption-spaced">BUSINESS</p>

          <div className="business-nav-item">
            <span className="business-nav-dot business-dot-gw" />
            <span>GW · 강원SW미래채움</span>
          </div>

          <div className="business-nav-item">
            <span className="business-nav-dot business-dot-ds" />
            <span>DS · 디지털새싹</span>
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-service-card">
            <div className="service-card-heading">
              <span className="service-indicator" />
              <strong>시스템 연결 상태</strong>
            </div>

            <span className="service-card-status">API 연동 대기</span>

            <p>
              Node.js 조회 API 연결 후
              <br />
              실시간 상태가 표시됩니다.
            </p>
          </div>
          <div className="sidebar-profile">
            <div className="profile-avatar">관리</div>
            <div className="profile-copy">
              <strong>관리자</strong>
              <span>Education Admin</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      {/* 메인 영역 */}
      <main className="main-area" id="dashboard">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <Icon name="chevron" size={14} />
            <strong>대시보드</strong>
          </div>

          <div className="topbar-actions">
            <span className="topbar-date">
              <Icon name="calendar" size={15} />
              {today}
            </span>

            <button
              className="notification-button"
              type="button"
              aria-label="알림"
            >
              <Icon name="bell" size={18} />
              <span />
            </button>

            <div className="topbar-avatar" aria-label="관리자">
              관
            </div>
          </div>
        </header>

        {/* 20261118 수정: 대시보드와 교육 데이터 화면 전환 */}
        {currentView === 'education' ? (
          <EducationDataPage
            key={selectedBusiness ?? 'ALL'}
            initialBusiness={selectedBusiness}
            onBack={() => setCurrentView('dashboard')}
          />
        ) : (
        <div className="page-content">
          {/* 페이지 제목 */}
          <section className="page-heading">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>교육 운영 대시보드</h1>
              <p className="page-subtitle">
                GW·DS 교육사업의 운영 현황과 데이터를 한곳에서 관리하세요.
              </p>
            </div>

            <button
              className="refresh-button"
              type="button"
              onClick={() => void loadEducationData()}
              disabled={isLoading}
              title="교육 데이터를 다시 조회합니다."
            >
              <Icon name="refresh" size={16} />
              {isLoading ? '조회 중...' : '데이터 새로고침'}
            </button>
          </section>

          {/* 웰컴 배너 */}
          <section className="welcome-panel">
            <div className="welcome-content">
              <span className="welcome-kicker">
                <span />
                EDUCATION MANAGEMENT
              </span>

              <h2>
                교육 운영의 흐름을
                <br />
                더 쉽고 명확하게
              </h2>

              <p>
                흩어져 있는 교육 데이터를 통합하고
                <br className="desktop-break" />
                필요한 운영 정보를 빠르게 확인할 수 있습니다.
              </p>

              <div className="welcome-meta">
                <span>
                  <Icon name="layers" size={15} />
                  GW · DS 통합 관리
                </span>

                <i />

                <span>
                  <Icon name="calendar" size={15} />
                  {today}
                </span>
              </div>
            </div>

            <div className="welcome-visual" aria-hidden="true">
              <div className="visual-glow" />
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />

              <div className="visual-card visual-card-back">
                <span className="visual-card-label">DATA OVERVIEW</span>
                <div className="visual-mini-bars">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>

              <div className="visual-card visual-card-front">
                <div className="visual-card-top">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="visual-card-line line-long" />
                <div className="visual-card-line line-short" />
                <div className="visual-card-bottom">
                  <b />
                  <b />
                  <b />
                </div>
              </div>

              <div className="visual-floating visual-floating-one">
                <Icon name="database" size={18} />
              </div>

              <div className="visual-floating visual-floating-two">
                <Icon name="chart" size={18} />
              </div>
            </div>
          </section>

          {/* 핵심 지표 */}
          <section className="section-block">
            <div className="section-heading">
              <div>
                <h2>핵심 지표</h2>
                <p>현재 사업 데이터 조회 상태입니다.</p>
              </div>

              <span className="waiting-label">
                <span />
                {isLoading
                  ? '데이터 조회 중'
                  : isConnected
                    ? '데이터 연결 완료'
                    : hasPartialConnection
                      ? '일부 데이터 연결 실패'
                      : '데이터 연결 실패'}
              </span>
            </div>

            <div className="metric-grid">
              <MetricCard
                label="전체 교육 건수"
                value={isLoading ? '조회 중' : totalCount.toLocaleString()}
                detail="GW + DS 최근 30일"
                icon="layers"
                tone="blue"
              />

              <MetricCard
                label="GW 교육 건수"
                value={isLoading ? '조회 중' : gwData.length.toLocaleString()}
                detail={
                  gwStatus === 'error'
                    ? '조회 실패'
                    : '강원SW미래채움'
                }
                icon="book"
                tone="violet"
              />

              <MetricCard
                label="DS 교육 건수"
                value={isLoading ? '조회 중' : dsData.length.toLocaleString()}
                detail={
                  dsStatus === 'error'
                    ? '조회 실패'
                    : '디지털새싹'
                }
                icon="grid"
                tone="mint"
              />

              <MetricCard
                label="데이터 연결 상태"
                value={
                  isLoading
                    ? '조회 중'
                    : isConnected
                      ? '연결 완료'
                      : hasPartialConnection
                        ? '부분 연결'
                        : '연결 실패'
                }
                detail={
                  lastUpdated
                    ? `마지막 조회 ${lastUpdated}`
                    : '조회 결과 대기 중'
                }
                icon="database"
                tone="amber"
              />
            </div>
          </section>

          {/* 운영 추이 및 연결 상태 */}
          <section className="dashboard-grid">
            <EducationTrendChart />

            <article className="surface-card connection-card">
              <div className="card-heading">
                <div>
                  <h2>데이터 연결 현황</h2>
                  <p>서비스 구성 요소별 준비 상태</p>
                </div>

                <div className="connection-heading-icon">
                  <Icon name="database" size={18} />
                </div>
              </div>

              <div className="connection-list">
                <ConnectionRow
                  name="React 프론트엔드"
                  description="대시보드 화면 구성"
                  status="준비 완료"
                  statusType="ready"
                  icon="grid"
                />

                <ConnectionRow
                  name="Node.js 조회 API"
                  description="GW·DS 데이터 조회"
                  status={
                    isLoading
                      ? '조회 중'
                      : isConnected
                        ? '연결 완료'
                        : hasPartialConnection
                          ? '일부 연결'
                          : '연결 실패'
                  }
                  statusType={hasPartialConnection ? 'ready' : 'waiting'}
                  icon="database"
                />

                <ConnectionRow
                  name="Google Sheets"
                  description="원본 교육 데이터 조회"
                  status={
                    isLoading
                      ? '조회 중'
                      : isConnected
                        ? '연결 완료'
                        : hasPartialConnection
                          ? '일부 연결'
                          : '연결 실패'
                  }
                  statusType={hasPartialConnection ? 'ready' : 'waiting'}
                  icon="file"
                />
              </div>

              <div className="connection-note">
                <Icon name="info" size={15} />
                <span>
                  {isLoading
                    ? '교육 데이터를 조회하고 있습니다.'
                    : gwError || dsError || '교육 데이터 조회가 완료되었습니다.'}
                </span>
              </div>
            </article>
          </section>

          {/* 사업별 데이터 */}
          <section className="section-block business-section">
            <div className="section-heading">
              <div>
                <h2>사업별 데이터</h2>
                <p>각 사업의 데이터 조회 화면을 준비하고 있습니다.</p>
              </div>

              <span className="section-caption">2개 사업</span>
            </div>

            <div className="business-card-grid">
              <article className="business-card business-card-gw">
                <div className="business-card-top">
                  <div className="business-symbol">GW</div>
                  <span className="business-status">화면 준비 중</span>
                </div>

                <div>
                  <p className="business-overline">GW PROJECT</p>
                  <h3>강원SW미래채움</h3>
                  <p className="business-description">
                    강원 지역 교육 운영 데이터와 일정을 관리합니다.
                  </p>
                </div>

                {/* 20261118 수정: GW 상세 조회 연결 */}
                <button
                  type="button"
                  className="business-card-footer"
                  onClick={() => openEducationPage('GW')}
                >
                  <span>교육 데이터 조회</span>
                  <Icon name="chevron" size={16} />
                </button>
              </article>

              <article className="business-card business-card-ds">
                <div className="business-card-top">
                  <div className="business-symbol">DS</div>
                  <span className="business-status">화면 준비 중</span>
                </div>

                <div>
                  <p className="business-overline">DS PROJECT</p>
                  <h3>디지털새싹</h3>
                  <p className="business-description">
                    디지털새싹 교육 운영 데이터와 실적을 관리합니다.
                  </p>
                </div>

                {/* 20261118 수정: DS 상세 조회 연결 */}
                <button
                  type="button"
                  className="business-card-footer"
                  onClick={() => openEducationPage('DS')}
                >
                  <span>교육 데이터 조회</span>
                  <Icon name="chevron" size={16} />
                </button>
              </article>
            </div>
          </section>

          {/* 푸터 */}
          <footer className="page-footer">
            <span>GOOGLE SHEET READER</span>
            <span>Education Operations Dashboard</span>
          </footer>
        </div>
        )}
      </main>
    </div>
  )
}

export default Dashboard
