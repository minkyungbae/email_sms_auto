/**
 * @file Dashboard.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-25
 * @description
 * 메인 화면 구성.
 *
 * @history
 * - 2026-11-18: 대시보드 기본 레이아웃 및 GW·DS 교육 데이터 조회 기능 구현
 * - 2026-11-18: 교육 데이터·사업 현황 페이지 연결 및 사업별 상세 조회 기능 추가
 * - 2026-11-19: 이메일·문자 발송 자동화 실행 및 진행 상태 표시 기능 추가
 * - 2026-11-19: 발송 로그 화면 연결 및 발송 완료 후 로그 화면 이동 기능 추가
 * - 2026-11-23: 공통 UI 컴포넌트(Icon, MetricCard, ConnectionRow) 분리
 * - 2026-11-23: 교육 데이터 조회 상태 및 로직을 useDashboardData 훅으로 분리
 * - 2026-11-23: 현재 화면에 따른 breadcrumb 제목 변경 기능 추가
 * - 2026-11-24: 발송 자동화 서비스 관련 코드 삭제 (발송 로그 화면으로 옮김)
 * - 2026-11-25: 교육 운영 추이 그래프 삭제 및 웹 서비스 소개 영역 추가
 *
 * 주요 기능:
 * - 좌측 사이드바 및 메뉴
 * - 상단 날짜 및 관리자 영역
 * - GW·DS 사업 정보
 * - 전체 교육 건수 등 핵심 지표
 * - 웹 서비스 소개 및 주요 기능 바로가기
 * - 데이터 연결 상태
 */

// =======================================
// 1. 라이브러리 및 컴포넌트 import
// =======================================
import { useEffect, useState } from 'react'

import {
  Icon,
  MetricCard,
} from '../Components/DashboardUI' // 20261123 수정: 공통 UI 컴포넌트 분리

import type { IconName } from '../Components/DashboardUI' // 20261125 추가: 기능 소개 아이콘

import EducationDataPage from './EducationDataPage' // 20261118 추가: 교육 데이터 조회 화면
import BusinessStatusPage from './BusinessStatusPage' // 20261118 추가: 사업 현황 페이지
import LogDataPage from './LogDataPage' // 20261119 추가: 발송 로그 조회 화면

import type { BusinessType } from '../Types/education' // 20261118 추가: 사업 구분 타입

import { useDashboardData } from '../Hooks/useDashboardData' // 20261123 추가: 교육 데이터 관리 훅


// =======================================
// 1-1. 20261123 추가: 페이지별 breadcrumb 제목
// =======================================
const PAGE_TITLES: Record<
  'dashboard' | 'education' | 'business' | 'logs',
  string
> = {
  dashboard: '대시보드',
  education: '교육 데이터',
  business: '사업 현황',
  logs: '발송 로그',
}


// =======================================
// 1-2. 20261125 추가: 웹 서비스 주요 기능 소개
// =======================================
type DashboardView = 'dashboard' | 'education' | 'business' | 'logs'

const SERVICE_FEATURES: {
  view: Exclude<DashboardView, 'dashboard'>
  icon: IconName
  overline: string
  title: string
  description: string
  action: string
}[] = [
  {
    view: 'education',
    icon: 'book',
    overline: 'EDUCATION DATA',
    title: '교육 데이터 조회',
    description: 'GW·DS 사업의 교육 일정 데이터를 사업 유형과 기간별로 통합 조회합니다.',
    action: '교육 데이터 보기',
  },
  {
    view: 'business',
    icon: 'chart',
    overline: 'BUSINESS STATUS',
    title: '사업 현황',
    description: '지역·권역·수요처·학교별 교육 건수를 집계하여 운영 현황을 확인합니다.',
    action: '사업 현황 보기',
  },
  {
    view: 'logs',
    icon: 'file',
    overline: 'DISPATCH',
    title: '문자·이메일 발송 및 로그',
    description: '발송 이력을 검색하고, 자동 발송 실행과 선택한 수신자 개별 발송·내용 수정을 처리합니다.',
    action: '발송 로그 열기',
  },
  {
    view: 'logs',
    icon: 'calendar',
    overline: 'SCHEDULE',
    title: '예약 발송',
    description: '매일 오전 10시, 설정한 수업일 기준으로 교육 안내 문자와 이메일을 자동 발송합니다.',
    action: '발송 기준 설정',
  },
]


