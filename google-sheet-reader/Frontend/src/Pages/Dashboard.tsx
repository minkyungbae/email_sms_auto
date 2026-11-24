/**
 * @file Dashboard.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-24
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
 *
 * 주요 기능:
 * - 좌측 사이드바 및 메뉴
 * - 상단 날짜 및 관리자 영역
 * - GW·DS 사업 정보
 * - 전체 교육 건수 등 핵심 지표
 * - 교육 운영 추이 영역
 * - 데이터 연결 상태
 * - 발송 자동화 실행 및 로그 조회
 */

// =======================================
// 1. 라이브러리 및 컴포넌트 import
// =======================================
import { useEffect, useState } from 'react'

import EducationTrendChart from '../Components/EducationTrendChart' // 20261118 추가: 교육 운영 추이 차트

import {
  Icon,
  MetricCard,
} from '../Components/DashboardUI' // 20261123 수정: 공통 UI 컴포넌트 분리

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
                5-5. 교육 운영 추이 및 연결 상태
            ======================================= */}
            <section className="dashboard-grid">
              <EducationTrendChart
                gwData={gwData}
                dsData={dsData}
                gwStatus={gwStatus}
                dsStatus={dsStatus}
                isLoading={isLoading}
              />
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