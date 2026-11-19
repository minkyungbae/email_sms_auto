/**
 * @file LogDataPage.tsx
 * @author 배민경
 * @created 2026-11-19
 * @description
 * 문자 및 이메일 발송 로그 조회 화면
 *
 * 주요 기능:
 * - 발송 로그 전체 조회
 * - 발송 기간 / 상태 / 키워드 필터
 * - 조회 결과 페이지네이션
 * - 발송 로그 상세 내용 확인
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getLogs } from '../Services/LogService'
import type { LogRecord } from '../Services/LogService'
import '../LogDataPage.css'

const PAGE_SIZE = 10

type StatusFilter = 'ALL' | 'SUCCESS' | 'FAILURE' | 'TEST' | 'SKIPPED'
type StatusCategory = Exclude<StatusFilter, 'ALL'> | 'UNKNOWN'

function getStatusCategory(record: LogRecord): StatusCategory {
  const statuses = [record.문자발송상태, record.이메일발송상태]
    .map((value) => value.trim())
    .filter(Boolean)

  if (statuses.length === 0) return 'UNKNOWN'
  if (statuses.some((value) => value.includes('실패'))) return 'FAILURE'
  if (statuses.some((value) => value.includes('스킵'))) return 'SKIPPED'
  if (statuses.some((value) => value.includes('테스트'))) return 'TEST'
  return 'SUCCESS'
}

function getChannelLabel(record: LogRecord): string {
  const hasSms = Boolean(record.문자발송상태)
  const hasEmail = Boolean(record.이메일발송상태)

  if (hasSms && hasEmail) return '문자 + 이메일'
  if (hasSms) return '문자'
  if (hasEmail) return '이메일'
  return '-'
}

function getIndividualStatusClass(value: string): string {
  if (value.includes('실패')) return 'failure'
  if (value.includes('스킵')) return 'skipped'
  if (value.includes('테스트')) return 'test'
  return 'success'
}

function getLogDate(value: string): string {
  const match = String(value || '').match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (!match) return ''

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function formatDateTime(value: string): string {
  if (!value) return '-'
  return value.replace('T', ' ')
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value)
}


function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="log-detail-field">
      <dt>{label}</dt>
      <dd>{value?.trim() || '-'}</dd>
    </div>
  )
}

function LogDetailModal({
  record,
  onClose,
}: {
  record: LogRecord
  onClose: () => void
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

        <footer className="log-detail-modal-footer">
          <button type="button" className="log-modal-confirm" onClick={onClose}>
            닫기
          </button>
        </footer>
      </section>
    </div>
  )
}

function LogDataPage() {
  const [logs, setLogs] = useState<LogRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<LogRecord | null>(null)

  // API 응답 이후 상태 업데이트
  const loadLogs = useCallback(async () => {
    try {
      const result = await getLogs()
      setLogs(result)
      setLastUpdated(
        new Intl.DateTimeFormat('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      )
      setCurrentPage(1)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : '발송 로그 조회에 실패했습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    getLogs()
      .then((result) => {
        if (!isActive) return

        setLogs(result)
        setLastUpdated(
          new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(new Date()),
        )
      })
      .catch((loadError: unknown) => {
        if (!isActive) return

        setError(
          loadError instanceof Error
            ? loadError.message
            : '발송 로그 조회에 실패했습니다.',
        )
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])
 

  const filteredLogs = useMemo(() => {
    const normalizedKeyword = appliedKeyword.trim().toLocaleLowerCase()

    return logs.filter((record) => {
      const logDate = getLogDate(record.발송일시)

      if (startDate && (!logDate || logDate < startDate)) return false
      if (endDate && (!logDate || logDate > endDate)) return false

      if (statusFilter !== 'ALL' && getStatusCategory(record) !== statusFilter) {
        return false
      }

      if (normalizedKeyword) {
        const searchableText = [
          record.성명,
          record.수신인,
          record.연락처,
          record.이메일,
          record.역할,
          record.교육과정명,
          record.교육기관명,
          record.반명,
          record.제목,
          record.문자발송상태,
          record.이메일발송상태,
        ].join(' ').toLocaleLowerCase()

        if (!searchableText.includes(normalizedKeyword)) return false
      }

      return true
    })
  }, [logs, startDate, endDate, statusFilter, appliedKeyword])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const pageLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const failureCount = logs.filter((record) => {
    const category = getStatusCategory(record)
    return category === 'FAILURE' || category === 'SKIPPED'
  }).length

  // 정상 발송 건수
    const successCount = logs.filter(
(record) => getStatusCategory(record) === 'SUCCESS',
    ).length

  const handleSearch = () => {
    if (startDate && endDate && startDate > endDate) {
      setError('시작 날짜는 종료 날짜보다 늦을 수 없습니다.')
      return
    }

    setError('')
    setAppliedKeyword(keyword)
    setCurrentPage(1)
  }

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setStatusFilter('ALL')
    setKeyword('')
    setAppliedKeyword('')
    setError('')
    setCurrentPage(1)
  }

  return (
    <div className="page-content log-data-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">DISPATCH HISTORY</p>
          <h1>발송 로그</h1>
          <p className="page-subtitle">
            문자 및 이메일 발송 결과와 상세 내용을 조회합니다.
          </p>
        </div>

        <button
          className="log-refresh-button"
          type="button"
          onClick={() => void loadLogs()}
          disabled={isLoading}
        >
          <span className={isLoading ? 'log-refresh-icon is-spinning' : 'log-refresh-icon'}>
            ↻
          </span>
          {isLoading ? '조회 중...' : '새로고침'}
        </button>
      </section>

      <section className="log-metric-grid" aria-label="발송 로그 요약">
        <article className="log-metric-card">
          <span>전체 발송 로그</span>
          <strong>{isLoading ? '-' : formatCount(logs.length)}</strong>
          <small>누적 기록 건수</small>
        </article>
        <article className="log-metric-card">
          <span>정상 발송</span>
          <strong>{isLoading ? '-' : formatCount(successCount)}</strong>
          <small>정상적으로 처리된 로그</small>
        </article>
        <article className="log-metric-card">
          <span>미발송 / 실패</span>
          <strong>{isLoading ? '-' : formatCount(failureCount)}</strong>
          <small>실패 또는 스킵 상태가 포함된 로그</small>
        </article>
        <article className="log-metric-card log-metric-update">
          <span>마지막 조회</span>
          <strong>{lastUpdated || '-'}</strong>
          <small>조회 버튼으로 갱신 가능</small>
        </article>
      </section>

      <section className="log-filter-card">
        <div className="log-section-heading">
          <div>
            <h2>조회 조건</h2>
            <p>발송 기간, 상태 또는 수신자 정보를 기준으로 검색할 수 있습니다.</p>
          </div>
          <button type="button" className="log-reset-button" onClick={resetFilters}>
            초기화
          </button>
        </div>

        <div className="log-filter-controls">
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
          <label>
            <span>종료일</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => {
                setEndDate(event.target.value)
                setCurrentPage(1) // 20261119 추가
                }}
            />
          </label>
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
          <button type="button" className="log-search-button" onClick={handleSearch}>
            조회
          </button>
        </div>
      </section>

      <section className="log-table-card">
        <div className="log-table-heading">
          <div>
            <h2>발송 이력</h2>
            <p>조회 결과 {formatCount(filteredLogs.length)}건</p>
          </div>
          <span className="log-table-caption">최신 발송 순</span>
        </div>

        {error && <div className="log-error-message" role="alert">{error}</div>}

        <div className="log-table-scroll">
          <table className="log-table">
            <thead>
              <tr>
                <th>발송일시</th>
                <th>채널</th>
                <th>수신인</th>
                <th>교육기관 / 과정</th>
                <th>역할</th>
                <th>문자 상태</th>
                <th>이메일 상태</th>
                <th>상세</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="log-table-message">
                    발송 로그를 불러오고 있습니다.
                  </td>
                </tr>
              ) : error && logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="log-table-message log-table-error">
                    로그 데이터를 불러오지 못했습니다.
                  </td>
                </tr>
              ) : pageLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="log-table-message">
                    조회 조건에 해당하는 발송 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                pageLogs.map((record) => (
                  <tr key={record.ID}>
                    <td className="log-date-cell">{formatDateTime(record.발송일시)}</td>
                    <td>
                      <span className="log-channel-pill">{getChannelLabel(record)}</span>
                    </td>
                    <td>
                      <strong className="log-recipient-name">
                        {record.성명 || record.수신인 || '-'}
                      </strong>
                      <small className="log-recipient-contact">
                        {record.실제수신연락처 || record.실제수신이메일 || record.연락처 || record.이메일 || '-'}
                      </small>
                    </td>
                    <td>
                      <strong className="log-institution-name">
                        {record.교육기관명 || '-'}
                      </strong>
                      <small className="log-course-name">
                        {record.교육과정명 || record.반명 || '-'}
                      </small>
                    </td>
                    <td>{record.역할 || '-'}</td>
                    <td>
                      {record.문자발송상태 ? (
                        <span className={`log-inline-status log-inline-${getIndividualStatusClass(record.문자발송상태)}`}>
                          {record.문자발송상태}
                        </span>
                      ) : <span className="log-muted">-</span>}
                    </td>
                    <td>
                      {record.이메일발송상태 ? (
                        <span className={`log-inline-status log-inline-${getIndividualStatusClass(record.이메일발송상태)}`}>
                          {record.이메일발송상태}
                        </span>
                      ) : <span className="log-muted">-</span>}
                    </td>
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

        <footer className="log-pagination">
          <span>
            {filteredLogs.length === 0
              ? '0건'
              : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} / ${formatCount(filteredLogs.length)}건`}
          </span>
          <div>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
            >
              이전
            </button>
            <span>{currentPage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage >= totalPages}
            >
              다음
            </button>
          </div>
        </footer>
      </section>

      {selectedLog && (
        <LogDetailModal
          record={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  )
}

export default LogDataPage