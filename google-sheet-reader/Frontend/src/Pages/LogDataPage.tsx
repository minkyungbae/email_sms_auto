/**
 * @file LogDataPage.tsx
 * @author 배민경
 * @created 2026-11-19
 * @updated 2026-11-25
 * @description
 * 문자 및 이메일 발송 로그 조회 화면
 *
 * 주요 기능:
 * - 발송 로그 전체 조회
 * - 발송 기간 / 상태 / 키워드 필터
 * - 조회 결과 페이지네이션
 * - 발송 로그 상세 내용 확인
 * - 발송 결과 통계 확인
 *
 * 20261120 수정:
 * - API 요청과 상태 업데이트 로직 분리
 * - useEffect 내부 setState ESLint 오류 개선
 * - 중복 API 요청 및 오래된 응답 처리 방지
 * - 조회 오류와 검색 조건 오류 상태 분리
 * 
 * 20261123 추가:
 * - 발송 이력 정렬 옵션 추가 및 정렬 후 페이지네이션 적용
 * - 한국어 오전/오후 형식의 발송일시 정렬 지원
 * 
 * 20261124 추가:
 * - 수동 발송 확인 체크박스 및 저장 API 연결
 * - 수정 중인 로그의 중복 요청 방지
 * - 발송 자동화 서비스 추가 및 버튼 추가
 * - 웹에서 발송 기준일 변경 기능 추가
 *
 * 20261125 추가:
 * - 문자 및 이메일 개별 발송 기능 (새 메시지 작성 / 수신자 직접 입력)
 * - 발송 이력에서 특정 수신자를 선택하여 문자·이메일 개별 발송
 * - 발송 전 수신자별 문자·이메일 제목 및 본문 수정
 * - 상세 보기에서 해당 수신자에게 바로 발송
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getLogs, updateManualConfirmation, } from '../Services/LogService'
import type { LogRecord } from '../Services/LogService'
import '../CSS/LogDataPage.css'

// 20261124 추가: 발송 자동화 서비스
import {
  getDispatchSettings,
  updateDispatchSettings, // 20261124 추가: 발송 기준일 저장
  startDispatch,
  getDispatchStatus,
  startManualSend, // 20261125 추가: 개별 발송
  getManualSendStatus, // 20261125 추가: 개별 발송 상태 조회
} from '../Services/DispatchService'

import type {
  DispatchSettings,
  ManualSendJobResult,
  ManualSendMessage,
} from '../Services/DispatchService'

// 20261125 추가: 문자·이메일 개별 발송 작성 모달
import MessageComposeModal from '../Components/MessageComposeModal'
import {
  MESSAGE_LIMITS,
  createDraftFromRecord,
  createEmptyDraft,
} from '../Utils/messageDraft'
import type { MessageDraft } from '../Utils/messageDraft'

// =======================================
// 1. 발송 로그 화면 기본 설정 및 타입
// =======================================
const PAGE_SIZE = 10
const TABLE_COLUMN_COUNT = 10 // 20261125 수정: 선택 열 추가

type StatusFilter = 'ALL' | 'SUCCESS' | 'FAILURE' | 'TEST' | 'SKIPPED'
type StatusCategory = Exclude<StatusFilter, 'ALL'> | 'UNKNOWN'

// 20261123 추가: 발송 이력 정렬 기준 타입
type LogSortOption =
  | 'DATE_DESC'
  | 'DATE_ASC'
  | 'RECIPIENT_ASC'
  | 'INSTITUTION_ASC'
  | 'STATUS'

// =======================================
// 2. 발송 로그 데이터 처리 함수
// =======================================
/** 발송 상태를 기준으로 전체 상태 분류 */
function getStatusCategory(record: LogRecord): StatusCategory {
  const statuses = [record.문자발송상태, record.이메일발송상태]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)

  if (statuses.length === 0) return 'UNKNOWN'
  if (statuses.some((value) => value.includes('실패'))) return 'FAILURE'
  if (statuses.some((value) => value.includes('스킵'))) return 'SKIPPED'
  if (statuses.some((value) => value.includes('테스트'))) return 'TEST'

  return 'SUCCESS'
}

/** 발송 채널 표시 */
function getChannelLabel(record: LogRecord): string {
  const hasSms = Boolean(record.문자발송상태)
  const hasEmail = Boolean(record.이메일발송상태)

  if (hasSms && hasEmail) return '문자 + 이메일'
  if (hasSms) return '문자'
  if (hasEmail) return '이메일'

  return '-'
}

/** 개별 문자 및 이메일 상태에 따른 CSS 클래스 반환 */
function getIndividualStatusClass(value: string): string {
  if (value.includes('실패')) return 'failure'
  if (value.includes('스킵')) return 'skipped'
  if (value.includes('테스트')) return 'test'

  return 'success'
}

// 20261124 추가: Apps Script/Google Sheets에서 반환하는 확인 값을 Boolean으로 정규화
function isManualConfirmed(value: string): boolean {
  return ['true', '1', 'yes', '확인'].includes(
    String(value || '').trim().toLocaleLowerCase(),
  )
}

/** 발송일시에서 YYYY-MM-DD 형식의 날짜 추출 */
function getLogDate(value: string): string {
  const match = String(value || '').match(
    /^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})/,
  )

  if (!match) return ''

  const [, year, month, day] = match

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}


// 20261123 추가: ISO 및 구글 시트의 한국어 오전/오후 날짜 형식 정렬 지원
function getLogTimestamp(value: string): number | null {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) return null

  const parsedTimestamp = Date.parse(normalizedValue)

  if (!Number.isNaN(parsedTimestamp)) return parsedTimestamp

  const match = normalizedValue.match(
    /^(\d{4})[-./]\s*(\d{1,2})[-./]\s*(\d{1,2})\.?\s*(오전|오후)?\s*(\d{1,2})?(?::(\d{2}))?(?::(\d{2}))?/,
  )

  if (!match) return null

  const [, year, month, day, meridiem, hour = '0', minute = '0', second = '0'] = match
  let hours = Number(hour)

  if (meridiem === '오전' && hours === 12) hours = 0
  if (meridiem === '오후' && hours !== 12) hours += 12

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours,
    Number(minute),
    Number(second),
  ).getTime()
}