// =======================================
// 2. 대시보드 메인 컴포넌트
// =======================================
function Dashboard() {

  // =======================================
  // 2-1. 교육 데이터 관리
  // 20261123 수정: 커스텀 훅으로 분리
  // =======================================
  const {
    gwData,
    dsData,
    gwStatus,
    dsStatus,
    isLoading,
    lastUpdated,
    loadEducationData,
  } = useDashboardData()

  // =======================================
  // 2-2. 화면 전환 상태
  // 20261118 추가
  // 20261119 수정: 발송 로그 화면 추가
  // =======================================
  const [currentView, setCurrentView] = useState<
    'dashboard' | 'education' | 'business' | 'logs'
  >('dashboard')

  const [selectedBusiness, setSelectedBusiness] =
    useState<BusinessType | null>(null)

  // =======================================
  // 2-3. 교육 데이터 화면 열기
  // 20261118 추가
  // =======================================
  const openEducationPage = (
    business: BusinessType | null = null,
  ) => {
    setSelectedBusiness(business)
    setCurrentView('education')
  }

  // =======================================
  // 3. 최초 진입 시 교육 데이터 조회
  // 20261118 추가
  // =======================================
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadEducationData()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadEducationData])

  // =======================================
  // 4. 대시보드 데이터 계산
  // =======================================
  // 20261118 추가: 전체 데이터 건수
  const totalCount = gwData.length + dsData.length

  // 20261118 추가: 통합 API 연결 상태
  const isConnected = gwStatus === 'connected' && dsStatus === 'connected'

  const hasPartialConnection = gwStatus === 'connected' || dsStatus === 'connected'

  // 오늘 날짜
  const today = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())

  // =======================================
  // 5. 화면 렌더링
  // =======================================
  return (
    <div className="app-shell">

      {/* =======================================
          5-1. 사이드바
      ======================================= */}
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

        {/* 주 메뉴 */}
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

          {/* 20261118 수정: 사업 현황 메뉴 연결 */}
          <button
            type="button"
            className={`nav-item ${currentView === 'business' ? 'nav-item-active' : ''}`}
            onClick={() => setCurrentView('business')}
          >
            <Icon name="chart" size={18} />
            <span>사업 현황</span>
          </button>

          {/* 20261119 수정: 발송 로그 메뉴 연결 */}
          <button
            type="button"
            className={`nav-item ${currentView === 'logs' ? 'nav-item-active' : ''}`}
            onClick={() => setCurrentView('logs')}
          >
            <Icon name="file" size={18} />
            <span>발송 로그</span>
          </button>
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
      </aside>

      {/* =======================================
          5-2. 메인 영역
      ======================================= */}
      <main className="main-area" id="dashboard">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <Icon name="chevron" size={14} />
            <strong>
              {PAGE_TITLES[currentView]} {/* 20261123 수정: 현재 화면에 따른 제목 표시 */}
            </strong>
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
        ) : currentView === 'business' ? (
          <BusinessStatusPage /> // 20261118 추가: 사업 현황 화면 전환
        ) : currentView === 'logs' ? (
          <LogDataPage /> // 20261119 추가: 발송 로그 화면 전환
        ) : (
          <div className="page-content">

            {/* =======================================
                5-3. 페이지 제목 및 버튼
            ======================================= */}
            <section className="page-heading">
              <div>
                <p className="eyebrow">OVERVIEW</p>
                <h1>교육 운영 대시보드</h1>
                <p className="page-subtitle">
                  교육사업의 운영 현황과 데이터를 한곳에서 관리하세요.
                </p>
              </div>

              {/* 20261119 수정: 데이터 새로고침 및 발송 실행 버튼 */}
              {/* 20261124 수정: 발송 실행 버튼 삭제, 데이터 새로고침만 유지 */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>

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
              </div>
            </section>

            {/* =======================================
                5-4. 핵심 지표
            ======================================= */}
            <section className="section-block">
              <div className="section-heading">
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

            {/* =======================================
                5-5. 웹 서비스 소개
                20261125 수정: 교육 운영 추이 그래프 삭제 후 서비스 설명으로 대체
            ======================================= */}
            <section className="section-block service-intro-section">
              <article className="surface-card service-intro-card">
                <div className="card-heading">
                  <div>
                    <h2>서비스 소개</h2>
                    <p>EDUCATION OPERATIONS &amp; MESSAGE DISPATCH</p>
                  </div>
                </div>

                <p className="service-intro-text">
                  Google Sheets에 기록된 GW·DS 교육 운영 데이터를 웹에서 조회하고,
                  교육 일정에 맞춰 강사·담당교사에게 문자와 이메일 안내를 발송·관리하는
                  교육사업 운영 관리 시스템입니다. 발송 결과는 로그로 저장되어 언제든
                  확인할 수 있고, 필요한 수신자에게는 내용을 수정해 개별로 다시 보낼 수 있습니다.
                </p>
              </article>

              <div className="business-card-grid service-feature-grid">
                {SERVICE_FEATURES.map((feature) => (
                  <article key={feature.title} className="business-card">
                    <div>
                      <div className="business-card-top">
                        <span className="business-symbol" aria-hidden="true">
                          <Icon name={feature.icon} size={17} />
                        </span>
                      </div>

                      <p className="business-overline">{feature.overline}</p>
                      <h3>{feature.title}</h3>
                      <p className="business-description">{feature.description}</p>
                    </div>

                    <button
                      type="button"
                      className="business-card-footer"
                      onClick={() =>
                        feature.view === 'education'
                          ? openEducationPage()
                          : setCurrentView(feature.view)
                      }
                    >
                      <span>{feature.action}</span>
                      <Icon name="chevron" size={14} />
                    </button>
                  </article>
                ))}
              </div>
            </section>

            {/* =======================================
                5-6. 푸터
            ======================================= */}
            <footer className="page-footer">
              <span>GOOGLE SHEET READER</span>
              <span>Education Operations Dashboard</span>
            </footer>
          </div>
    )}</main>
    </div>
  )
}


export default Dashboard