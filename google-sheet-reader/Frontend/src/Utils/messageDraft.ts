/**
 * @file messageDraft.ts
 * @author 배민경
 * @created 2026-11-25
 * @updated 2026-11-25
 * @description
 * 발송 로그 화면의 문자·이메일 개별 발송 작성 데이터 관리
 *
 * 주요 기능:
 * - 발송 로그 한 건을 기존 발송 내용이 채워진 작성 데이터로 변환
 * - 직접 입력용 빈 작성 데이터 생성
 * - 문자 바이트 수 계산 및 SMS / LMS 구분 (서버 SmsService와 동일 기준)
 * - 수신자별 입력값 검증
 * - 치환 문구({성명}, {교육기관명}, {교육일}) 적용 후 API 요청 데이터 생성
 */

import type { LogRecord } from '../Services/LogService'
import type {
  ManualBusinessType,
  ManualSendMessage,
} from '../Services/DispatchService'

// =======================================
// 1. 작성 제한값 (서버 ManualSendService.js와 동일)
// =======================================
export const MESSAGE_LIMITS = {
  MAX_RECIPIENTS: 100,
  SMS_MAX_BYTES: 2000,
  SMS_SHORT_BYTES: 90,
  SMS_SUBJECT_MAX_LENGTH: 40,
  EMAIL_SUBJECT_MAX_LENGTH: 200,
} as const

// 본문에서 사용할 수 있는 치환 문구
export const MESSAGE_PLACEHOLDERS = ['{성명}', '{교육기관명}', '{교육일}'] as const

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// =======================================
// 2. 수신자별 작성 데이터 타입
// =======================================
export type MessageDraft = {
  key: string
  sourceLogId: string
  isDirect: boolean
  businessType: ManualBusinessType

  name: string
  role: string
  phone: string
  email: string
  affiliation: string

  education: ManualSendMessage['education']

  smsEnabled: boolean
  smsSubject: string
  smsBody: string

  emailEnabled: boolean
  emailSubject: string
  emailBody: string
}

let draftSequence = 0

function createDraftKey(prefix: string): string {
  draftSequence += 1
  return `${prefix}-${Date.now()}-${draftSequence}`
}

// =======================================
// 3. 역할 / 과정명으로 사업 구분 추정
// GW: 강사 / DS: 담당교사·주강사·보조강사
// 20261126 수정: 교육 안내 발송 화면의 사업별 로그 분리에 사용하도록 export
// =======================================
export function inferBusinessType(record: LogRecord): ManualBusinessType {
  const role = record.역할.trim()

  if (['담당교사', '주강사', '보조강사'].includes(role)) return 'DS'
  if (role === '강사') return 'GW'

  return record.교육과정명.trim() ? 'DS' : 'GW'
}

// =======================================
// 4. 발송 로그 → 작성 데이터 변환
// 기존 문자·이메일 본문을 그대로 채워서 수정 후 재발송할 수 있도록 구성
// =======================================
export function createDraftFromRecord(record: LogRecord): MessageDraft {
  const phone = record.연락처.trim()
  const email = record.이메일.trim()

  const hasSmsHistory = Boolean(record.문자발송상태.trim() || record.문자본문내용.trim())
  const hasEmailHistory = Boolean(record.이메일발송상태.trim() || record.이메일본문내용.trim())

  let smsEnabled = Boolean(phone) && hasSmsHistory
  let emailEnabled = Boolean(email) && hasEmailHistory

  // 이전 발송 기록이 없으면 연락 가능한 채널을 기본 선택
  if (!smsEnabled && !emailEnabled) {
    smsEnabled = Boolean(phone)
    emailEnabled = !phone && Boolean(email)
  }

  return {
    key: createDraftKey(record.ID || 'log'),
    sourceLogId: record.ID,
    isDirect: false,
    businessType: inferBusinessType(record),

    name: record.성명 || record.수신인,
    role: record.역할,
    phone,
    email,
    affiliation: record.소속기관명,

    education: {
      교육과정명: record.교육과정명,
      교육기관명: record.교육기관명,
      반명: record.반명,
      교육일: record.교육일,
      요일: record.요일,
      교육시간: record.교육시간,
    },

    smsEnabled,
    // 로그의 제목은 이메일 제목이 우선 기록되므로, 이메일 기록이 없을 때만 문자 제목으로 사용
    smsSubject: (hasEmailHistory ? '' : record.제목).slice(
      0,
      MESSAGE_LIMITS.SMS_SUBJECT_MAX_LENGTH,
    ),
    smsBody: record.문자본문내용,

    emailEnabled,
    emailSubject: record.제목.slice(0, MESSAGE_LIMITS.EMAIL_SUBJECT_MAX_LENGTH),
    emailBody: record.이메일본문내용,
  }
}

