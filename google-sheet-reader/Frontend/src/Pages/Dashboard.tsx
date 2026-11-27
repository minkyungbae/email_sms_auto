/**
 * @file Dashboard.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-26
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
 * - 2026-11-25: 월별 캘린더 화면 및 메뉴 추가
 * - 2026-11-25: 교육 데이터 메뉴명을 교육 실적 현황으로 변경
 * - 2026-11-25: 발송 로그 -> 교육 안내로 수정
 * - 2026-11-26: 사업 현황 페이지 삭제
 * - 2026-11-26: 워크스페이스 토글로 GW / DS 사업 화면 분리
 *               (GW: 사업 소개·교육 실적 현황·월별 캘린더·교육 안내 발송 / DS: 월별 캘린더·교육 안내 발송)
 * - 2026-11-26: GW / DS 완전 분리
 *               사업 소개 화면을 BusinessOverviewPage로 분리하고 GW 전용 지표로 구성 (DS는 사업 소개 없음)
 *               교육 실적 현황은 GW 데이터만 조회
 * - 2026-11-26: GW에 운영 데이터 메뉴 추가 (수요처 정보 / 운영 인력 / 강사 배정 / 강사비 / 교구재)
 * - 2026-11-26: GW에 MBO 메뉴 추가 (MBO 시트 4~21행)
 *
 * 주요 기능:
 * - 좌측 사이드바 및 메뉴
 * - 상단 날짜 및 관리자 영역
 * - 워크스페이스(GW / DS) 전환 및 사업별 메뉴
 * - 사업별 화면 전환 (사업 소개 / 교육 실적 현황 / 월별 캘린더 / 교육 안내 발송)
 */

// =======================================
// 1. 라이브러리 및 컴포넌트 import
// =======================================
import { useEffect, useRef, useState } from 'react'

import { Icon } from '../Components/DashboardUI' // 20261123 수정: 공통 UI 컴포넌트 분리

import type { IconName } from '../Components/DashboardUI' // 20261125 추가: 기능 소개 아이콘

import EducationDataPage from './EducationDataPage' // 20261118 추가: 교육 데이터 조회 화면
import LogDataPage from './LogDataPage' // 20261119 추가: 발송 로그 조회 화면
import MonthlyCalendarPage from './MonthlyCalendarPage' // 20261125 추가: 월별 캘린더 화면
import BusinessOverviewPage from './BusinessOverviewPage' // 20261126 추가: GW 사업 소개 화면
// 20261126 추가: 운영 데이터 화면
import DemandPage from './DemandPage'
import StaffPage from './StaffPage'
import AssignmentPage from './AssignmentPage'
import InstructorFeePage from './InstructorFeePage'
import MaterialsPage from './MaterialsPage'
import MboPage from './MboPage' // 20261126 추가: MBO 화면

import type { BusinessType } from '../Types/education' // 20261118 추가: 사업 구분 타입


// =======================================
// 1-0. 20261126 추가: 워크스페이스(사업)별 설정
// GW: 메인 사업, 전체 메뉴 사용 / DS: 월별 캘린더·교육 안내 발송만 사용
// =======================================
const WORKSPACES: Record<BusinessType, {
  avatar: string
  name: string
  label: string
  views: DashboardView[]
  defaultView: DashboardView
}> = {
  GW: {
    avatar: 'GW',
    name: '강원SW미래채움',
    label: 'GW · 강원SW미래채움',
    views: ['dashboard', 'education', 'mbo', 'calendar', 'logs', 'demand', 'staff', 'assignment', 'fee', 'materials'], // 20261126 수정: 운영 데이터·MBO 추가
    defaultView: 'dashboard',
  },
  DS: {
    avatar: 'DS',
    name: '디지털새싹',
    label: 'DS · 디지털새싹',
    views: ['calendar', 'logs'], // DS는 월별 캘린더·교육 안내 발송만 사용
    defaultView: 'calendar',
  },
}

const WORKSPACE_ORDER: BusinessType[] = ['GW', 'DS']

