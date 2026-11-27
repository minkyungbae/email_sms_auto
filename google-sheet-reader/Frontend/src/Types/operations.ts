/**
 * @file operations.ts
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-27
 * @description
 * 운영 데이터 시트 타입 (백엔드 src/Utils/OperationParser.js 결과 구조)
 *
 * 레코드 키는 시트 헤더 이름 그대로 사용 (줄바꿈 제거)
 * 모든 값은 시트에 표시된 문자열
 */

export type OperationKey =
  | 'demand'
  | 'staff'
  | 'assignment'
  | 'fee-annual'
  | 'fee-region'
  | 'materials'
  | 'mbo' // 20261127 추가

/** 시트 한 행 (헤더 이름 → 표시 값). "행" 은 시트 행 번호 */
export type SheetRecord = Record<string, string>

/** API 공통 응답 */
export type OperationResult<T> = {
  key: OperationKey
  sheetName: string
  fetchedAt: string
  data: T
}

/** 목록형 시트 (수요처정보 / 운영인력정보 / 강사배정) */
export type ListSheet = {
  title: string
  headerRow: number
  headers: string[]
  records: SheetRecord[]
}

/** 5.센터_강사비(연간) */
export type FeeAnnualSheet = {
  title: string
  notes: string[]
  months: string[]
  items: { 항목: string; values: Record<string, string> }[]
  budget: { label: string; value: string }[]
  detail: {
    headers: string[]
    records: SheetRecord[]
  }
}

/** 6.센터_강사비(지역) */
export type RowTable = {
  headers: string[]
  rows: SheetRecord[]
}

export type FeeRegionSheet = {
  title: string
  regions: (RowTable & { region: string })[]
  annual: RowTable
  monthly: RowTable
  paymentTables: (RowTable & { title: string })[]
}

/** 7.센터_교구재 */
export type MaterialsSheet = {
  title: string
  tables: {
    title: string
    headers: string[]
    records: SheetRecord[]
  }[]
}

/** MBO 20261127 추가: 최종목표지표 표(23행~) 기준 */
export type MboKpi = {
  행: string
  구분: string // 핵심성과지표 / 자율성과지표
  대분류: string // ①강사양성교육 등 (세부지표가 있을 때만)
  성과지표: string
  목표: string // "75명"
  정량목표: string // "75"
  진행실적: string
  진행율: string
  진행상태: string // 완료 / 미진행
  세부내용: string
  증빙방법: string
  진행현황: string // 진행 메모
  진행예정: string
  비고: string
}

export type MboSheet = {
  title: string
  kpis: MboKpi[]
  statusOptions?: string[] // 진행현황 드롭다운 선택지 (20261127 추가)
}

/** MBO 진행현황 수정 결과 (20261127 추가) */
export type MboProgressResult = {
  행: string
  진행상태: string
  진행현황: string
  진행실적: string // 20261127 추가
  진행율: string // 20261127 추가
}

export type OperationDataMap = {
  demand: ListSheet
  staff: ListSheet
  assignment: ListSheet
  'fee-annual': FeeAnnualSheet
  'fee-region': FeeRegionSheet
  materials: MaterialsSheet
  mbo: MboSheet // 20261126 추가
}
