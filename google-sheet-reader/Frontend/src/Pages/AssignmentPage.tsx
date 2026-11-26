/**
 * @file AssignmentPage.tsx
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 강사 배정 화면 (시트: 2.강사배정)
 *
 * 20261126 수정: 표 → 월별 캘린더 형식으로 변경
 * - 교육일·교육시간·수요처·반·교육과정이 같은 배정을 하나의 일정으로 묶음
 *   (예: 10/07 09:00~10:30 코코아초등학교 5반 A과정 → 학교담당자: 담일일, 주강사: 주육육 ...)
 * - 일정 클릭 시 역할별 배정 인원 상세, 날짜 건수 클릭 시 해당 일자 전체 일정
 * - 이전 달 / 다음 달 / 이번 달 이동 및 연월 직접 선택
 * - 수요처 필터, 성명·수요처·교육과정 검색
 * - "배정 중복 확인" 이 2 이상인 배정이 있는 일정은 빨간 점·경고로 표시
 * - 달력 스타일은 월별 캘린더(MonthlyCalendarPage.css)와 같은 클래스 사용
 */

import { useEffect, useMemo, useState } from 'react'

import { Icon } from '../Components/DashboardUI'
import { useOperationData } from '../Hooks/useOperationData'
import type { SheetRecord } from '../Types/operations'
import {
  formatFetchedAt,
  formatNumber,
  matchesKeyword,
  parseSheetDate,
  toNumber,
  uniqueValues,
} from '../Utils/operationFormat'


// =======================================
// 1. 설정 및 타입
// =======================================
const MAX_VISIBLE_EVENTS = 3 // 달력 칸에 표시할 최대 일정 수
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 상세 화면 역할 표시 순서 (목록에 없는 역할은 뒤에 가나다순)
const ROLE_ORDER = ['학교담당자', '주강사', '보조강사1', '보조강사2', '코디네이터', '기술지원']

type YearMonth = {
  year: number
  month: number // 0 ~ 11
}

type AssignedMember = {
  name: string
  isDuplicate: boolean
  note: string
}

/** 하나의 교육 일정 (같은 교육일·시간·수요처·반·과정의 배정 묶음) */
type Session = {
  key: string
  date: string // YYYY-MM-DD
  time: string
  demand: string
  className: string
  course: string
  roles: { role: string; members: AssignedMember[] }[]
  names: string[]
  hasDuplicate: boolean
}

type ModalState =
  | { type: 'session'; session: Session; fromDate: string | null }
  | { type: 'day'; date: string }

const isDuplicateRow = (row: SheetRecord) => (toNumber(row['배정 중복 확인']) ?? 0) > 1