// 20261123 추가: 날짜 정렬 시 발송일시가 없는 로그는 항상 아래에 배치
function compareLogDate(
  firstRecord: LogRecord,
  secondRecord: LogRecord,
  order: 'ASC' | 'DESC',
): number {
  const firstTimestamp = getLogTimestamp(firstRecord.발송일시)
  const secondTimestamp = getLogTimestamp(secondRecord.발송일시)

  if (firstTimestamp === null && secondTimestamp === null) return 0
  if (firstTimestamp === null) return 1
  if (secondTimestamp === null) return -1

  return order === 'ASC'
    ? firstTimestamp - secondTimestamp
    : secondTimestamp - firstTimestamp
}

// 20261123 추가: 한글 텍스트 정렬 시 빈 값은 마지막에 배치
function compareLogText(firstValue = '', secondValue = ''): number {
  const firstText = firstValue.trim()
  const secondText = secondValue.trim()

  if (!firstText && !secondText) return 0
  if (!firstText) return 1
  if (!secondText) return -1

  return firstText.localeCompare(secondText, 'ko')
}

// 20261123 추가: 상태 정렬 우선순위(실패 → 스킵 → 테스트 → 성공 → 미분류)
function getStatusSortOrder(record: LogRecord): number {
  const statusOrder: Record<StatusCategory, number> = {
    FAILURE: 1,
    SKIPPED: 2,
    TEST: 3,
    SUCCESS: 4,
    UNKNOWN: 5,
  }

  return statusOrder[getStatusCategory(record)]
}


/** 발송일시 표시 형식 정리 */
function formatDateTime(value: string): string {
  if (!value) return '-'

  return value.replace('T', ' ')
}

/** 숫자에 천 단위 콤마 적용 */
function formatCount(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value)
}

/**  현재 조회 시간 반환 */
function getCurrentTime(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
}

/**  API 조회 오류 메시지 반환 */
function getErrorMessage(loadError: unknown): string {
  return loadError instanceof Error
    ? loadError.message
    : '발송 로그 조회에 실패했습니다.'
}

