/**
 * @file MonthlyCalendarPage.tsx
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 월별 교육 일정을 달력 형태로 조회하는 화면
 *
 * 주요 기능:
 * - 선택한 월의 GW·DS 교육 일정을 달력에 표시
 * - 이전 달 / 다음 달 / 이번 달 이동 및 연월 직접 선택
 * - 사업 구분(전체 / GW / DS) 필터
 * - 일자별 교육 건수 및 일정 요약 표시
 * - 일정 클릭 시 교육 상세 정보 조회
 * - 하루 일정이 많을 때 "더보기"로 해당 일자 전체 목록 조회
 */

import { useEffect, useMemo, useState } from 'react'

import { Icon } from '../Components/DashboardUI'
import { getEducationByDateRange } from '../Services/EducationService'
import { formatIsoDate, normalizeDateValue } from '../Utils/date'
import type {
  BusinessType,
  EducationRecord,
  EducationValue,
} from '../Types/education'

// =======================================
// 1. 화면 설정 및 타입
// =======================================
const MAX_VISIBLE_EVENTS = 3 // 달력 칸에 표시할 최대 일정 수
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

type BusinessFilter = 'ALL' | BusinessType

type YearMonth = {
  year: number
  month: number // 0 ~ 11
}

/** 달력에 표시하는 교육 일정 한 건 */
type CalendarEvent = {
  key: string
  date: string // YYYY-MM-DD
  business: BusinessType
  title: string
  subtitle: string
  time: string
  record: EducationRecord
}

/** 월별 조회 결과 */
type MonthData = {
  requestKey: string
  events: CalendarEvent[]
  errors: string[]
  loadedAt: string
}

/** 상세 모달 상태: 일정 상세 또는 일자별 목록 */
type ModalState =
  | { type: 'event'; event: CalendarEvent; fromDate: string | null }
  | { type: 'day'; date: string }

// =======================================
// 2. 날짜 계산 함수
// =======================================
function getCurrentYearMonth(): YearMonth {
  const today = new Date()
  return { year: today.getFullYear(), month: today.getMonth() }
}

