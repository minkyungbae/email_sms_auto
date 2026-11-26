/**
 * @file MessageComposeModal.tsx
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-26
 * @description
 * 발송 로그 화면의 문자·이메일 개별 발송 작성 모달
 *
 * 주요 기능:
 * - 발송 로그에서 선택한 수신자 목록 표시 및 직접 수신자 추가
 * - 수신자별 문자 / 이메일 채널 선택
 * - 수신자별 문자·이메일 제목 및 본문 수정
 * - 작성한 내용을 모든 수신자에게 일괄 적용
 * - 치환 문구({성명}, {교육기관명}, {교육일}) 지원
 * - 문자 바이트 수 및 SMS / LMS 구분 표시
 * - 현재 테스트 발송 설정 안내 및 발송 전 최종 확인
 * - 발송 진행 상태 및 수신자별 발송 결과 표시
 *
 * 20261126 수정: GW / DS 완전 분리 - 사업 구분(문자 발송인)을 워크스페이스 사업으로 고정
 */

import { useMemo, useState } from 'react'

import type {
  DispatchSettings,
  ManualChannelResult,
  ManualSendJobResult,
  ManualSendMessage,
  ManualBusinessType, // 20261126 추가
} from '../Services/DispatchService'

import {
  MESSAGE_LIMITS,
  MESSAGE_PLACEHOLDERS,
  applyPlaceholders,
  createEmptyDraft,
  getSmsByteLength,
  getSmsType,
  toManualSendMessage,
  validateDraft,
} from '../Utils/messageDraft'

import type { MessageDraft } from '../Utils/messageDraft'

// =======================================
// 1. 컴포넌트 속성 타입
// =======================================
type MessageComposeModalProps = {
  businessType: ManualBusinessType // 20261126 추가: 워크스페이스 사업 (발송인 고정)
  initialDrafts: MessageDraft[]
  settings: DispatchSettings | null
  isBlocked: boolean // 자동 발송 진행 중 여부
  onSend: (
    messages: ManualSendMessage[],
    onProgress: (message: string) => void,
  ) => Promise<ManualSendJobResult>
  onClose: () => void
}

// =======================================
// 2. 화면 표시 보조 함수
// =======================================
/** 현재 테스트 설정 안내 문구 */
function getModeNotice(settings: DispatchSettings | null): {
  isTest: boolean
  lines: string[]
} {
  if (!settings) {
    return {
      isTest: false,
      lines: ['발송 설정을 확인하지 못했습니다. 실제 수신자에게 발송될 수 있으니 서버 설정을 확인해 주세요.'],
    }
  }

  const { modes } = settings
  const lines: string[] = []

  if (modes.smsApiTestMode) lines.push('문자: 뿌리오 테스트 모드 (실제 미발송)')
  else if (modes.smsTestRecipientMode) lines.push('문자: 테스트 수신번호로 발송')
  else lines.push('문자: 실제 수신자에게 발송')

  if (modes.emailPreviewMode) lines.push('이메일: 미리보기 모드 (실제 미발송)')
  else if (modes.emailTestRecipientMode) lines.push('이메일: 테스트 수신주소로 발송')
  else lines.push('이메일: 실제 수신자에게 발송')

  const isTest =
    modes.smsApiTestMode ||
    modes.smsTestRecipientMode ||
    modes.emailPreviewMode ||
    modes.emailTestRecipientMode

  return { isTest, lines }
}

/** 채널별 발송 결과 문구 및 상태 클래스 */
function getChannelResultView(result: ManualChannelResult | null): {
  label: string
  tone: 'success' | 'failure' | 'test' | 'none'
} {
  if (!result) return { label: '-', tone: 'none' }

  if (!result.success) {
    return { label: `실패: ${result.error || '발송 실패'}`, tone: 'failure' }
  }

  if (result.previewOnly) return { label: '미리보기 (실제 미발송)', tone: 'test' }
  if (result.testMode) return { label: '테스트 (실제 미발송)', tone: 'test' }

  return { label: '발송 완료', tone: 'success' }
}

