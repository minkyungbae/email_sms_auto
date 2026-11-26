/**
 * @file BusinessOverviewPage.tsx
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * GW(강원SW미래채움) 사업 소개 화면
 *
 * 20261126 추가: Dashboard.tsx의 사업 소개 영역을 분리하고 GW 전용 지표로 구성
 *               (DS 데이터 제외, DS 워크스페이스에는 사업 소개 화면 없음)
 *
 * 주요 기능:
 * - GW 핵심 지표 (최근 30일): 교육 건수 / 수요처 수 / 참여 강사 수 / 데이터 연결 상태
 * - 서비스 소개 및 주요 기능 바로가기
 */

// =======================================
// 1. 라이브러리 및 컴포넌트 import
// =======================================
import { useEffect, useMemo } from 'react'

import { Icon, MetricCard } from '../Components/DashboardUI'
import type { IconName } from '../Components/DashboardUI'
import { useDashboardData } from '../Hooks/useDashboardData'
import type { EducationRecord, EducationValue } from '../Types/education'

// 바로가기로 이동할 수 있는 화면
export type OverviewTargetView = 'education' | 'calendar' | 'logs'

type ServiceFeature = {
  view: OverviewTargetView
  icon: IconName
  overline: string
  title: string
  description: string
  action: string
}

type MetricDefinition = {
  label: string
  detail: string
  icon: IconName
  tone: 'blue' | 'violet' | 'mint' | 'amber'
  getValue: (records: EducationRecord[]) => number
}