// =======================================
// 5. 직접 입력용 빈 작성 데이터
// =======================================
// 20261126 수정: 현재 워크스페이스 사업을 기본 사업 구분으로 사용
export function createEmptyDraft(
  businessType: ManualBusinessType = 'GW',
): MessageDraft {
  return {
    key: createDraftKey('direct'),
    sourceLogId: '',
    isDirect: true,
    businessType,

    name: '',
    role: '',
    phone: '',
    email: '',
    affiliation: '',

    education: {
      교육과정명: '',
      교육기관명: '',
      반명: '',
      교육일: '',
      요일: '',
      교육시간: '',
    },

    smsEnabled: true,
    smsSubject: '',
    smsBody: '',

    emailEnabled: false,
    emailSubject: '',
    emailBody: '',
  }
}

// =======================================
// 6. 문자 바이트 수 계산
// 서버와 동일: ASCII 1byte / 그 외 2byte, 90byte 초과 시 LMS
// =======================================
export function getSmsByteLength(text: string): number {
  let byteLength = 0

  for (const char of text) {
    byteLength += char.charCodeAt(0) > 127 ? 2 : 1
  }

  return byteLength
}

export function getSmsType(text: string): 'SMS' | 'LMS' {
  return getSmsByteLength(text) > MESSAGE_LIMITS.SMS_SHORT_BYTES ? 'LMS' : 'SMS'
}

// =======================================
// 7. 치환 문구 적용
// =======================================
export function applyPlaceholders(text: string, draft: MessageDraft): string {
  return text
    .replaceAll('{성명}', draft.name.trim())
    .replaceAll('{교육기관명}', draft.education.교육기관명.trim())
    .replaceAll('{교육일}', draft.education.교육일.trim())
}

// =======================================
// 8. 수신자별 입력값 검증
// =======================================
export function validateDraft(draft: MessageDraft): string[] {
  const errors: string[] = []

  if (!draft.name.trim()) {
    errors.push('수신인 성명을 입력해 주세요.')
  }

  if (!draft.smsEnabled && !draft.emailEnabled) {
    errors.push('문자 또는 이메일 중 하나 이상을 선택해 주세요.')
  }

  if (draft.smsEnabled) {
    const phoneDigits = draft.phone.replace(/[^0-9]/g, '')

    if (phoneDigits.length < 9 || phoneDigits.length > 11) {
      errors.push('문자 수신 연락처를 확인해 주세요.')
    }

    const smsBody = applyPlaceholders(draft.smsBody, draft).trim()

    if (!smsBody) {
      errors.push('문자 본문을 입력해 주세요.')
    } else if (getSmsByteLength(smsBody) > MESSAGE_LIMITS.SMS_MAX_BYTES) {
      errors.push(`문자 본문은 ${MESSAGE_LIMITS.SMS_MAX_BYTES}byte 이하로 작성해 주세요.`)
    }
  }

  if (draft.emailEnabled) {
    if (!EMAIL_PATTERN.test(draft.email.trim())) {
      errors.push('이메일 주소를 확인해 주세요.')
    }

    if (!draft.emailSubject.trim()) {
      errors.push('이메일 제목을 입력해 주세요.')
    }

    if (!applyPlaceholders(draft.emailBody, draft).trim()) {
      errors.push('이메일 본문을 입력해 주세요.')
    }
  }

  return errors
}

// =======================================
// 9. 작성 데이터 → API 요청 데이터 변환
// =======================================
export function toManualSendMessage(draft: MessageDraft): ManualSendMessage {
  return {
    sourceLogId: draft.sourceLogId,
    businessType: draft.businessType,
    recipient: {
      name: draft.name.trim(),
      role: draft.role.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      affiliation: draft.affiliation.trim(),
    },
    education: draft.education,
    sms: {
      enabled: draft.smsEnabled,
      subject: applyPlaceholders(draft.smsSubject, draft).trim(),
      body: applyPlaceholders(draft.smsBody, draft).trim(),
    },
    email: {
      enabled: draft.emailEnabled,
      subject: applyPlaceholders(draft.emailSubject, draft).trim(),
      body: applyPlaceholders(draft.emailBody, draft).trim(),
    },
  }
}