/** 수신자 목록의 연락처 요약 */
function getContactSummary(draft: MessageDraft): string {
  const contacts = [
    draft.smsEnabled ? draft.phone : '',
    draft.emailEnabled ? draft.email : '',
  ].filter((value) => value.trim())

  return contacts.join(' · ') || '연락처 미입력'
}

// =======================================
// 3. 개별 발송 작성 모달
// =======================================
function MessageComposeModal({
  businessType,
  initialDrafts,
  settings,
  isBlocked,
  onSend,
  onClose,
}: MessageComposeModalProps) {
  // ---------------------------------------
  // 3-1. 작성 및 발송 상태
  // ---------------------------------------
  // 20261126 수정: 모든 수신자의 사업 구분을 워크스페이스 사업으로 고정
  const [drafts, setDrafts] = useState<MessageDraft[]>(() =>
    initialDrafts.length > 0
      ? initialDrafts.map((draft) => ({ ...draft, businessType }))
      : [createEmptyDraft(businessType)],
  )

  const [activeKey, setActiveKey] = useState(
    () => (initialDrafts[0] ?? drafts[0]).key,
  )

  const [isSending, setIsSending] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendResult, setSendResult] = useState<ManualSendJobResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const activeDraft = drafts.find((draft) => draft.key === activeKey) ?? drafts[0]

  // ---------------------------------------
  // 3-2. 입력값 검증 결과
  // ---------------------------------------
  const draftErrors = useMemo(
    () => new Map(drafts.map((draft) => [draft.key, validateDraft(draft)])),
    [drafts],
  )

  const invalidCount = [...draftErrors.values()].filter(
    (errors) => errors.length > 0,
  ).length

  const smsCount = drafts.filter((draft) => draft.smsEnabled).length
  const emailCount = drafts.filter((draft) => draft.emailEnabled).length

  const modeNotice = getModeNotice(settings)

  // ---------------------------------------
  // 3-3. 작성 데이터 수정
  // ---------------------------------------
  const updateActiveDraft = (changes: Partial<MessageDraft>) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === activeDraft.key ? { ...draft, ...changes } : draft,
      ),
    )
    setSendError('')
  }

  const updateActiveEducation = (
    changes: Partial<MessageDraft['education']>,
  ) => {
    updateActiveDraft({
      education: { ...activeDraft.education, ...changes },
    })
  }

  /** 수신자 직접 추가 */
  const addDirectRecipient = () => {
    if (drafts.length >= MESSAGE_LIMITS.MAX_RECIPIENTS) {
      setSendError(`한 번에 최대 ${MESSAGE_LIMITS.MAX_RECIPIENTS}명까지 발송할 수 있습니다.`)
      return
    }

    const nextDraft = createEmptyDraft(businessType) // 20261126 수정: 워크스페이스 사업

    // 직접 추가한 수신자에게 현재 작성 중인 내용 복사
    nextDraft.smsSubject = activeDraft.smsSubject
    nextDraft.smsBody = activeDraft.smsBody
    nextDraft.emailSubject = activeDraft.emailSubject
    nextDraft.emailBody = activeDraft.emailBody
    nextDraft.smsEnabled = activeDraft.smsEnabled
    nextDraft.emailEnabled = activeDraft.emailEnabled

    setDrafts((current) => [...current, nextDraft])
    setActiveKey(nextDraft.key)
  }

  /** 수신자 제외 */
  const removeRecipient = (key: string) => {
    if (drafts.length <= 1) return

    const nextDrafts = drafts.filter((draft) => draft.key !== key)

    setDrafts(nextDrafts)

    if (key === activeKey) {
      setActiveKey(nextDrafts[0].key)
    }
  }

  /** 현재 수신자의 문자 또는 이메일 내용을 전체 수신자에게 적용 */
  const applyToAll = (channel: 'sms' | 'email') => {
    const label = channel === 'sms' ? '문자' : '이메일'

    const confirmed = window.confirm(
      `현재 작성한 ${label} 제목과 본문을 모든 수신자(${drafts.length}명)에게 적용할까요?\n` +
        '수신자별로 수정한 기존 내용은 덮어씌워집니다.',
    )

    if (!confirmed) return

    setDrafts((current) =>
      current.map((draft) =>
        channel === 'sms'
          ? {
              ...draft,
              smsEnabled: draft.smsEnabled || Boolean(draft.phone.trim()),
              smsSubject: activeDraft.smsSubject,
              smsBody: activeDraft.smsBody,
            }
          : {
              ...draft,
              emailEnabled: draft.emailEnabled || Boolean(draft.email.trim()),
              emailSubject: activeDraft.emailSubject,
              emailBody: activeDraft.emailBody,
            },
      ),
    )
  }

  // ---------------------------------------
  // 3-4. 발송 실행
  // ---------------------------------------
  const handleSubmit = async () => {
    if (isSending || isBlocked) return

    setShowErrors(true)

    const firstInvalid = drafts.find(
      (draft) => (draftErrors.get(draft.key) ?? []).length > 0,
    )

    if (firstInvalid) {
      setActiveKey(firstInvalid.key)
      setSendError(`입력 내용을 확인해 주세요. (확인 필요 ${invalidCount}명)`)
      return
    }

    const confirmed = window.confirm(
      [
        `${drafts.length}명에게 개별 발송할까요?`,
        '',
        `문자 ${smsCount}건 / 이메일 ${emailCount}건`,
        '',
        '[발송 설정]',
        ...modeNotice.lines,
        '',
        '주의: 설정에 따라 실제 이메일 및 문자가 발송될 수 있습니다.',
      ].join('\n'),
    )

    if (!confirmed) return

    setIsSending(true)
    setSendError('')
    setProgressMessage('개별 발송을 요청하고 있습니다...')

    try {
      const result = await onSend(
        drafts.map(toManualSendMessage),
        setProgressMessage,
      )

      setSendResult(result)
      setProgressMessage('')
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : '개별 발송 중 알 수 없는 오류가 발생했습니다.',
      )
      setProgressMessage('')
    } finally {
      setIsSending(false)
    }
  }

  const activeErrors = draftErrors.get(activeDraft.key) ?? []

  const smsPreview = applyPlaceholders(activeDraft.smsBody, activeDraft)
  const smsBytes = getSmsByteLength(smsPreview.trim())
  const emailPreview = applyPlaceholders(activeDraft.emailBody, activeDraft)

  const hasPlaceholder = (text: string) =>
    MESSAGE_PLACEHOLDERS.some((placeholder) => text.includes(placeholder))

  // =======================================
  // 4. 화면 렌더링
  // =======================================
  return (
    <div
      className="log-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSending) onClose()
      }}
    >
      <section
        className="log-detail-modal log-compose-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-compose-title"
      >
        {/* 4-1. 모달 헤더 */}
        <header className="log-detail-modal-header">
          <div>
            <p className="log-detail-eyebrow">MESSAGE DISPATCH</p>
            <h2 id="log-compose-title">문자·이메일 개별 발송</h2>
            <p>
              {sendResult
                ? '개별 발송 결과입니다.'
                : `수신자 ${drafts.length}명 · 수신자별로 발송 채널과 내용을 수정할 수 있습니다.`}
            </p>
          </div>

          <button
            type="button"
            className="log-modal-close"
            onClick={onClose}
            disabled={isSending}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        {/* 4-2. 현재 발송 설정 안내 */}
        <div
          className={`compose-mode-notice ${modeNotice.isTest ? '' : 'compose-mode-live'}`}
          role="note"
        >
          <strong>{modeNotice.isTest ? '테스트 설정 적용 중' : '실제 발송 주의'}</strong>
          <span>{modeNotice.lines.join('  ·  ')}</span>
        </div>

        {sendResult ? (
          /* 4-3. 발송 결과 */
          <div className="log-detail-modal-body">
            <section className="compose-result-summary" aria-label="개별 발송 결과 요약">
              <article>
                <span>문자 성공</span>
                <strong>{sendResult.summary.smsSuccess}</strong>
              </article>
              <article>
                <span>문자 실패</span>
                <strong>{sendResult.summary.smsFailure}</strong>
              </article>
              <article>
                <span>이메일 성공</span>
                <strong>{sendResult.summary.emailSuccess}</strong>
              </article>
              <article>
                <span>이메일 실패</span>
                <strong>{sendResult.summary.emailFailure}</strong>
              </article>
            </section>

            <p className="compose-result-caption">
              발송 로그 {sendResult.logCount}건이 기록되었습니다.
            </p>

            <div className="log-table-scroll">
              <table className="log-table compose-result-table">
                <thead>
                  <tr>
                    <th>수신인</th>
                    <th>문자</th>
                    <th>이메일</th>
                  </tr>
                </thead>
                <tbody>
                  {sendResult.results.map((item) => {
                    const smsView = getChannelResultView(item.sms)
                    const emailView = getChannelResultView(item.email)

                    return (
                      <tr key={`${item.index}-${item.sourceLogId}`}>
                        <td>
                          <strong className="log-recipient-name">
                            {item.name || `${item.index + 1}번째 수신자`}
                          </strong>
                        </td>
                        {[{ view: smsView, detail: item.sms }, { view: emailView, detail: item.email }].map(
                          ({ view, detail }, channelIndex) => (
                            <td key={channelIndex}>
                              {view.tone === 'none' ? (
                                <span className="log-muted">-</span>
                              ) : (
                                <>
                                  <span className={`log-inline-status log-inline-${view.tone}`}>
                                    {view.label}
                                  </span>
                                  {detail?.recipient && (
                                    <small className="log-recipient-contact">
                                      {detail.recipient}
                                    </small>
                                  )}
                                </>
                              )}
                            </td>
                          ),
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* 4-4. 작성 화면 */
          <div className="compose-body">
            {/* 4-4-1. 수신자 목록 */}
            <aside className="compose-recipient-panel" aria-label="수신자 목록">
              <div className="compose-panel-heading">
                <h3>수신자</h3>
                <span>{drafts.length}명</span>
              </div>

              <ul className="compose-recipient-list">
                {drafts.map((draft, index) => {
                  const hasError = showErrors && (draftErrors.get(draft.key) ?? []).length > 0

                  return (
                    <li key={draft.key}>
                      <button
                        type="button"
                        className={[
                          'compose-recipient-item',
                          draft.key === activeDraft.key ? 'is-active' : '',
                          hasError ? 'has-error' : '',
                        ].join(' ')}
                        onClick={() => setActiveKey(draft.key)}
                        disabled={isSending}
                      >
                        <span className="compose-recipient-name">
                          {draft.name.trim() || `수신자 ${index + 1}`}
                          {draft.isDirect && <em>직접 입력</em>}
                        </span>
                        <small>{getContactSummary(draft)}</small>
                        <span className="compose-channel-tags">
                          {draft.smsEnabled && <span>문자</span>}
                          {draft.emailEnabled && <span>이메일</span>}
                          {hasError && <span className="compose-tag-error">확인 필요</span>}
                        </span>
                      </button>

                      {drafts.length > 1 && (
                        <button
                          type="button"
                          className="compose-recipient-remove"
                          onClick={() => removeRecipient(draft.key)}
                          disabled={isSending}
                          aria-label={`${draft.name || `수신자 ${index + 1}`} 제외`}
                          title="수신자 제외"
                        >
                          ×
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>

              <button
                type="button"
                className="compose-add-button"
                onClick={addDirectRecipient}
                disabled={isSending}
              >
                + 수신자 직접 추가
              </button>
            </aside>

            {/* 4-4-2. 선택한 수신자 내용 편집 */}
            <div className="compose-editor">
              <section className="log-detail-section">
                <h3>수신 대상</h3>

                <div className="compose-field-grid">
                  <label className="compose-field">
                    <span>성명</span>
                    <input
                      type="text"
                      value={activeDraft.name}
                      onChange={(event) => updateActiveDraft({ name: event.target.value })}
                      placeholder="수신인 성명"
                      disabled={isSending}
                    />
                  </label>

                  <label className="compose-field">
                    <span>역할</span>
                    <input
                      type="text"
                      value={activeDraft.role}
                      onChange={(event) => updateActiveDraft({ role: event.target.value })}
                      placeholder="예: 강사, 담당교사"
                      disabled={isSending}
                    />
                  </label>

                  <label className="compose-field">
                    <span>연락처</span>
                    <input
                      type="tel"
                      value={activeDraft.phone}
                      onChange={(event) => updateActiveDraft({ phone: event.target.value })}
                      placeholder="010-0000-0000"
                      disabled={isSending}
                    />
                  </label>

                  <label className="compose-field">
                    <span>이메일</span>
                    <input
                      type="email"
                      value={activeDraft.email}
                      onChange={(event) => updateActiveDraft({ email: event.target.value })}
                      placeholder="name@example.com"
                      disabled={isSending}
                    />
                  </label>

                  <label className="compose-field">
                    <span>교육기관명</span>
                    <input
                      type="text"
                      value={activeDraft.education.교육기관명}
                      onChange={(event) =>
                        updateActiveEducation({ 교육기관명: event.target.value })
                      }
                      placeholder="로그에 기록할 교육기관명"
                      disabled={isSending}
                    />
                  </label>

                  {/* 20261126 수정: 워크스페이스 사업으로 고정 (선택 불가) */}
                  <label className="compose-field">
                    <span>사업 구분 (문자 발송인)</span>
                    <input
                      type="text"
                      value={businessType === 'DS' ? 'DS · 디지털새싹' : 'GW · 강원SW미래채움'}
                      readOnly
                      disabled
                    />
                  </label>
                </div>
              </section>

              <section className="log-detail-section">
                <h3>발송 채널</h3>

                <div className="compose-channel-toggles">
                  <label className="compose-toggle">
                    <input
                      type="checkbox"
                      checked={activeDraft.smsEnabled}
                      onChange={(event) =>
                        updateActiveDraft({ smsEnabled: event.target.checked })
                      }
                      disabled={isSending}
                    />
                    <span>문자 (SMS / LMS)</span>
                  </label>

                  <label className="compose-toggle">
                    <input
                      type="checkbox"
                      checked={activeDraft.emailEnabled}
                      onChange={(event) =>
                        updateActiveDraft({ emailEnabled: event.target.checked })
                      }
                      disabled={isSending}
                    />
                    <span>이메일</span>
                  </label>
                </div>

                <p className="compose-hint">
                  본문에 {MESSAGE_PLACEHOLDERS.join(', ')}를 입력하면 수신자별 정보로 바뀌어 발송됩니다.
                </p>
              </section>

              {/* 문자 내용 */}
              {activeDraft.smsEnabled && (
                <section className="log-detail-section">
                  <div className="compose-section-heading">
                    <h3>문자 내용</h3>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        className="log-detail-button"
                        onClick={() => applyToAll('sms')}
                        disabled={isSending}
                      >
                        전체 수신자에게 적용
                      </button>
                    )}
                  </div>

                  <label className="compose-field">
                    <span>제목 (LMS 발송 시 사용)</span>
                    <input
                      type="text"
                      value={activeDraft.smsSubject}
                      maxLength={MESSAGE_LIMITS.SMS_SUBJECT_MAX_LENGTH}
                      onChange={(event) => updateActiveDraft({ smsSubject: event.target.value })}
                      placeholder="문자 제목"
                      disabled={isSending}
                    />
                  </label>

                  <label className="compose-field">
                    <span>본문</span>
                    <textarea
                      value={activeDraft.smsBody}
                      onChange={(event) => updateActiveDraft({ smsBody: event.target.value })}
                      rows={8}
                      placeholder="문자 본문을 입력해 주세요."
                      disabled={isSending}
                    />
                  </label>

                  <p
                    className={`compose-byte-counter ${
                      smsBytes > MESSAGE_LIMITS.SMS_MAX_BYTES ? 'is-over' : ''
                    }`}
                  >
                    {smsBytes.toLocaleString()} / {MESSAGE_LIMITS.SMS_MAX_BYTES.toLocaleString()} byte
                    · {getSmsType(smsPreview.trim())}
                  </p>

                  {hasPlaceholder(activeDraft.smsBody) && (
                    <>
                      <p className="compose-preview-label">발송 미리보기</p>
                      <pre className="log-message-body">{smsPreview}</pre>
                    </>
                  )}
                </section>
              )}

              {/* 이메일 내용 */}
              {activeDraft.emailEnabled && (
                <section className="log-detail-section">
                  <div className="compose-section-heading">
                    <h3>이메일 내용</h3>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        className="log-detail-button"
                        onClick={() => applyToAll('email')}
                        disabled={isSending}
                      >
                        전체 수신자에게 적용
                      </button>
                    )}
                  </div>

                  <label className="compose-field">
                    <span>제목</span>
                    <input
                      type="text"
                      value={activeDraft.emailSubject}
                      maxLength={MESSAGE_LIMITS.EMAIL_SUBJECT_MAX_LENGTH}
                      onChange={(event) => updateActiveDraft({ emailSubject: event.target.value })}
                      placeholder="이메일 제목"
                      disabled={isSending}
                    />
                  </label>

                  <label className="compose-field">
                    <span>본문</span>
                    <textarea
                      value={activeDraft.emailBody}
                      onChange={(event) => updateActiveDraft({ emailBody: event.target.value })}
                      rows={12}
                      placeholder="이메일 본문을 입력해 주세요."
                      disabled={isSending}
                    />
                  </label>

                  {hasPlaceholder(activeDraft.emailBody) && (
                    <>
                      <p className="compose-preview-label">발송 미리보기</p>
                      <pre className="log-message-body">{emailPreview}</pre>
                    </>
                  )}
                </section>
              )}

              {/* 선택한 수신자의 입력 오류 */}
              {showErrors && activeErrors.length > 0 && (
                <ul className="compose-error-list" role="alert">
                  {activeErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* 4-5. 모달 하단 */}
        <footer className="log-detail-modal-footer compose-footer">
          <div className="compose-footer-status" role="status">
            {sendResult ? (
              <span>
                {sendResult.total}명 처리 완료
              </span>
            ) : progressMessage ? (
              <span>{progressMessage}</span>
            ) : sendError ? (
              <span className="compose-footer-error">{sendError}</span>
            ) : isBlocked ? (
              <span className="compose-footer-error">
                발송 자동화가 진행 중입니다. 완료 후 발송할 수 있습니다.
              </span>
            ) : (
              <span>
                수신자 {drafts.length}명 · 문자 {smsCount}건 · 이메일 {emailCount}건
              </span>
            )}
          </div>

          <div className="compose-footer-actions">
            {sendResult ? (
              <button type="button" className="log-modal-confirm" onClick={onClose}>
                닫기
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="log-reset-button compose-cancel-button"
                  onClick={onClose}
                  disabled={isSending}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="log-modal-confirm"
                  onClick={() => void handleSubmit()}
                  disabled={isSending || isBlocked}
                >
                  {isSending ? '발송 중...' : '발송하기'}
                </button>
              </>
            )}
          </div>
        </footer>
      </section>
    </div>
  )
}

export default MessageComposeModal