// =======================================
// 2. 날짜 계산
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

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 일요일 시작 기준 달력 칸 */
function getCalendarDays({ year, month }: YearMonth) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const cursor = new Date(firstDay)
  cursor.setDate(cursor.getDate() - firstDay.getDay())

  const end = new Date(lastDay)
  end.setDate(end.getDate() + (6 - lastDay.getDay()))

  const days: { date: string; day: number; isCurrentMonth: boolean; weekday: number }[] = []

  while (cursor <= end) {
    days.push({
      date: toIsoDate(cursor),
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

/** "09:00~10:30" → 540 (시간 없으면 맨 뒤) */
function getStartMinutes(time: string): number {
  const match = time.match(/(\d{1,2})\s*[:시]\s*(\d{2})?/)
  return match ? Number(match[1]) * 60 + Number(match[2] ?? 0) : Number.MAX_SAFE_INTEGER
}

function getStartTime(time: string): string {
  return time.split(/[~\-–]/)[0].trim()
}


// =======================================
// 3. 배정 → 일정 묶기
// =======================================
function compareRole(first: string, second: string): number {
  const a = ROLE_ORDER.indexOf(first)
  const b = ROLE_ORDER.indexOf(second)

  if (a !== -1 || b !== -1) return (a === -1 ? 99 : a) - (b === -1 ? 99 : b)
  return first.localeCompare(second, 'ko')
}

function groupSessions(records: SheetRecord[]): { sessions: Session[]; undatedCount: number } {
  const groups = new Map<string, { date: string; rows: SheetRecord[] }>()
  let undatedCount = 0

  records.forEach((row) => {
    const date = parseSheetDate(row['교육일'])?.iso

    if (!date) {
      undatedCount += 1
      return
    }

    const key = [date, row['교육시간'], row['수요처명'], row['반명'], row['교육과정명']].map((value) => (value ?? '').trim()).join('|')
    const group = groups.get(key) ?? { date, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  })

  const sessions = Array.from(groups.entries()).map(([key, { date, rows }]): Session => {
    const roleMap = new Map<string, AssignedMember[]>()

    rows.forEach((row) => {
      const role = row['배정 역할']?.trim() || '역할 미지정'
      const members = roleMap.get(role) ?? []

      members.push({
        name: row['성명']?.trim() ?? '',
        isDuplicate: isDuplicateRow(row),
        note: row['비고']?.trim() ?? '',
      })
      roleMap.set(role, members)
    })

    const first = rows[0]

    return {
      key,
      date,
      time: first['교육시간']?.trim() ?? '',
      demand: first['수요처명']?.trim() ?? '',
      className: first['반명']?.trim() ?? '',
      course: first['교육과정명']?.trim() ?? '',
      roles: Array.from(roleMap.entries())
        .sort(([a], [b]) => compareRole(a, b))
        .map(([role, members]) => ({ role, members })),
      names: uniqueValues(rows, (row) => row['성명']),
      hasDuplicate: rows.some(isDuplicateRow),
    }
  })

  sessions.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    getStartMinutes(a.time) - getStartMinutes(b.time) ||
    a.demand.localeCompare(b.demand, 'ko') ||
    a.className.localeCompare(b.className, 'ko'),
  )

  return { sessions, undatedCount }
}

function sessionTitle(session: Session): string {
  return [session.demand, session.className].filter(Boolean).join(' ') || '교육 일정'
}


// =======================================
// 4. 상세 / 일자별 목록 모달
// =======================================
function AssignmentModal({
  state,
  sessions,
  onSelectSession,
  onBack,
  onClose,
}: {
  state: ModalState
  sessions: Session[]
  onSelectSession: (session: Session, fromDate: string) => void
  onBack: (date: string) => void
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isSession = state.type === 'session'
  const dayDate = isSession ? state.session.date : state.date
  const daySessions = sessions.filter((session) => session.date === dayDate)
  const notes = isSession
    ? uniqueValues(state.session.roles.flatMap((role) => role.members), (member) => member.note)
    : []

  return (
    <div
      className="calendar-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title">
        <header className="calendar-modal-header">
          <div>
            <p className="calendar-modal-eyebrow">{isSession ? 'ASSIGNMENT DETAIL' : 'DAILY SCHEDULE'}</p>
            <h2 id="assignment-modal-title">
              {isSession ? sessionTitle(state.session) : formatKoreanDate(state.date)}
            </h2>
            <p>
              {isSession
                ? `${formatKoreanDate(state.session.date)}${state.session.time ? ` · ${state.session.time}` : ''}`
                : `교육 일정 ${daySessions.length}건`}
            </p>
          </div>

          <button type="button" className="calendar-modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className="calendar-modal-body">
          {isSession ? (
            <>
              {state.session.hasDuplicate && (
                <div className="perf-message perf-message-error assignment-modal-alert" role="note">
                  같은 날짜·시간에 중복으로 배정된 인원이 있습니다. (시트의 "배정 중복 확인" 기준)
                </div>
              )}

              <dl className="calendar-detail-grid">
                {[
                  { label: '교육일', value: formatKoreanDate(state.session.date) },
                  { label: '교육시간', value: state.session.time },
                  { label: '수요처명', value: state.session.demand },
                  { label: '반명', value: state.session.className },
                  { label: '교육과정명', value: state.session.course },
                  { label: '배정 인원', value: `${state.session.names.length}명` },
                ].map((field) => (
                  <div key={field.label} className="calendar-detail-field">
                    <dt>{field.label}</dt>
                    <dd>{field.value || '-'}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="assignment-section-title">역할별 배정</h3>
              <dl className="assignment-role-list">
                {state.session.roles.map(({ role, members }) => (
                  <div key={role} className="assignment-role-row">
                    <dt>{role}</dt>
                    <dd>
                      {members.map((member, index) => (
                        <span key={`${member.name}-${index}`} className={member.isDuplicate ? 'is-duplicate' : undefined}>
                          {member.name || '-'}
                          {member.isDuplicate && <small> 중복</small>}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>

              {notes.length > 0 && (
                <>
                  <h3 className="assignment-section-title">비고</h3>
                  <ul className="assignment-note-list">
                    {notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                </>
              )}
            </>
          ) : (
            <ul className="calendar-day-list">
              {daySessions.map((session) => (
                <li key={session.key}>
                  <button
                    type="button"
                    className="calendar-day-list-item"
                    onClick={() => onSelectSession(session, state.date)}
                  >
                    <span className={`calendar-dot ${session.hasDuplicate ? 'assignment-dot-danger' : 'calendar-business-gw'}`} aria-hidden="true" />
                    <span className="calendar-day-list-copy">
                      <strong>{sessionTitle(session)}</strong>
                      <small>{[session.time, session.course, `${session.names.length}명`].filter(Boolean).join(' · ')}</small>
                    </span>
                    <Icon name="chevron" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="calendar-modal-footer">
          {isSession && state.fromDate && (
            <button type="button" className="calendar-modal-secondary" onClick={() => onBack(state.fromDate as string)}>
              ← 일자 목록
            </button>
          )}

          {isSession && !state.fromDate && daySessions.length > 1 && (
            <button type="button" className="calendar-modal-secondary" onClick={() => onBack(state.session.date)}>
              이 날짜 전체 일정 ({daySessions.length}건)
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
// 5. 화면
// =======================================
function AssignmentPage() {
  const { result, data, error, isLoading, reload } = useOperationData('assignment')

  const [yearMonth, setYearMonth] = useState<YearMonth>(getCurrentYearMonth)
  const [demandFilter, setDemandFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [modalState, setModalState] = useState<ModalState | null>(null)

  const { sessions: allSessions, undatedCount } = useMemo(
    () => groupSessions(data?.records ?? []),
    [data],
  )

  const demandOptions = useMemo(() => uniqueValues(allSessions, (session) => session.demand), [allSessions])

  // 수요처 필터 / 검색 (성명은 묶인 인원 중 한 명이라도 맞으면 표시)
  const filteredSessions = useMemo(() => allSessions.filter((session) =>
    (!demandFilter || session.demand === demandFilter) &&
    matchesKeyword([session.demand, session.className, session.course, ...session.names], keyword),
  ), [allSessions, demandFilter, keyword])

  const monthValue = toMonthValue(yearMonth)
  const monthSessions = useMemo(
    () => filteredSessions.filter((session) => session.date.startsWith(monthValue)),
    [filteredSessions, monthValue],
  )

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, Session[]>()

    monthSessions.forEach((session) => {
      const list = grouped.get(session.date) ?? []
      list.push(session)
      grouped.set(session.date, list)
    })

    return grouped
  }, [monthSessions])

  const calendarDays = useMemo(() => getCalendarDays(yearMonth), [yearMonth])
  const todayDate = toIsoDate(new Date())
  const isCurrentMonth = monthValue === toMonthValue(getCurrentYearMonth())

  const memberCount = uniqueValues(monthSessions.flatMap((session) => session.names), (name) => name).length
  const duplicateCount = monthSessions.filter((session) => session.hasDuplicate).length

  // 배정이 있는 월 (다른 달 바로가기 안내용)
  const assignedMonths = useMemo(
    () => uniqueValues(filteredSessions, (session) => session.date.slice(0, 7)),
    [filteredSessions],
  )

  const moveMonth = (offset: number) => {
    setYearMonth((current) => shiftMonth(current, offset))
    setModalState(null)
  }

  const goToMonth = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})$/)
    if (!match) return

    setYearMonth({ year: Number(match[1]), month: Number(match[2]) - 1 })
    setModalState(null)
  }

  return (
    <div className="page-content monthly-calendar-page">
      {/* 5-1. 페이지 제목 */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">ASSIGNMENT</p>
          <h1>강사 배정</h1>
          <p className="page-subtitle">
            교육 일정별 배정 인원을 달력으로 확인하고, 일정을 눌러 역할별 배정 상세를 조회합니다.
            {result?.sheetName && <span className="ops-sheet-name"> · 시트: {result.sheetName}</span>}
          </p>
        </div>

        <button
          className="refresh-button"
          type="button"
          onClick={reload}
          disabled={isLoading}
          title="강사 배정 시트를 다시 조회합니다."
        >
          <Icon name="refresh" size={16} />
          {isLoading ? '조회 중...' : '새로고침'}
        </button>
      </section>

      {/* 5-2. 월 선택 및 필터 */}
      <section className="surface-card calendar-toolbar">
        <div className="calendar-month-nav">
          <button type="button" className="calendar-nav-button" onClick={() => moveMonth(-1)} aria-label="이전 달">
            <span className="calendar-chevron-left">
              <Icon name="chevron" size={16} />
            </span>
          </button>

          <h2 className="calendar-month-title">
            {yearMonth.year}년 {yearMonth.month + 1}월
          </h2>

          <button type="button" className="calendar-nav-button" onClick={() => moveMonth(1)} aria-label="다음 달">
            <Icon name="chevron" size={16} />
          </button>

          <button
            type="button"
            className="calendar-today-button"
            onClick={() => goToMonth(toMonthValue(getCurrentYearMonth()))}
            disabled={isCurrentMonth}
          >
            이번 달
          </button>
        </div>

        <div className="calendar-toolbar-controls">
          <label>
            <span>수요처</span>
            <select value={demandFilter} onChange={(event) => setDemandFilter(event.target.value)}>
              <option value="">전체</option>
              {demandOptions.map((demand) => <option key={demand} value={demand}>{demand}</option>)}
            </select>
          </label>

          <label>
            <span>검색</span>
            <input
              type="search"
              value={keyword}
              placeholder="성명, 수요처, 교육과정"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>

          <label>
            <span>연월 선택</span>
            <input type="month" value={monthValue} onChange={(event) => goToMonth(event.target.value)} />
          </label>
        </div>
      </section>

      {/* 5-3. 월간 요약 */}
      <section className="calendar-summary" aria-label="월간 배정 요약">
        <div>
          <span>
            <i className="calendar-dot calendar-business-gw" />
            이번 달 교육 일정
          </span>
          <strong>{isLoading && !data ? '조회 중' : `${formatNumber(monthSessions.length)}건`}</strong>
        </div>
        <div>
          <span>교육 진행일</span>
          <strong>{isLoading && !data ? '-' : `${sessionsByDate.size}일`}</strong>
        </div>
        <div>
          <span>배정 인원</span>
          <strong>{isLoading && !data ? '-' : `${formatNumber(memberCount)}명`}</strong>
        </div>
        {duplicateCount > 0 && (
          <div className="assignment-summary-danger">
            <span>
              <i className="calendar-dot assignment-dot-danger" />
              중복 배정 의심
            </span>
            <strong>{formatNumber(duplicateCount)}건</strong>
          </div>
        )}
        <p className="calendar-summary-updated">
          {result?.fetchedAt ? `${formatFetchedAt(result.fetchedAt)} 기준 데이터` : ''}
        </p>
      </section>

      {error && !isLoading && (
        <div className="calendar-error-message" role="alert">{error}</div>
      )}

      {undatedCount > 0 && (
        <div className="perf-message perf-message-warning assignment-message" role="note">
          교육일을 날짜로 읽을 수 없는 배정 {formatNumber(undatedCount)}건은 달력에 표시하지 않았습니다.
        </div>
      )}

      {/* 5-4. 달력 */}
      <section className="surface-card calendar-card" aria-busy={isLoading}>
        <div className="calendar-weekdays">
          {WEEKDAYS.map((weekday, index) => (
            <span key={weekday} className={index === 0 ? 'is-sunday' : index === 6 ? 'is-saturday' : undefined}>
              {weekday}
            </span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day) => {
            const daySessions = day.isCurrentMonth ? sessionsByDate.get(day.date) ?? [] : []
            const hiddenCount = daySessions.length - MAX_VISIBLE_EVENTS

            return (
              <div
                key={day.date}
                className={[
                  'calendar-cell',
                  day.isCurrentMonth ? '' : 'is-outside',
                  day.date === todayDate ? 'is-today' : '',
                  daySessions.length > 0 ? 'has-events' : '',
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

                  {daySessions.length > 0 && (
                    <button
                      type="button"
                      className="calendar-day-count"
                      onClick={() => setModalState({ type: 'day', date: day.date })}
                      aria-label={`${formatKoreanDate(day.date)} 교육 ${daySessions.length}건 보기`}
                    >
                      {daySessions.length}건
                    </button>
                  )}
                </div>

                {daySessions.length > 0 && (
                  <ul className="calendar-event-list">
                    {daySessions.slice(0, MAX_VISIBLE_EVENTS).map((session) => (
                      <li key={session.key}>
                        <button
                          type="button"
                          className="calendar-event"
                          onClick={() => setModalState({ type: 'session', session, fromDate: null })}
                          title={[sessionTitle(session), session.course, session.time, `${session.names.length}명`].filter(Boolean).join(' · ')}
                        >
                          <span
                            className={`calendar-dot ${session.hasDuplicate ? 'assignment-dot-danger' : 'calendar-business-gw'}`}
                            aria-hidden="true"
                          />
                          <span className="calendar-event-text">
                            {session.time && <em>{getStartTime(session.time)}</em>}
                            {sessionTitle(session)}
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

        {isLoading && !data && (
          <div className="calendar-loading" role="status">강사 배정을 불러오고 있습니다.</div>
        )}

        {data && monthSessions.length === 0 && (
          <p className="calendar-empty">
            {yearMonth.month + 1}월에 배정된 교육 일정이 없습니다.
            {assignedMonths.length > 0 && (
              <>
                {' '}배정이 있는 달:{' '}
                {assignedMonths.map((month, index) => (
                  <span key={month}>
                    {index > 0 && ', '}
                    <button type="button" className="assignment-month-link" onClick={() => goToMonth(month)}>
                      {Number(month.slice(0, 4))}년 {Number(month.slice(5, 7))}월
                    </button>
                  </span>
                ))}
              </>
            )}
          </p>
        )}

        <footer className="calendar-legend">
          <span>
            <i className="calendar-dot calendar-business-gw" />
            교육 일정 (같은 날짜·시간·수요처·반·과정의 배정을 하나로 묶음)
          </span>
          <span>
            <i className="calendar-dot assignment-dot-danger" />
            중복 배정 의심
          </span>
          <span className="calendar-legend-hint">일정을 누르면 역할별 배정 인원을 볼 수 있습니다.</span>
        </footer>
      </section>

      {modalState && (
        <AssignmentModal
          state={modalState}
          sessions={monthSessions}
          onSelectSession={(session, fromDate) => setModalState({ type: 'session', session, fromDate })}
          onBack={(date) => setModalState({ type: 'day', date })}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}

export default AssignmentPage