function shiftMonth({ year, month }: YearMonth, offset: number): YearMonth {
  const date = new Date(year, month + offset, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

function toMonthValue({ year, month }: YearMonth): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function getMonthRange({ year, month }: YearMonth) {
  return {
    startDate: formatIsoDate(new Date(year, month, 1)),
    endDate: formatIsoDate(new Date(year, month + 1, 0)),
  }
}

/** 일요일 시작 기준 달력 칸(주 단위) 생성 */
function getCalendarDays({ year, month }: YearMonth): {
  date: string
  day: number
  isCurrentMonth: boolean
  weekday: number
}[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const start = new Date(firstDay)
  start.setDate(start.getDate() - firstDay.getDay())

  const end = new Date(lastDay)
  end.setDate(end.getDate() + (6 - lastDay.getDay()))

  const days = []
  const cursor = new Date(start)

  while (cursor <= end) {
    days.push({
      date: formatIsoDate(cursor),
      day: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === month,
      weekday: cursor.getDay(),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function formatKoreanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()]

  return `${year}년 ${month}월 ${day}일 (${weekday})`
}

// =======================================
// 3. 교육 데이터 → 달력 일정 변환
// =======================================
function getValue(record: EducationRecord, key: string): EducationValue | undefined {
  return (record as Record<string, EducationValue | undefined>)[key]
}

function toText(value: EducationValue | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function displayValue(value: EducationValue | undefined): string {
  return toText(value) || '-'
}

function isDsRecord(record: EducationRecord): boolean {
  return '사업구분' in record && record.사업구분 === 'DS'
}

function toCalendarEvent(record: EducationRecord, index: number): CalendarEvent | null {
  const date = normalizeDateValue(record.근무날짜)

  if (!date) return null

  if (isDsRecord(record)) {
    const school = toText(getValue(record, '학교명'))
    const course = toText(getValue(record, '과정명'))

    return {
      key: `DS-${date}-${index}`,
      date,
      business: 'DS',
      title: school || course || 'DS 교육',
      subtitle: course,
      time: toText(getValue(record, '시간')),
      record,
    }
  }

  const instructor = toText(getValue(record, '강사이름'))
  const place = toText(getValue(record, '내용(수요처명)'))

  return {
    key: `GW-${date}-${index}`,
    date,
    business: 'GW',
    title: place || instructor || 'GW 교육',
    subtitle: instructor,
    time: toText(getValue(record, '근무시간')),
    record,
  }
}

/** 시간 문자열의 시작 시각을 분 단위로 변환 (예: "9:00~10:40" → 540, 시간 없음 → 맨 뒤) */
function getStartMinutes(time: string): number {
  const match = time.match(/(\d{1,2})\s*[:시]\s*(\d{2})?/)

  if (!match) return Number.MAX_SAFE_INTEGER

  return Number(match[1]) * 60 + Number(match[2] ?? 0)
}

/** 같은 날짜 안에서 시작 시각 → 사업 → 제목 순 정렬 */
function compareEvents(first: CalendarEvent, second: CalendarEvent): number {
  return (
    getStartMinutes(first.time) - getStartMinutes(second.time) ||
    first.business.localeCompare(second.business) ||
    first.title.localeCompare(second.title, 'ko')
  )
}

// =======================================
// 4. 사업별 상세 항목
// =======================================
const GW_DETAIL_FIELDS: { label: string; key: string }[] = [
  { label: '근무 날짜', key: '근무날짜' },
  { label: '지역', key: '지역' },
  { label: '수요처명', key: '내용(수요처명)' },
  { label: '반명', key: '반명' },
  { label: '근무시간', key: '근무시간' },
  { label: '근무유형', key: '근무유형' },
  { label: '강사 이름', key: '강사이름' },
  { label: '강사 유형', key: '강사유형' },
  { label: '연락처', key: '연락처' },
  { label: '이메일', key: '이메일목록' },
]

const DS_DETAIL_FIELDS: { label: string; key: string }[] = [
  { label: '수업 날짜', key: '근무날짜' },
  { label: '권역', key: '권역' },
  { label: '학교명', key: '학교명' },
  { label: '과정명', key: '과정명' },
  { label: 'LMS 번호 / 반', key: 'LMS번호반' },
  { label: '학생 수', key: '학생수' },
  { label: '수업 시간', key: '시간' },
  { label: '수업 일차 / 차시', key: '__일차차시' },
  { label: '프로그램 운영 유형', key: '프로그램운영유형' },
  { label: '신청 교육 대상', key: '신청교육대상' },
  { label: '담당교사', key: '담당교사명' },
  { label: '담당교사 연락처', key: '담당교사연락처' },
  { label: '담당교사 이메일', key: '담당교사이메일' },
  { label: '주강사', key: '주강사명' },
  { label: '주강사 연락처', key: '주강사연락처' },
  { label: '보조강사', key: '보조강사명' },
  { label: '보조강사 연락처', key: '보조강사연락처' },
  { label: '학교 주소', key: '학교주소' },
]

function getDetailValue(record: EducationRecord, key: string): string {
  if (key === '__일차차시') {
    const parts = [toText(getValue(record, '수업일차')), toText(getValue(record, '수업차시'))]
      .filter(Boolean)
    return parts.join(' / ') || '-'
  }

  return displayValue(getValue(record, key))
}

// =======================================
// 5. 교육 일정 상세 / 일자별 목록 모달
// =======================================
function CalendarModal({
  state,
  events,
  onSelectEvent,
  onBack,
  onClose,
}: {
  state: ModalState
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent, fromDate: string) => void
  onBack: (date: string) => void
  onClose: () => void
}) {
  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isEvent = state.type === 'event'
  const dayDate = isEvent ? state.event.date : state.date
  const dayEvents = events.filter((event) => event.date === dayDate)

  return (
    <div
      className="calendar-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="calendar-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
      >
        <header className="calendar-modal-header">
          <div>
            <p className="calendar-modal-eyebrow">
              {isEvent ? 'EDUCATION DETAIL' : 'DAILY SCHEDULE'}
            </p>
            <h2 id="calendar-modal-title">
              {isEvent ? state.event.title : formatKoreanDate(state.date)}
            </h2>
            <p>
              {isEvent
                ? `${formatKoreanDate(state.event.date)}${state.event.time ? ` · ${state.event.time}` : ''}`
                : `교육 일정 ${dayEvents.length}건`}
            </p>
          </div>

          <button
            type="button"
            className="calendar-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="calendar-modal-body">
          {isEvent ? (
            /* 5-1. 교육 일정 상세 */
            <>
              <div className="calendar-detail-badges">
                <span className={`calendar-business-badge calendar-business-${state.event.business.toLowerCase()}`}>
                  <i aria-hidden="true" />
                  {state.event.business === 'GW' ? 'GW · 강원SW미래채움' : 'DS · 디지털새싹'}
                </span>
              </div>

              <dl className="calendar-detail-grid">
                {(state.event.business === 'GW' ? GW_DETAIL_FIELDS : DS_DETAIL_FIELDS).map(
                  (field) => (
                    <div key={field.key} className="calendar-detail-field">
                      <dt>{field.label}</dt>
                      <dd>{getDetailValue(state.event.record, field.key)}</dd>
                    </div>
                  ),
                )}
              </dl>
            </>
          ) : (
            /* 5-2. 일자별 교육 목록 */
            <ul className="calendar-day-list">
              {dayEvents.map((event) => (
                <li key={event.key}>
                  <button
                    type="button"
                    className="calendar-day-list-item"
                    onClick={() => onSelectEvent(event, state.date)}
                  >
                    <span className={`calendar-dot calendar-business-${event.business.toLowerCase()}`} aria-hidden="true" />
                    <span className="calendar-day-list-copy">
                      <strong>{event.title}</strong>
                      <small>
                        {[event.business, event.time, event.subtitle].filter(Boolean).join(' · ')}
                      </small>
                    </span>
                    <Icon name="chevron" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="calendar-modal-footer">
          {isEvent && state.fromDate && (
            <button
              type="button"
              className="calendar-modal-secondary"
              onClick={() => onBack(state.fromDate as string)}
            >
              ← 일자 목록
            </button>
          )}

          {isEvent && !state.fromDate && dayEvents.length > 1 && (
            <button
              type="button"
              className="calendar-modal-secondary"
              onClick={() => onBack(state.event.date)}
            >
              이 날짜 전체 일정 ({dayEvents.length}건)
            </button>
          )}

          <button type="button" className="calendar-modal-confirm" onClick={onClose}>
            닫기
          </button>
        </footer>
      </section>
    </div>
  )
}

// =======================================
// 6. 월별 캘린더 페이지
// =======================================
function MonthlyCalendarPage() {
  // ---------------------------------------
  // 6-1. 조회 조건 상태
  // ---------------------------------------
  const [yearMonth, setYearMonth] = useState<YearMonth>(getCurrentYearMonth)
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>('ALL')
  const [reloadToken, setReloadToken] = useState(0)

  // ---------------------------------------
  // 6-2. 조회 결과 및 모달 상태
  // ---------------------------------------
  const [monthData, setMonthData] = useState<MonthData | null>(null)
  const [modalState, setModalState] = useState<ModalState | null>(null)

  const requestKey = `${toMonthValue(yearMonth)}#${reloadToken}`
  const isLoading = monthData?.requestKey !== requestKey

  // ---------------------------------------
  // 6-3. 선택한 월의 GW·DS 교육 데이터 조회
  // 한 사업 조회가 실패해도 나머지 사업 일정은 표시
  // ---------------------------------------
  useEffect(() => {
    let isActive = true
    const { startDate, endDate } = getMonthRange(yearMonth)
    const businessTypes: BusinessType[] = ['GW', 'DS']

    Promise.allSettled(
      businessTypes.map((businessType) =>
        getEducationByDateRange({ businessType, startDate, endDate }),
      ),
    ).then((results) => {
      if (!isActive) return

      const records: EducationRecord[] = []
      const errors: string[] = []

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          records.push(...result.value)
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : '조회 실패'
          errors.push(`${businessTypes[index]} 데이터 조회 실패: ${reason}`)
        }
      })

      const events = records
        .map(toCalendarEvent)
        .filter((event): event is CalendarEvent => event !== null)
        .sort((first, second) => first.date.localeCompare(second.date) || compareEvents(first, second))

      setMonthData({
        requestKey: `${toMonthValue(yearMonth)}#${reloadToken}`,
        events,
        errors,
        loadedAt: new Intl.DateTimeFormat('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      })
    })

    return () => {
      isActive = false
    }
  }, [yearMonth, reloadToken])

  // ---------------------------------------
  // 6-4. 화면 표시 데이터 계산
  // ---------------------------------------
  const visibleEvents = useMemo(() => {
    if (isLoading || !monthData) return []

    return businessFilter === 'ALL'
      ? monthData.events
      : monthData.events.filter((event) => event.business === businessFilter)
  }, [monthData, businessFilter, isLoading])

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()

    visibleEvents.forEach((event) => {
      const list = grouped.get(event.date) ?? []
      list.push(event)
      grouped.set(event.date, list)
    })

    return grouped
  }, [visibleEvents])

  const calendarDays = useMemo(() => getCalendarDays(yearMonth), [yearMonth])

  const allEvents = isLoading ? [] : monthData?.events ?? []
  const gwCount = allEvents.filter((event) => event.business === 'GW').length
  const dsCount = allEvents.filter((event) => event.business === 'DS').length
  const activeDays = eventsByDate.size

  const todayDate = formatIsoDate(new Date())
  const isCurrentMonth = toMonthValue(yearMonth) === toMonthValue(getCurrentYearMonth())

  // ---------------------------------------
  // 6-5. 이벤트 처리
  // ---------------------------------------
  const moveMonth = (offset: number) => {
    setYearMonth((current) => shiftMonth(current, offset))
    setModalState(null)
  }

  const handleMonthInput = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})$/)
    if (!match) return

    setYearMonth({ year: Number(match[1]), month: Number(match[2]) - 1 })
    setModalState(null)
  }

  // =======================================
  // 7. 화면 렌더링
  // =======================================
  return (
    <div className="page-content monthly-calendar-page">
      {/* 7-1. 페이지 제목 */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">MONTHLY CALENDAR</p>
          <h1>월별 캘린더</h1>
          <p className="page-subtitle">
            월별 GW·DS 교육 일정을 달력으로 한눈에 확인하고, 일정을 눌러 상세 정보를 조회합니다.
          </p>
        </div>

        <button
          className="refresh-button"
          type="button"
          onClick={() => setReloadToken((token) => token + 1)}
          disabled={isLoading}
          title="선택한 월의 교육 일정을 다시 조회합니다."
        >
          <Icon name="refresh" size={16} />
          {isLoading ? '조회 중...' : '새로고침'}
        </button>
      </section>

      {/* 7-2. 월 선택 및 필터 */}
      <section className="surface-card calendar-toolbar">
        <div className="calendar-month-nav">
          <button
            type="button"
            className="calendar-nav-button"
            onClick={() => moveMonth(-1)}
            aria-label="이전 달"
          >
            <span className="calendar-chevron-left">
              <Icon name="chevron" size={16} />
            </span>
          </button>

          <h2 className="calendar-month-title">
            {yearMonth.year}년 {yearMonth.month + 1}월
          </h2>

          <button
            type="button"
            className="calendar-nav-button"
            onClick={() => moveMonth(1)}
            aria-label="다음 달"
          >
            <Icon name="chevron" size={16} />
          </button>

          <button
            type="button"
            className="calendar-today-button"
            onClick={() => {
              setYearMonth(getCurrentYearMonth())
              setModalState(null)
            }}
            disabled={isCurrentMonth}
          >
            이번 달
          </button>
        </div>

        <div className="calendar-toolbar-controls">
          <label>
            <span>연월 선택</span>
            <input
              type="month"
              value={toMonthValue(yearMonth)}
              onChange={(event) => handleMonthInput(event.target.value)}
            />
          </label>

          <label>
            <span>사업 구분</span>
            <select
              value={businessFilter}
              onChange={(event) => setBusinessFilter(event.target.value as BusinessFilter)}
            >
              <option value="ALL">전체 사업</option>
              <option value="GW">GW · 강원SW미래채움</option>
              <option value="DS">DS · 디지털새싹</option>
            </select>
          </label>
        </div>
      </section>

      {/* 7-3. 월간 요약 */}
      <section className="calendar-summary" aria-label="월간 교육 요약">
        <div>
          <span>이번 달 교육</span>
          <strong>{isLoading ? '조회 중' : `${allEvents.length.toLocaleString()}건`}</strong>
        </div>
        <div>
          <span><i className="calendar-dot calendar-business-gw" />GW</span>
          <strong>{isLoading ? '-' : `${gwCount.toLocaleString()}건`}</strong>
        </div>
        <div>
          <span><i className="calendar-dot calendar-business-ds" />DS</span>
          <strong>{isLoading ? '-' : `${dsCount.toLocaleString()}건`}</strong>
        </div>
        <div>
          <span>교육 진행일</span>
          <strong>{isLoading ? '-' : `${activeDays}일`}</strong>
        </div>
        <p className="calendar-summary-updated">
          {monthData && !isLoading ? `마지막 조회 ${monthData.loadedAt}` : ''}
        </p>
      </section>

      {!isLoading && monthData && monthData.errors.length > 0 && (
        <div className="calendar-error-message" role="alert">
          {monthData.errors.join(' / ')}
        </div>
      )}

      {/* 7-4. 달력 */}
      <section className="surface-card calendar-card" aria-busy={isLoading}>
        <div className="calendar-weekdays">
          {WEEKDAYS.map((weekday, index) => (
            <span
              key={weekday}
              className={index === 0 ? 'is-sunday' : index === 6 ? 'is-saturday' : undefined}
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const dayEvents = day.isCurrentMonth ? eventsByDate.get(day.date) ?? [] : []
            const hiddenCount = dayEvents.length - MAX_VISIBLE_EVENTS

            return (
              <div
                key={day.date}
                className={[
                  'calendar-cell',
                  day.isCurrentMonth ? '' : 'is-outside',
                  day.date === todayDate ? 'is-today' : '',
                  dayEvents.length > 0 ? 'has-events' : '',
                ].join(' ')}
              >
                <div className="calendar-cell-heading">
                  <span
                    className={[
                      'calendar-day-number',
                      day.weekday === 0 ? 'is-sunday' : '',
                      day.weekday === 6 ? 'is-saturday' : '',
                    ].join(' ')}
                  >
                    {day.day}
                  </span>

                  {dayEvents.length > 0 && (
                    <button
                      type="button"
                      className="calendar-day-count"
                      onClick={() => setModalState({ type: 'day', date: day.date })}
                      aria-label={`${formatKoreanDate(day.date)} 교육 ${dayEvents.length}건 보기`}
                    >
                      {dayEvents.length}건
                    </button>
                  )}
                </div>

                {dayEvents.length > 0 && (
                  <ul className="calendar-event-list">
                    {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                      <li key={event.key}>
                        <button
                          type="button"
                          className="calendar-event"
                          onClick={() => setModalState({ type: 'event', event, fromDate: null })}
                          title={[event.title, event.subtitle, event.time].filter(Boolean).join(' · ')}
                        >
                          <span className={`calendar-dot calendar-business-${event.business.toLowerCase()}`} aria-hidden="true" />
                          <span className="calendar-event-text">
                            {event.time && <em>{event.time.split(/[~\-–]/)[0].trim()}</em>}
                            {event.title}
                          </span>
                        </button>
                      </li>
                    ))}

                    {hiddenCount > 0 && (
                      <li>
                        <button
                          type="button"
                          className="calendar-event-more"
                          onClick={() => setModalState({ type: 'day', date: day.date })}
                        >
                          +{hiddenCount}건 더보기
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}
        </div>

        {isLoading && (
          <div className="calendar-loading" role="status">
            {yearMonth.year}년 {yearMonth.month + 1}월 교육 일정을 불러오고 있습니다.
          </div>
        )}

        {!isLoading && visibleEvents.length === 0 && (
          <p className="calendar-empty">
            {yearMonth.month + 1}월에 등록된 교육 일정이 없습니다.
          </p>
        )}

        <footer className="calendar-legend">
          <span><i className="calendar-dot calendar-business-gw" />GW · 강원SW미래채움</span>
          <span><i className="calendar-dot calendar-business-ds" />DS · 디지털새싹</span>
          <span className="calendar-legend-hint">일정을 누르면 상세 정보를 볼 수 있습니다.</span>
        </footer>
      </section>

      {/* 7-5. 상세 / 일자별 목록 모달 */}
      {modalState && (
        <CalendarModal
          state={modalState}
          events={visibleEvents}
          onSelectEvent={(event, fromDate) => setModalState({ type: 'event', event, fromDate })}
          onBack={(date) => setModalState({ type: 'day', date })}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}

export default MonthlyCalendarPage