// =======================================
// 3. 발송 로그 상세 정보 필드 컴포넌트
// =======================================
function DetailField({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  return (
    <div className="log-detail-field">
      <dt>{label}</dt>
      <dd>{value?.trim() || '-'}</dd>
    </div>
  )
}

// =======================================
// 4. 발송 로그 상세 모달 컴포넌트
// =======================================
function LogDetailModal({
  record,
  onClose,
  onCompose, // 20261125 추가: 해당 수신자에게 개별 발송
  isComposeDisabled,
}: {
  record: LogRecord
  onClose: () => void
  onCompose: (record: LogRecord) => void
  isComposeDisabled: boolean
}) {
  return (
    <div
      className="log-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="log-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-detail-title"
      >
        <header className="log-detail-modal-header">
          <div>
            <p className="log-detail-eyebrow">DISPATCH DETAIL</p>
            <h2 id="log-detail-title">발송 로그 상세 정보</h2>
            <p>{record.ID}</p>
          </div>

          <button
            type="button"
            className="log-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="log-detail-modal-body">
          <section className="log-detail-section">
            <h3>발송 정보</h3>

            <dl className="log-detail-grid">
              <DetailField label="발송일시" value={record.발송일시} />
              <DetailField label="발송 채널" value={getChannelLabel(record)} />
              <DetailField label="문자 발송 상태" value={record.문자발송상태} />
              <DetailField label="이메일 발송 상태" value={record.이메일발송상태} />
              {/* 20261124 추가: 수동 발송 확인 정보 */}
              <DetailField
                label="수동 발송 확인"
                value={
                  isManualConfirmed(record.수동발송확인)
                    ? '확인 완료'
                    : '미확인'
                }
              />
              <DetailField
                label="수동 확인 일시"
                value={record.수동확인일시}
              />
              <DetailField label="발송인" value={record.발송인} />
              <DetailField label="발송 연락처" value={record.발송연락처} />
              <DetailField label="발송 이메일" value={record.발송이메일} />
              <DetailField label="제목" value={record.제목} />
            </dl>
          </section>

          <section className="log-detail-section">
            <h3>수신 대상</h3>

            <dl className="log-detail-grid">
              <DetailField label="성명" value={record.성명 || record.수신인} />
              <DetailField label="역할" value={record.역할} />
              <DetailField label="소속기관명" value={record.소속기관명} />
              <DetailField label="연락처" value={record.연락처} />
              <DetailField label="이메일" value={record.이메일} />
              <DetailField label="실제 수신 연락처" value={record.실제수신연락처} />
              <DetailField label="실제 수신 이메일" value={record.실제수신이메일} />
            </dl>
          </section>

          <section className="log-detail-section">
            <h3>교육 정보</h3>

            <dl className="log-detail-grid">
              <DetailField label="교육과정명" value={record.교육과정명} />
              <DetailField label="교육기관명" value={record.교육기관명} />
              <DetailField label="반명" value={record.반명} />
              <DetailField label="교육일" value={record.교육일} />
              <DetailField label="요일" value={record.요일} />
              <DetailField label="교육시간" value={record.교육시간} />
              <DetailField label="차시" value={record.차시} />
              <DetailField label="No." value={record['No.']} />
            </dl>
          </section>

          <section className="log-detail-section">
            <h3>문자 본문</h3>

            <pre className="log-message-body">
              {record.문자본문내용 || '문자 본문이 없습니다.'}
            </pre>
          </section>

          <section className="log-detail-section">
            <h3>이메일 본문</h3>

            <pre className="log-message-body">
              {record.이메일본문내용 || '이메일 본문이 없습니다.'}
            </pre>
          </section>
        </div>

        <footer className="log-detail-modal-footer compose-detail-footer">
          {/* 20261125 추가: 기존 내용을 수정하여 해당 수신자에게 발송 */}
          <button
            type="button"
            className="log-reset-button compose-cancel-button"
            onClick={() => onCompose(record)}
            disabled={isComposeDisabled}
          >
            이 수신자에게 발송
          </button>

          <button
            type="button"
            className="log-modal-confirm"
            onClick={onClose}
          >
            닫기
          </button>
        </footer>
      </section>
    </div>
  )
}

// =======================================
// 5. 발송 로그 페이지 컴포넌트
// =======================================
function LogDataPage() {
  // ---------------------------------------
  // 5-1. 발송 로그 데이터 및 화면 상태
  // ---------------------------------------
  const [logs, setLogs] = useState<LogRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [updateMessage, setUpdateMessage] = useState('') // 20261124 추가: 수동 확인 상태 저장 메시지

  // 20261124 추가: 수동 확인 상태 저장 중인 로그 ID 관리
  const [updatingLogIds, setUpdatingLogIds] = useState<Set<string>>(
    new Set(),
  )

  // 20261124 추가: 발송 자동화 실행 상태
  const [isDispatching, setIsDispatching] = useState(false)   // 현재 발송 진행 여부
  const [dispatchMessage, setDispatchMessage] = useState('') // 발송 진행 및 완료 메시지
  const [dispatchError, setDispatchError] = useState('')    // 발송 실패 메시지

  // 20261124 추가: 발송 기준일 설정 조회 및 수정 상태
  const [dispatchSettings, setDispatchSettings] = useState<DispatchSettings | null>(null)
  const [daysBeforeInput, setDaysBeforeInput] = useState('')
  const [isLoadingDispatchSettings, setIsLoadingDispatchSettings] = useState(true)
  const [isSavingDispatchSettings, setIsSavingDispatchSettings] = useState(false)
  const [dispatchSettingsMessage, setDispatchSettingsMessage] = useState('')
  const [dispatchSettingsError, setDispatchSettingsError] = useState('')


  // ---------------------------------------
  // 5-2. 검색 및 페이지네이션 상태
  // ---------------------------------------
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')

  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')

  const [currentPage, setCurrentPage] = useState(1)

  // 20261123 추가: 발송 이력 정렬 기준(기본값: 최신 발송순)
  const [sortOption, setSortOption] = useState<LogSortOption>('DATE_DESC')

  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null)

  // 20261125 추가: 개별 발송 수신자 선택 및 작성 모달 상태
  const [checkedLogIds, setCheckedLogIds] = useState<Set<string>>(new Set())
  const [composeDrafts, setComposeDrafts] = useState<MessageDraft[] | null>(null)
  const [isManualSending, setIsManualSending] = useState(false)

  // ---------------------------------------
  // 5-3. API 요청 중복 및 응답 순서 관리
  // ---------------------------------------
  const requestSequenceRef = useRef(0)

  /**
   * API 요청만 수행하는 함수
   *
   * 중요:
   * - 내부에서 setState를 실행하지 않음
   * - useEffect와 새로고침 이벤트에서 공통 사용
   */
  const fetchLogs = useCallback((): Promise<LogRecord[]> => {
    return getLogs()
  }, [])

  // ---------------------------------------
  // 5-4. 최초 발송 로그 조회
  // ---------------------------------------
  useEffect(() => {
    let isActive = true

    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId

    fetchLogs()
      .then((result) => {
        if (!isActive || requestId !== requestSequenceRef.current) return

        setLogs(result)
        setError('')
        setLastUpdated(getCurrentTime())
      })
      .catch((loadError: unknown) => {
        if (!isActive || requestId !== requestSequenceRef.current) return

        setError(getErrorMessage(loadError))
      })
      .finally(() => {
        if (!isActive || requestId !== requestSequenceRef.current) return

        setIsLoading(false)
      })

    return () => {
      isActive = false
      requestSequenceRef.current += 1
    }
  }, [fetchLogs])

  // =======================================
  // 5-4-1. 발송 기준일 설정 최초 조회
  // 20261124 추가
  // =======================================
  useEffect(() => {
    let isActive = true

    getDispatchSettings()
      .then((settings) => {
        if (!isActive) return

        setDispatchSettings(settings)
        setDaysBeforeInput(String(settings.daysBefore))
        setDispatchSettingsError('')
      })
      .catch((loadError: unknown) => {
        if (!isActive) return

        setDispatchSettingsError(getErrorMessage(loadError))
      })
      .finally(() => {
        if (!isActive) return
        setIsLoadingDispatchSettings(false)
      })

    return () => {
      isActive = false
    }
  }, [])


  // ---------------------------------------
  // 5-5. 발송 로그 새로고침
  // ---------------------------------------
  const handleRefresh = async () => {
    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId

    setIsLoading(true)
    setError('')
    setValidationError('')

    try {
      const result = await fetchLogs()

      if (requestId !== requestSequenceRef.current) return

      setLogs(result)
      setLastUpdated(getCurrentTime())
      setCurrentPage(1)
    } catch (loadError: unknown) {
      if (requestId !== requestSequenceRef.current) return

      setError(getErrorMessage(loadError))
    } finally {
      if (requestId === requestSequenceRef.current) {
        setIsLoading(false)
      }
    }
  }


  // =======================================
  // 5-5-1. 발송 기준일 설정 저장
  // 20261124 추가
  // =======================================
  const handleSaveDispatchSettings = async () => {
    if (isSavingDispatchSettings || isDispatching) return

    const daysBefore = Number(daysBeforeInput)

    // 입력값 검증
    if (
      daysBeforeInput.trim() === '' ||
      !Number.isInteger(daysBefore) ||
      daysBefore < 0
    ) {
      setDispatchSettingsError('발송 기준일은 0 이상의 정수로 입력해 주세요.')
      setDispatchSettingsMessage('')
      return
    }

    setIsSavingDispatchSettings(true)
    setDispatchSettingsError('')
    setDispatchSettingsMessage('발송 기준일 설정을 저장하고 있습니다...')

    try {
      const updatedSettings = await updateDispatchSettings(daysBefore)

      setDispatchSettings(updatedSettings)
      setDaysBeforeInput(String(updatedSettings.daysBefore))

      setDispatchSettingsMessage(
        `발송 기준이 수업일 ${updatedSettings.daysBefore}일 전으로 저장되었습니다. 조회 대상 교육일: ${updatedSettings.targetDate}`,
      )

    } catch (saveError) {
      setDispatchSettingsMessage('')
      setDispatchSettingsError(getErrorMessage(saveError))

    } finally {
      setIsSavingDispatchSettings(false)
    }
  }


  // =======================================
  // 5-6. 발송 자동화 실행
  // 20261119 추가: Dashboard.tsx에서 이동
  // 20261124 수정: 발송 로그 페이지에서 실행 및 완료 후 로그 새로고침
  // =======================================
  const handleStartDispatch = async () => {
    if (isDispatching || isSavingDispatchSettings) {
      return
    }

    setIsDispatching(true)
    setDispatchMessage('발송 설정을 확인하고 있습니다...')
    setDispatchError('')

    try {
      // ---------------------------------------
      // 5-6-1. 최신 발송 설정 조회
      // ---------------------------------------
      const settings = await getDispatchSettings()

      // ---------------------------------------
      // 5-6-2. 테스트 설정 확인 문구 생성
      // ---------------------------------------
      const modeSummary = [
        `이메일 미리보기: ${settings.modes.emailPreviewMode ? 'ON' : 'OFF'}`,
        `이메일 테스트 수신자: ${settings.modes.emailTestRecipientMode ? 'ON' : 'OFF'}`,
        `SMS 테스트 수신번호: ${settings.modes.smsTestRecipientMode ? 'ON' : 'OFF'}`,
        `뿌리오 API 테스트: ${settings.modes.smsApiTestMode ? 'ON' : 'OFF'}`,
      ].join('\n')

      // ---------------------------------------
      // 5-6-3. 최종 발송 확인
      // ---------------------------------------
      const confirmed = window.confirm(
        [
          '아래 설정으로 발송 자동화를 실행할까요?',
          '',
          `실행 사업: ${settings.businessTypes.join(', ')}`,
          `발송 기준: 수업일 ${settings.daysBefore}일 전`,
          `조회 대상 교육일: ${settings.targetDate}`,
          '',
          '[발송 설정]',
          modeSummary,
          '',
          '주의: 설정에 따라 실제 이메일 및 문자가 발송될 수 있습니다.',
        ].join('\n'),
      )

      if (!confirmed) {
        setDispatchMessage('발송 실행이 취소되었습니다.')
        return
      }

      // ---------------------------------------
      // 5-6-4. 발송 실행 요청
      // ---------------------------------------
      const jobId = await startDispatch(settings.targetDate)

      setDispatchMessage('발송 자동화가 시작되었습니다.')

      // ---------------------------------------
      // 5-6-5. 발송 작업 상태 조회
      // ---------------------------------------
      let job = await getDispatchStatus(jobId)

      while (job.status === 'queued' || job.status === 'running') {
        setDispatchMessage(
          job.status === 'queued'
            ? '발송 작업을 준비하고 있습니다.'
            : '이메일 및 문자 발송을 진행하고 있습니다.',
        )

        // 20261119 추가: 1.5초 간격으로 상태 조회
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1500)
        })

        job = await getDispatchStatus(jobId)
      }

      // ---------------------------------------
      // 5-6-6. 발송 실패 처리
      // ---------------------------------------
      if (job.status === 'failed') {
        throw new Error(job.error || '발송 자동화에 실패했습니다.')
      }

      // ---------------------------------------
      // 5-6-7. 발송 완료 및 로그 새로고침
      // ---------------------------------------
      setDispatchMessage(
        `발송 자동화 완료 · 로그 ${job.result?.logCount ?? 0}건 기록`,
      )

      // 20261124 추가: 발송 완료 후 최신 로그 자동 조회
      await handleRefresh()

    } catch (error) {
      setDispatchError(
        error instanceof Error
          ? error.message
          : '발송 자동화 중 알 수 없는 오류가 발생했습니다.',
      )
      setDispatchMessage('')

    } finally {
      setIsDispatching(false)
    }
  }


  // =======================================
  // 5-7. 수동 발송 확인 상태 수정
  // 20261124 추가
  // =======================================
  const handleManualConfirmationChange = async (
    record: LogRecord,
    confirmed: boolean,
  ) => {
    const logId = record.ID.trim()

    if (!logId) {
      setError('로그 ID가 없어 수동 확인 상태를 변경할 수 없습니다.')
      return
    }

    setUpdatingLogIds((current) => new Set(current).add(logId))
    setError('')
    setUpdateMessage('')

    try {
      // Apps Script 저장 성공 응답을 받은 뒤에만 화면 상태 변경
      const updatedRecord = await updateManualConfirmation(
        logId,
        confirmed,
      )

      // 전체 로그 목록에 수정 내용 반영
      const applyUpdate = (currentRecord: LogRecord): LogRecord =>
        currentRecord.ID === logId
          ? { ...currentRecord, ...updatedRecord }
          : currentRecord

      setLogs((currentLogs) => currentLogs.map(applyUpdate))

      // 상세 모달이 열려 있는 경우에도 상태 반영
      setSelectedLog((currentRecord) =>
        currentRecord ? applyUpdate(currentRecord) : null,
      )

      setUpdateMessage(
        confirmed
          ? `${record.성명 || record.수신인 || '해당 로그'}의 수동 발송 확인을 저장했습니다.`
          : `${record.성명 || record.수신인 || '해당 로그'}의 수동 발송 확인을 해제했습니다.`,
      )

    } catch (updateError: unknown) {

      // 저장 실패 시 기존 로그 상태는 변경하지 않음
      setError(getErrorMessage(updateError))

    } finally {

      // 해당 로그의 저장 중 상태 해제
      setUpdatingLogIds((current) => {
        const next = new Set(current)
        next.delete(logId)
        return next
      })
    }
  }


  // =======================================
  // 5-8. 문자·이메일 개별 발송
  // 20261125 추가
  // =======================================

  /** 작성 모달 열기 (선택 수신자 / 상세 보기 / 직접 입력 공통) */
  const openCompose = (records: LogRecord[]) => {
    if (records.length > MESSAGE_LIMITS.MAX_RECIPIENTS) {
      setError(
        `한 번에 최대 ${MESSAGE_LIMITS.MAX_RECIPIENTS}명까지 발송할 수 있습니다. 선택 인원을 줄여 주세요.`,
      )
      return
    }

    setError('')
    setUpdateMessage('')
    setComposeDrafts(
      records.length > 0
        ? records.map(createDraftFromRecord)
        : [createEmptyDraft()],
    )

    // 테스트 설정 안내를 위해 최신 발송 설정 조회 (실패해도 작성은 계속 가능)
    getDispatchSettings()
      .then((settings) => setDispatchSettings(settings))
      .catch(() => undefined)
  }

  /** 개별 발송 요청 → 작업 상태 확인 → 완료 후 로그 새로고침 */
  const handleManualSend = async (
    messages: ManualSendMessage[],
    onProgress: (message: string) => void,
  ): Promise<ManualSendJobResult> => {
    setIsManualSending(true)

    try {
      const jobId = await startManualSend(messages)

      let job = await getManualSendStatus(jobId)

      while (job.status === 'queued' || job.status === 'running') {
        onProgress(
          job.status === 'queued'
            ? '개별 발송 작업을 준비하고 있습니다...'
            : `${messages.length}명에게 문자 및 이메일을 발송하고 있습니다...`,
        )

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1500)
        })

        job = await getManualSendStatus(jobId)
      }

      if (job.status === 'failed' || !job.result) {
        throw new Error(job.error || '개별 발송에 실패했습니다.')
      }

      // 발송 완료 후 선택 해제 및 최신 로그 조회
      setCheckedLogIds(new Set())
      onProgress('발송 로그를 새로고침하고 있습니다...')
      await handleRefresh()

      return job.result
    } finally {
      setIsManualSending(false)
    }
  }

  /** 발송 이력 수신자 선택 / 해제 */
  const toggleLogChecked = (logId: string, checked: boolean) => {
    if (!logId) return

    setCheckedLogIds((current) => {
      const next = new Set(current)

      if (checked) next.add(logId)
      else next.delete(logId)

      return next
    })
  }

  const checkedLogs = logs.filter((record) => checkedLogIds.has(record.ID))


  // =======================================
  // 6. 발송 로그 검색 및 필터링
  // =======================================
  const filteredLogs = useMemo(() => {
    const normalizedKeyword = appliedKeyword.trim().toLocaleLowerCase()

    return logs.filter((record) => {
      const logDate = getLogDate(record.발송일시)

      // -------------------------------------
      // 6-1. 발송 기간 필터
      // -------------------------------------
      if (startDate && (!logDate || logDate < startDate)) {
        return false
      }

      if (endDate && (!logDate || logDate > endDate)) {
        return false
      }

      // -------------------------------------
      // 6-2. 발송 상태 필터
      // -------------------------------------
      if (
        statusFilter !== 'ALL' &&
        getStatusCategory(record) !== statusFilter
      ) {
        return false
      }

      // -------------------------------------
      // 6-3. 키워드 검색
      // -------------------------------------
      if (normalizedKeyword) {
        const searchableText = [
          record.성명,
          record.수신인,
          record.연락처,
          record.이메일,
          record.실제수신연락처,
          record.실제수신이메일,
          record.역할,
          record.교육과정명,
          record.교육기관명,
          record.반명,
          record.제목,
          record.문자발송상태,
          record.이메일발송상태,
        ]
          .join(' ')
          .toLocaleLowerCase()

        if (!searchableText.includes(normalizedKeyword)) {
          return false
        }
      }
      return true
    })
  }, [logs, startDate, endDate, statusFilter, appliedKeyword])


  // =======================================
  // 20261123 추가: 발송 로그 정렬
  // =======================================
  const sortedLogs = useMemo(() => {
    const sortableLogs = [...filteredLogs]

    sortableLogs.sort((firstRecord, secondRecord) => {
      switch (sortOption) {
        // 오래된 발송순
        case 'DATE_ASC':
          return compareLogDate(firstRecord, secondRecord, 'ASC')

        // 수신인 가나다순
        case 'RECIPIENT_ASC': {
          const recipientCompare = compareLogText(
            firstRecord.성명 || firstRecord.수신인 || '',
            secondRecord.성명 || secondRecord.수신인 || '',
          )

          return recipientCompare || compareLogDate(firstRecord, secondRecord, 'DESC')
        }

        // 교육기관 가나다순
        case 'INSTITUTION_ASC': {
          const institutionCompare = compareLogText(
            firstRecord.교육기관명 || '',
            secondRecord.교육기관명 || '',
          )

          return institutionCompare || compareLogDate(firstRecord, secondRecord, 'DESC')
        }

        // 발송 상태순
        case 'STATUS': {
          const statusCompare =
            getStatusSortOrder(firstRecord) - getStatusSortOrder(secondRecord)

          return statusCompare || compareLogDate(firstRecord, secondRecord, 'DESC')
        }

        // 최신 발송순(기본값)
        case 'DATE_DESC':
        default:
          return compareLogDate(firstRecord, secondRecord, 'DESC')
      }
    })

    return sortableLogs
  }, [filteredLogs, sortOption])


  // =======================================
  // 7. 발송 로그 통계 계산
  // =======================================
  const { successCount, failureCount } = logs.reduce(
    (counts, record) => {
      const category = getStatusCategory(record)

      return {
        successCount:
          counts.successCount + (category === 'SUCCESS' ? 1 : 0),

        failureCount:
          counts.failureCount +
          (category === 'FAILURE' || category === 'SKIPPED' ? 1 : 0),
      }
    },
    {
      successCount: 0,
      failureCount: 0,
    },
  )

  // =======================================
  // 8. 페이지네이션 데이터 계산
  // 20261123 수정: 정렬된 데이터를 기준으로 페이지네이션 적용
  // =======================================
  const totalPages = Math.max(
    1,
    Math.ceil(sortedLogs.length / PAGE_SIZE),
  )

  const pageLogs = sortedLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  // 20261125 추가: 현재 페이지 전체 선택 상태
  const selectablePageIds = pageLogs
    .map((record) => record.ID)
    .filter(Boolean)

  const isPageAllChecked =
    selectablePageIds.length > 0 &&
    selectablePageIds.every((logId) => checkedLogIds.has(logId))

  const togglePageChecked = (checked: boolean) => {
    setCheckedLogIds((current) => {
      const next = new Set(current)

      selectablePageIds.forEach((logId) => {
        if (checked) next.add(logId)
        else next.delete(logId)
      })

      return next
    })
  }

  // 20261125 추가: 발송 작업 진행 중에는 개별 발송 시작 제한
  const isSendBlocked = isDispatching || isManualSending

  // =======================================
  // 9. 검색 및 초기화 이벤트 처리
  // =======================================
  /** 검색 버튼 클릭 */
  const handleSearch = () => {
    if (startDate && endDate && startDate > endDate) {
      setValidationError('시작 날짜는 종료 날짜보다 늦을 수 없습니다.')
      return
    }
    setValidationError('')
    setAppliedKeyword(keyword)
    setCurrentPage(1)
  }

  /** 검색 조건 초기화 */
  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setStatusFilter('ALL')

    setKeyword('')
    setAppliedKeyword('')

    setValidationError('')
    setCurrentPage(1)
  }

  // =======================================
  // 10. 발송 로그 화면 렌더링
  // =======================================
  return (
    <div className="page-content log-data-page">

      {/* 10-1. 페이지 제목 및 새로고침 버튼 */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">DISPATCH HISTORY</p>
          <h1>발송 로그</h1>

          <p className="page-subtitle">
            문자 및 이메일 발송 결과와 상세 내용을 조회합니다.
          </p>

          {/* 20261124 추가: 발송 자동화 진행 상태 및 결과 표시 */}
          {dispatchMessage && (
            <p className="log-update-message" role="status">
              {dispatchMessage}
            </p>
          )}

          {dispatchError && (
            <p className="log-error-message" role="alert">
              {dispatchError}
            </p>
          )}

          {/* 20261124 추가: Update 성공 메시지 */}
          {updateMessage && (
            <p className="log-update-message" role="status">
              {updateMessage}
            </p>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
        }}>
          {/* 새로고침 버튼 */}
          <button
            className="log-refresh-button"
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isLoading}
          >
            <span
              className={
                isLoading
                  ? 'log-refresh-icon is-spinning'
                  : 'log-refresh-icon'
              }
            >
              ↻
            </span>
            {isLoading ? '조회 중...' : '새로고침'}
          </button>

          {/* 20261124 추가: 발송 자동화 실행 버튼 */}
          <button
            className="log-refresh-button"
            type="button"
            onClick={() => void handleStartDispatch()}
            disabled={isDispatching || isManualSending || isLoading}
            title="설정된 사업의 이메일 및 문자 발송 자동화를 실행합니다."
          >
            {isDispatching ? '발송 진행 중...' : '발송 실행'}
          </button>

          {/* 20261125 추가: 수신자를 직접 입력하여 문자·이메일 발송 */}
          <button
            className="log-refresh-button log-compose-button"
            type="button"
            onClick={() => openCompose([])}
            disabled={isSendBlocked}
            title="수신자를 직접 입력하여 문자 또는 이메일을 발송합니다."
          >
            ✎ 새 메시지 작성
          </button>
        </div>
      </section>

      {/* 20261124 추가: 발송 기준일 설정 */}
      <section
        className="dispatch-settings-card"
        aria-labelledby="dispatch-settings-title"
      >
        <div className="dispatch-settings-heading">
          <div>
            <h2 id="dispatch-settings-title">발송 기준 설정</h2>
            <p>
              수업일을 기준으로 며칠 전에 안내 메시지를 발송할지 설정합니다.
            </p>
          </div>

          <span className="dispatch-settings-current">
            {dispatchSettings
              ? `현재 ${dispatchSettings.daysBefore}일 전`
              : isLoadingDispatchSettings
                ? '설정 조회 중'
                : '설정 확인 필요'}
          </span>
        </div>

        <div className="dispatch-settings-controls">
          <label className="dispatch-settings-input-group">
            <span>발송 기준일</span>

            <div className="dispatch-settings-input-wrap">
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={daysBeforeInput}
                onChange={(event) => {
                  setDaysBeforeInput(event.target.value)
                  setDispatchSettingsError('')
                  setDispatchSettingsMessage('')
                }}
                disabled={
                  isLoadingDispatchSettings ||
                  isSavingDispatchSettings ||
                  isDispatching
                }
                aria-label="수업일 기준 발송 며칠 전인지 입력"
              />

              <span>일 전</span>
            </div>
          </label>

          <div className="dispatch-settings-date">
            <span>현재 조회 대상 교육일</span>
            <strong>{dispatchSettings?.targetDate || '-'}</strong>
          </div>

          <button
            type="button"
            className="dispatch-settings-save-button"
            onClick={() => void handleSaveDispatchSettings()}
            disabled={
              isLoadingDispatchSettings ||
              isSavingDispatchSettings ||
              isDispatching ||
              !dispatchSettings
            }
          >
            {isSavingDispatchSettings ? '저장 중...' : '설정 저장'}
          </button>
        </div>

        {dispatchSettingsMessage && (
          <p className="dispatch-settings-message" role="status">
            {dispatchSettingsMessage}
          </p>
        )}

        {dispatchSettingsError && (
          <p className="dispatch-settings-error" role="alert">
            {dispatchSettingsError}
          </p>
        )}
      </section>

      {/* 10-2. 발송 로그 통계 카드 */}
      <section className="log-metric-grid" aria-label="발송 로그 요약">
        <article className="log-metric-card">
          <span>전체 발송 로그</span>
          <strong>
            {isLoading ? '-' : formatCount(logs.length)}
          </strong>
          <small>누적 기록 건수</small>
        </article>

        <article className="log-metric-card">
          <span>정상 발송</span>
          <strong>
            {isLoading ? '-' : formatCount(successCount)}
          </strong>
          <small>정상적으로 처리된 로그</small>
        </article>

        <article className="log-metric-card">
          <span>미발송 / 실패</span>
          <strong>
            {isLoading ? '-' : formatCount(failureCount)}
          </strong>
          <small>실패 또는 스킵 상태가 포함된 로그</small>
        </article>

        <article className="log-metric-card log-metric-update">
          <span>마지막 조회</span>
          <strong>{lastUpdated || '-'}</strong>
          <small>조회 버튼으로 갱신 가능</small>
        </article>
      </section>

      {/* 10-3. 발송 로그 검색 조건 */}
      <section className="log-filter-card">

        <div className="log-section-heading">
          <div>
            <h2>조회 조건</h2>

            <p>
              발송 기간, 상태 또는 수신자 정보를 기준으로 검색할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            className="log-reset-button"
            onClick={resetFilters}
          >
            초기화
          </button>
        </div>

        <div className="log-filter-controls">

          {/* 시작일 */}
          <label>
            <span>시작일</span>

            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value)
                setCurrentPage(1)
              }}
            />
          </label>

          {/* 종료일 */}
          <label>
            <span>종료일</span>

            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => {
                setEndDate(event.target.value)
                setCurrentPage(1)
              }}
            />
          </label>

          {/* 발송 상태 */}
          <label>
            <span>발송 상태</span>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter)
                setCurrentPage(1)
              }}
            >
              <option value="ALL">전체 상태</option>
              <option value="SUCCESS">성공</option>
              <option value="FAILURE">실패</option>
              <option value="TEST">테스트</option>
              <option value="SKIPPED">스킵</option>
            </select>
          </label>

          {/* 검색어 */}
          <label className="log-keyword-field">
            <span>검색어</span>

            <input
              type="search"
              placeholder="이름, 기관명, 연락처, 제목"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearch()
              }}
            />
          </label>

          {/* 조회 버튼 */}
          <button
            type="button"
            className="log-search-button"
            onClick={handleSearch}
          >
            조회
          </button>
        </div>

        {/* 검색 조건 오류 */}
        {validationError && (
          <div className="log-error-message" role="alert">
            {validationError}
          </div>
        )}
      </section>
      {/* 10-4. 발송 로그 테이블 */}
      <section className="log-table-card">
        <div className="log-table-heading">
          <div>
            <h2>발송 이력</h2>
            <p>
              조회 결과 {formatCount(filteredLogs.length)}건
            </p>
          </div>

          <div className="log-table-actions">
            {/* 20261125 추가: 선택 수신자 개별 발송 */}
            <div className="log-selection-bar" aria-live="polite">
              <span>
                {checkedLogs.length > 0
                  ? `${formatCount(checkedLogs.length)}명 선택됨`
                  : '발송할 수신자를 선택하세요'}
              </span>

              {checkedLogs.length > 0 && (
                <button
                  type="button"
                  className="log-reset-button"
                  onClick={() => setCheckedLogIds(new Set())}
                >
                  선택 해제
                </button>
              )}

              <button
                type="button"
                className="log-search-button log-selection-send"
                onClick={() => openCompose(checkedLogs)}
                disabled={checkedLogs.length === 0 || isSendBlocked}
              >
                선택 발송
              </button>
            </div>

            {/* 20261123 추가: 발송 이력 정렬 기준 선택 */}
            <label className="log-sort-control">
              <span>정렬 기준</span>
              <select
                className="log-sort-select"
                value={sortOption}
                onChange={(event) => {
                  setSortOption(event.target.value as LogSortOption)
                  setCurrentPage(1)
                }}
                aria-label="발송 이력 정렬 기준"
              >
                <option value="DATE_DESC">최신 발송순</option>
                <option value="DATE_ASC">오래된 발송순</option>
                <option value="RECIPIENT_ASC">수신인 가나다순</option>
                <option value="INSTITUTION_ASC">교육기관 가나다순</option>
                <option value="STATUS">발송 상태순 (실패 우선)</option>
              </select>
            </label>
          </div>
        </div>

        {/* API 조회 오류 */}
        {error && (
          <div className="log-error-message" role="alert">
            {error}
          </div>
        )}

        <div className="log-table-scroll">
          <table className="log-table">
            <thead>
              <tr>
                {/* 20261125 추가: 개별 발송 수신자 선택 */}
                <th className="log-select-cell">
                  <input
                    type="checkbox"
                    checked={isPageAllChecked}
                    onChange={(event) => togglePageChecked(event.target.checked)}
                    disabled={selectablePageIds.length === 0}
                    aria-label="현재 페이지 수신자 전체 선택"
                  />
                </th>
                <th>발송일시</th>
                <th>채널</th>
                <th>수신인</th>
                <th>교육기관 / 과정</th>
                <th>역할</th>
                <th>문자 상태</th>
                <th>이메일 상태</th>
                <th>수동 확인</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {/* 조회 중 */}
              {isLoading ? (
                <tr>
                  <td colSpan={TABLE_COLUMN_COUNT} className="log-table-message">
                    발송 로그를 불러오고 있습니다.
                  </td>
                </tr>

              ) : error && logs.length === 0 ? (

                /* 조회 실패 */
                <tr>
                  <td
                    colSpan={TABLE_COLUMN_COUNT}
                    className="log-table-message log-table-error"
                  >
                    로그 데이터를 불러오지 못했습니다.
                  </td>
                </tr>

              ) : pageLogs.length === 0 ? (

                /* 조회 결과 없음 */
                <tr>
                  <td colSpan={TABLE_COLUMN_COUNT} className="log-table-message">
                    조회 조건에 해당하는 발송 로그가 없습니다.
                  </td>
                </tr>

              ) : (

                /* 발송 로그 목록 */
                pageLogs.map((record, index) => (
                  <tr
                    key={record.ID || `${record.발송일시}-${index}`}
                    className={checkedLogIds.has(record.ID) ? 'is-checked' : undefined}
                  >

                    {/* 20261125 추가: 수신자 선택 */}
                    <td className="log-select-cell">
                      <input
                        type="checkbox"
                        checked={checkedLogIds.has(record.ID)}
                        disabled={!record.ID}
                        onChange={(event) =>
                          toggleLogChecked(record.ID, event.target.checked)
                        }
                        aria-label={`${record.성명 || record.수신인 || '해당 로그'} 발송 대상 선택`}
                      />
                    </td>

                    {/* 발송일시 */}
                    <td className="log-date-cell">
                      {formatDateTime(record.발송일시)}
                    </td>

                    {/* 발송 채널 */}
                    <td>
                      <span className="log-channel-pill">
                        {getChannelLabel(record)}
                      </span>
                    </td>

                    {/* 수신인 */}
                    <td>
                      <strong className="log-recipient-name">
                        {record.성명 || record.수신인 || '-'}
                      </strong>

                      <small className="log-recipient-contact">
                        {record.실제수신연락처 ||
                          record.실제수신이메일 ||
                          record.연락처 ||
                          record.이메일 ||
                          '-'}
                      </small>
                    </td>

                    {/* 교육기관 및 교육과정 */}
                    <td>
                      <strong className="log-institution-name">
                        {record.교육기관명 || '-'}
                      </strong>

                      <small className="log-course-name">
                        {record.교육과정명 || record.반명 || '-'}
                      </small>
                    </td>

                    {/* 역할 */}
                    <td>{record.역할 || '-'}</td>

                    {/* 문자 발송 상태 */}
                    <td>
                      {record.문자발송상태 ? (
                        <span
                          className={`log-inline-status log-inline-${getIndividualStatusClass(record.문자발송상태)}`}
                        >
                          {record.문자발송상태}
                        </span>
                      ) : (
                        <span className="log-muted">-</span>
                      )}
                    </td>

                    {/* 이메일 발송 상태 */}
                    <td>
                      {record.이메일발송상태 ? (
                        <span
                          className={`log-inline-status log-inline-${getIndividualStatusClass(record.이메일발송상태)}`}
                        >
                          {record.이메일발송상태}
                        </span>
                      ) : (
                        <span className="log-muted">-</span>
                      )}
                    </td>

                    {/* ======================================= */}
                    {/* 20261124 추가: 수동 발송 확인 체크박스 */}
                    {/* ======================================= */}
                    <td className="log-manual-confirmation-cell">
                      <label className="log-manual-confirmation">
                        <input
                          type="checkbox"
                          checked={isManualConfirmed(record.수동발송확인)}
                          disabled={
                            !record.ID ||
                            updatingLogIds.has(record.ID)
                          }
                          onChange={(event) =>
                            void handleManualConfirmationChange(
                              record,
                              event.target.checked,
                            )
                          }
                          aria-label={`${record.성명 || record.수신인 || '해당 로그'} 수동 발송 확인`}
                        />

                        <span>
                          {updatingLogIds.has(record.ID)
                            ? '저장 중'
                            : isManualConfirmed(record.수동발송확인)
                              ? '확인 완료'
                              : '미확인'}
                        </span>
                      </label>

                      {record.수동확인일시 && (
                        <small className="log-manual-confirmation-date">
                          {formatDateTime(record.수동확인일시)}
                        </small>
                      )}
                    </td>

                    {/* 상세 보기 */}
                    <td>
                      <button
                        type="button"
                        className="log-detail-button"
                        onClick={() => setSelectedLog(record)}
                      >
                        상세 보기
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 10-5. 페이지네이션 */}
        <footer className="log-pagination">

          <span>
            {filteredLogs.length === 0
              ? '0건'
              : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(
                  currentPage * PAGE_SIZE,
                  filteredLogs.length,
                )} / ${formatCount(filteredLogs.length)}건`}
          </span>

          <div>

            <button
              type="button"
              onClick={() => {
                setCurrentPage((page) => Math.max(1, page - 1))
              }}
              disabled={currentPage <= 1}
            >
              이전
            </button>

            <span>
              {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => {
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }}
              disabled={currentPage >= totalPages}
            >
              다음
            </button>
          </div>
        </footer>
      </section>

      {/* 10-6. 발송 로그 상세 모달 */}
      {selectedLog && (
        <LogDetailModal
          record={selectedLog}
          onClose={() => setSelectedLog(null)}
          onCompose={(record) => {
            setSelectedLog(null)
            openCompose([record])
          }}
          isComposeDisabled={isSendBlocked}
        />
      )}

      {/* 20261125 추가: 문자·이메일 개별 발송 작성 모달 */}
      {composeDrafts && (
        <MessageComposeModal
          initialDrafts={composeDrafts}
          settings={dispatchSettings}
          isBlocked={isDispatching}
          onSend={handleManualSend}
          onClose={() => {
            if (!isManualSending) setComposeDrafts(null)
          }}
        />
      )}
    </div>
  )
}


export default LogDataPage