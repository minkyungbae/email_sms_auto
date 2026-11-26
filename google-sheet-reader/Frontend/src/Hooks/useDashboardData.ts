/**
 * @file useDashboardData.ts
 * @author 배민경
 * @created 2026-11-23
 * @updated 2026-11-26
 * @description 대시보드의 교육 데이터 조회와 관련된 상태 및 함수를 관리
 *
 * 20261126 수정: GW / DS 완전 분리
 * - 워크스페이스 사업 하나의 데이터만 조회하도록 변경 (gwData·dsData → data)
 * 20261126 추가: 서버 캐시 대응
 * - loadEducationData(true): 새로고침 버튼 → 서버 캐시 무시
 * - lastUpdated: 서버가 시트를 조회한 시각 (캐시 데이터면 캐시 저장 시각)
 */


// =======================================
// 1. 라이브러리 및 서비스 import
// =======================================
import { useCallback, useState } from 'react'

import { getEducationByDateRangeWithMeta } from '../Services/EducationService'
import { formatFetchedTime } from '../Utils/date'
import type { BusinessType, EducationRecord } from '../Types/education'


// =======================================
// 2. API 조회 상태 타입
// =======================================
export type ApiStatus = 'loading' | 'connected' | 'error'


// =======================================
// 3. 날짜 변환 함수
// =======================================
function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}


// =======================================
// 4. 대시보드 교육 데이터 관리 훅
// 20261126 수정: 사업 구분을 전달받아 해당 사업만 조회
// =======================================
export function useDashboardData(businessType: BusinessType) {
  // ---------------------------------------
  // 4-1. 교육 데이터 및 API 연결 상태
  // ---------------------------------------
  const [data, setData] = useState<EducationRecord[]>([])
  const [status, setStatus] = useState<ApiStatus>('loading')

  // ---------------------------------------
  // 4-2. 로딩 및 오류 상태
  // ---------------------------------------
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')


  // =======================================
  // 5. 교육 데이터 조회 (최근 30일)
  // =======================================
  // 20261126 수정: refresh=true 이면 서버 캐시 무시
  const loadEducationData = useCallback(async (refresh = false) => {
    setIsLoading(true)
    setStatus('loading')
    setError('')

    const endDate = new Date()
    const startDate = new Date(endDate)

    startDate.setDate(startDate.getDate() - 29)

    try {
      const result = await getEducationByDateRangeWithMeta(
        {
          businessType,
          startDate: formatIsoDate(startDate),
          endDate: formatIsoDate(endDate),
        },
        { refresh },
      )

      setData(result.records)
      setStatus('connected')
      setLastUpdated(formatFetchedTime(result.fetchedAt)) // 20261126 수정: 서버 데이터 조회 시각
    } catch (loadError) {
      setData([])
      setStatus('error')
      setError(
        loadError instanceof Error
          ? loadError.message
          : `${businessType} 데이터 조회 실패`,
      )
    } finally {
      setIsLoading(false)
    }
  }, [businessType])


  // =======================================
  // 6. 외부 반환
  // =======================================
  return {
    data,
    status,
    error,
    isLoading,
    lastUpdated,
    loadEducationData,
  }
}