// 20261126 추가: 사이드바 메뉴 목록 (워크스페이스별로 필터링하여 표시)
// 20261126 수정: group 추가 (menu: 주 메뉴 / operations: 운영 데이터)
const NAV_ITEMS: { view: DashboardView; icon: IconName; label: string; group: 'menu' | 'operations' }[] = [
  { view: 'dashboard', icon: 'dashboard', label: '사업 소개', group: 'menu' },
  { view: 'education', icon: 'book', label: '교육 실적 현황', group: 'menu' },
  { view: 'mbo', icon: 'chart', label: 'MBO', group: 'menu' }, // 20261126 추가
  { view: 'calendar', icon: 'calendar', label: '월별 캘린더', group: 'menu' },
  { view: 'logs', icon: 'file', label: '교육 안내 발송', group: 'menu' },
  { view: 'demand', icon: 'building', label: '수요처 정보', group: 'operations' },
  { view: 'staff', icon: 'users', label: '운영 인력', group: 'operations' },
  { view: 'assignment', icon: 'clipboard', label: '강사 배정', group: 'operations' },
  { view: 'fee', icon: 'wallet', label: '강사비', group: 'operations' },
  { view: 'materials', icon: 'box', label: '교구재', group: 'operations' },
]

const NAV_GROUPS: { group: 'menu' | 'operations'; caption: string }[] = [
  { group: 'menu', caption: 'MENU' },
  { group: 'operations', caption: 'OPERATIONS' },
]


// =======================================
// 1-1. 20261123 추가: 페이지별 breadcrumb 제목
// 20261126 수정: business 삭제
// =======================================
const PAGE_TITLES: Record<DashboardView, string> = {
  dashboard: '사업 소개',
  education: '교육 실적 현황',
  calendar: '월별 캘린더',
  logs: '교육 안내 발송',
  demand: '수요처 정보', // 20261126 추가
  staff: '운영 인력', // 20261126 추가
  assignment: '강사 배정', // 20261126 추가
  fee: '강사비', // 20261126 추가
  materials: '교구재', // 20261126 추가
  mbo: 'MBO', // 20261126 추가
}


// =======================================
// 1-2. 20261125 추가: 웹 서비스 주요 기능 소개
// 20261126 수정: business 삭제
// =======================================
type DashboardView =
  | 'dashboard'
  | 'education'
  | 'calendar'
  | 'logs'
  | 'demand' // 20261126 추가: 수요처 정보
  | 'staff' // 20261126 추가: 운영 인력
  | 'assignment' // 20261126 추가: 강사 배정
  | 'fee' // 20261126 추가: 강사비
  | 'materials' // 20261126 추가: 교구재
  | 'mbo' // 20261126 추가: MBO

// 20261126 수정: 서비스 기능 소개는 BusinessOverviewPage로 이동