// =======================================
// 2. 지표 계산 함수
// =======================================
function toText(value: EducationValue | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getField(record: EducationRecord, key: string): EducationValue | undefined {
  return (record as Record<string, EducationValue | undefined>)[key]
}

/** 지정한 필드들의 고유값 개수 (빈 값 제외) */
function countUnique(records: EducationRecord[], keys: string[]): number {
  const values = new Set<string>()

  records.forEach((record) => {
    keys.forEach((key) => {
      const value = toText(getField(record, key))
      if (value) values.add(value)
    })
  })

  return values.size
}


// =======================================
// 3. GW 화면 구성
// =======================================
const BUSINESS_TYPE = 'GW' as const

const CONTENT: {
  heading: string
  subtitle: string
  intro: string
  metrics: MetricDefinition[]
  features: ServiceFeature[]
} = {
  heading: '강원SW미래채움 교육 사업 운영 관리',
  subtitle:
    '강원SW미래채움 교육 사업의 운영 실적, 데이터 관리 및 문자 발송까지 이 곳에서 한 번에 관리하세요.',
  intro:
    'Google Sheets에 기록된 강원SW미래채움 교육 운영 데이터를 웹에서 조회하고, 교육 일정에 맞춰 강사에게 문자와 이메일 안내를 발송·관리합니다. 발송 결과는 로그로 저장되어 언제든 확인할 수 있고, 필요한 수신자에게는 내용을 수정해 개별로 다시 보낼 수 있습니다.',
  metrics: [
    {
      label: 'GW 교육 건수',
      detail: '최근 30일',
      icon: 'book',
      tone: 'blue',
      getValue: (records) => records.length,
    },
    {
      label: '수요처 수',
      detail: '최근 30일 교육 진행 수요처',
      icon: 'layers',
      tone: 'violet',
      getValue: (records) => countUnique(records, ['내용(수요처명)']),
    },
    {
      label: '참여 강사 수',
      detail: '최근 30일 근무 강사',
      icon: 'grid',
      tone: 'mint',
      getValue: (records) => countUnique(records, ['강사이름']),
    },
  ],
  features: [
    {
      view: 'education',
      icon: 'book',
      overline: 'EDUCATION PERFORMANCE',
      title: '교육 실적 현황',
      description: '수료 실적을 그래프와 집계 표로 확인하고, GW 교육 일정 데이터를 조회합니다.',
      action: '교육 실적 보기',
    },
    {
      view: 'logs',
      icon: 'file',
      overline: 'DISPATCH',
      title: '문자·이메일 발송 및 로그',
      description: 'GW 발송 이력을 검색하고, 자동 발송 실행과 선택한 수신자 개별 발송·내용 수정을 처리합니다.',
      action: '교육 안내 발송 열기',
    },
    {
      view: 'logs',
      icon: 'calendar',
      overline: 'SCHEDULE',
      title: '예약 발송',
      description: '매일 오전 10시, GW 발송 기준일에 맞춰 교육 안내 문자와 이메일을 자동 발송합니다.',
      action: '발송 기준 설정',
    },
  ],
}


// =======================================
// 4. 사업 소개 페이지
// =======================================
function BusinessOverviewPage({
  onNavigate,
}: {
  onNavigate: (view: OverviewTargetView) => void
}) {
  const businessType = BUSINESS_TYPE
  const content = CONTENT

  const {
    data,
    status,
    error,
    isLoading,
    lastUpdated,
    loadEducationData,
  } = useDashboardData(businessType)

  // 최초 진입 시 교육 데이터 조회
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadEducationData()
    }, 0)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadEducationData])

  const metricValues = useMemo(
    () => CONTENT.metrics.map((metric) => metric.getValue(data)),
    [data],
  )

  const isConnected = status === 'connected'

  return (
    <div className="page-content">

      {/* 4-1. 페이지 제목 및 새로고침 */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">OVERVIEW · {businessType}</p>
          <h1>{content.heading}</h1>
          <p className="page-subtitle">{content.subtitle}</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            className="refresh-button"
            type="button"
            onClick={() => void loadEducationData()}
            disabled={isLoading}
            title={`${businessType} 교육 데이터를 다시 조회합니다.`}
          >
            <Icon name="refresh" size={16} />
            {isLoading ? '조회 중...' : '데이터 새로고침'}
          </button>
        </div>
      </section>

      {/* 4-2. 사업별 핵심 지표 */}
      <section className="section-block">
        <div className="section-heading">
          <span className="waiting-label">
            <span />
            {isLoading
              ? '데이터 조회 중'
              : isConnected
                ? `${businessType} 데이터 연결 완료`
                : `${businessType} 데이터 연결 실패`}
          </span>
        </div>

        <div className="metric-grid">
          {content.metrics.map((metric, index) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={
                isLoading
                  ? '조회 중'
                  : isConnected
                    ? metricValues[index].toLocaleString()
                    : '-'
              }
              detail={status === 'error' ? '조회 실패' : metric.detail}
              icon={metric.icon}
              tone={metric.tone}
            />
          ))}

          <MetricCard
            label="데이터 연결 상태"
            value={isLoading ? '조회 중' : isConnected ? '연결 완료' : '연결 실패'}
            detail={
              status === 'error' && error
                ? error
                : lastUpdated
                  ? `마지막 조회 ${lastUpdated}`
                  : '조회 결과 대기 중'
            }
            icon="database"
            tone="amber"
          />
        </div>
      </section>

      {/* 4-3. 서비스 소개 */}
      <section className="section-block service-intro-section">
        <article className="surface-card service-intro-card">
          <div className="card-heading">
            <div>
              <h2>서비스 소개</h2>
              <p>EDUCATION OPERATIONS &amp; MESSAGE DISPATCH</p>
            </div>
          </div>

          <p className="service-intro-text">{content.intro}</p>
        </article>

        <div className="business-card-grid service-feature-grid">
          {content.features.map((feature) => (
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
                onClick={() => onNavigate(feature.view)}
              >
                <span>{feature.action}</span>
                <Icon name="chevron" size={14} />
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* 4-4. 푸터 */}
      <footer className="page-footer">
        <span>GOOGLE SHEET READER</span>
        <span>Education Operations Dashboard · {businessType}</span>
      </footer>
    </div>
  )
}

export default BusinessOverviewPage
