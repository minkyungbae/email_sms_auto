/**
 * @file operations.ts
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
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

export type OperationDataMap = {
  demand: ListSheet
  staff: ListSheet
  assignment: ListSheet
  'fee-annual': FeeAnnualSheet
  'fee-region': FeeRegionSheet
  materials: MaterialsSheet
}