// =======================================
// 2. 대시보드 메인 컴포넌트
// =======================================
function Dashboard() {

  // 20261126 수정: 교육 데이터 조회는 BusinessOverviewPage에서 처리

  // =======================================
  // 2-2. 화면 전환 상태
  // 20261118 추가
  // 20261119 수정: 교육 안내 발송 화면 추가
  // 20261126 수정: business 삭제
  // =======================================
  const [currentView, setCurrentView] = useState<DashboardView>('dashboard')

  // 20261126 추가: 현재 워크스페이스(사업) 및 토글 메뉴 상태
  const [workspace, setWorkspace] = useState<BusinessType>('GW')
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)

  const workspaceConfig = WORKSPACES[workspace]

  // =======================================
  // 2-4. 워크스페이스 전환
  // 20261126 추가: 전환한 사업에 없는 화면이면 기본 화면으로 이동
  // =======================================
  const switchWorkspace = (nextWorkspace: BusinessType) => {
    setIsWorkspaceMenuOpen(false)

    if (nextWorkspace === workspace) return

    const nextConfig = WORKSPACES[nextWorkspace]

    setWorkspace(nextWorkspace)
    setCurrentView((view) =>
      nextConfig.views.includes(view) ? view : nextConfig.defaultView,
    )
  }

  // 20261126 추가: 메뉴 바깥 클릭 / ESC 키로 워크스페이스 메뉴 닫기
  useEffect(() => {
    if (!isWorkspaceMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!workspaceMenuRef.current?.contains(event.target as Node)) {
        setIsWorkspaceMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsWorkspaceMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isWorkspaceMenuOpen])

  // =======================================
  // 4. 상단 날짜
  // =======================================
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
        {/* 20261126 수정: 워크스페이스 토글 (GW / DS 사업 전환) */}
        <div className="workspace-switcher-wrap" ref={workspaceMenuRef}>
          <button
            type="button"
            className={`workspace-switcher ${isWorkspaceMenuOpen ? 'is-open' : ''}`}
            onClick={() => setIsWorkspaceMenuOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={isWorkspaceMenuOpen}
          >
            <div className="workspace-avatar">
              {workspaceConfig.avatar}
            </div>

            <div className="workspace-copy">
              <span>WORKSPACE</span>
              <strong>{workspaceConfig.name}</strong>
            </div>

            <span className="workspace-chevron">
              <Icon name="chevron" size={15} />
            </span>
          </button>

          {isWorkspaceMenuOpen && (
            <ul className="workspace-menu" role="listbox" aria-label="워크스페이스 선택">
              {WORKSPACE_ORDER.map((type) => (
                <li key={type}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={workspace === type}
                    className={`workspace-menu-item ${workspace === type ? 'is-selected' : ''}`}
                    onClick={() => switchWorkspace(type)}
                  >
                    <span className="workspace-avatar">
                      {WORKSPACES[type].avatar}
                    </span>
                    <span className="workspace-menu-copy">
                      <strong>{WORKSPACES[type].name}</strong>
                      <small>
                        {WORKSPACES[type].views.map((view) => PAGE_TITLES[view]).join(' · ')}
                      </small>
                    </span>
                    {workspace === type && <span className="workspace-menu-check">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 주 메뉴 */}
        {/* 20261126 수정: 현재 워크스페이스에서 사용하는 메뉴만 표시 */}
        <nav className="side-navigation" aria-label="주 메뉴">
          {/* 20261126 수정: 메뉴 그룹별 표시 (운영 데이터 그룹 추가) */}
          {NAV_GROUPS.map(({ group, caption }, groupIndex) => {
            const items = NAV_ITEMS.filter((item) => item.group === group && workspaceConfig.views.includes(item.view))
            if (items.length === 0) return null

            return (
              <div key={group} className="nav-group">
                <p className={`nav-caption ${groupIndex > 0 ? 'nav-caption-spaced' : ''}`}>{caption}</p>
                {items.map((item) => (
                  <button
                    key={item.view}
                    type="button"
                    className={`nav-item ${currentView === item.view ? 'nav-item-active' : ''}`}
                    onClick={() => setCurrentView(item.view)}
                  >
                    <Icon name={item.icon} size={18} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )
          })}

          {/* 20261126 수정: 사업 목록 클릭 시 워크스페이스 전환 (좁은 화면에서도 전환 가능) */}
          <p className="nav-caption nav-caption-spaced">BUSINESS</p>
          {WORKSPACE_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              className="business-nav-item"
              onClick={() => switchWorkspace(type)}
              title={`${WORKSPACES[type].label} 워크스페이스로 전환`}
            >
              <span className={`business-nav-dot business-dot-${type.toLowerCase()}`} />
              <span>{WORKSPACES[type].label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* =======================================
          5-2. 메인 영역
      ======================================= */}
      <main className="main-area" id="dashboard">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{workspaceConfig.label}</span> {/* 20261126 수정: 현재 워크스페이스 표시 */}
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
          </div>
        </header>

        {/* 20261118 수정: 대시보드와 교육 데이터 화면 전환 */}
        {currentView === 'education' ? (
          // 20261126 수정: 교육 일정 데이터 영역 삭제, 수료 실적만 표시
          <EducationDataPage />
        ) : currentView === 'calendar' ? (
          // 20261125 추가: 월별 캘린더 화면 전환
          // 20261126 수정: 워크스페이스 사업만 표시, 사업 전환 시 화면 상태 초기화
          <MonthlyCalendarPage key={workspace} businessType={workspace} />
        ) : currentView === 'logs' ? (
          // 20261119 추가: 교육 안내 발송 화면 전환
          // 20261126 수정: 워크스페이스 사업만 표시, 사업 전환 시 화면 상태 초기화
          <LogDataPage key={workspace} businessType={workspace} />
        ) : currentView === 'demand' ? (
          // 20261126 추가: 운영 데이터 화면 (GW 전용)
          <DemandPage />
        ) : currentView === 'staff' ? (
          <StaffPage />
        ) : currentView === 'assignment' ? (
          <AssignmentPage />
        ) : currentView === 'fee' ? (
          <InstructorFeePage />
        ) : currentView === 'materials' ? (
          <MaterialsPage />
        ) : currentView === 'mbo' ? (
          // 20261126 추가: MBO (GW 전용)
          <MboPage />
        ) : (
          // 20261126 수정: GW 사업 소개 화면 (DS 워크스페이스에는 메뉴 없음)
          <BusinessOverviewPage onNavigate={setCurrentView} />
    )}</main>
    </div>
  )
}


export default Dashboard