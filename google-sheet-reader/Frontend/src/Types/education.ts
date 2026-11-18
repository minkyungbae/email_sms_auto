/**
 * @file education.ts
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-18
 * @description
 * GW와 DS 교육 데이터의 구조를 정의
 */


export type BusinessType = 'GW' | 'DS'

export type EducationValue = string | number | boolean | null

export interface GWEducationRecord {
  지역?: EducationValue
  월?: EducationValue
  강사유형?: EducationValue
  사번?: EducationValue
  강사시급?: EducationValue
  강사이름?: EducationValue
  근무유형?: EducationValue
  '내용(수요처명)'?: EducationValue
  반명?: EducationValue
  근무시간?: EducationValue
  근무날짜: string
  연락처?: EducationValue
  이메일목록?: EducationValue
  연락처매칭상태?: EducationValue
}


export interface DSEducationRecord {
  사업구분: 'DS'
  접수?: EducationValue
  구분?: EducationValue
  신청교육대상?: EducationValue
  프로그램운영유형?: EducationValue
  권역?: EducationValue
  미참여저조지역?: EducationValue
  LMS번호반?: EducationValue
  학교명?: EducationValue
  원본학교명?: EducationValue
  학생수?: EducationValue
  과정명?: EducationValue
  학교주소?: EducationValue
  담당교사명?: EducationValue
  담당교사연락처?: EducationValue
  담당교사이메일?: EducationValue
  주강사?: EducationValue
  주강사연락처?: EducationValue
  주강사명?: EducationValue
  주강사학교명?: EducationValue
  주강사학교급?: EducationValue
  주강사구분?: EducationValue
  주강사표기?: EducationValue
  보조강사?: EducationValue
  보조강사연락처?: EducationValue
  보조강사명?: EducationValue
  보조강사학교명?: EducationValue
  보조강사학교급?: EducationValue
  보조강사구분?: EducationValue
  보조강사표기?: EducationValue
  근무날짜: string
  수업일차?: EducationValue
  원본일차값?: EducationValue
  시간?: EducationValue
  원본시간?: EducationValue
  시간파싱상태?: EducationValue
  수업차시?: EducationValue
  원본행?: EducationValue

  [key: string]: EducationValue | undefined
}


export type EducationRecord = GWEducationRecord | DSEducationRecord


export interface ApiResponse<T> {
  success: boolean
  data: T | null
  message: string | null
}


export interface EducationDateRangeParams {
  businessType: BusinessType
  startDate: string
  endDate: string
}

export interface EducationDateParams {
  businessType: BusinessType
  date: string
}
