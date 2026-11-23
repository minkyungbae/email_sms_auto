/**
 * @file useDashboardData.ts
 * @author 배민경
 * @created 2026-11-23
 * @updated 2026-11-23
 * @description 대시보드의 교육 데이터 조회와 관련된 상태 및 함수를 관리
 */


// =======================================
// 1. 라이브러리 및 서비스 import
// =======================================
import { useCallback, useState } from 'react'

import { getEducationByDateRange } from '../Services/EducationService'
import type { EducationRecord } from '../Types/education'


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
// =======================================
export function useDashboardData() {
  // ---------------------------------------
  // 4-1. 교육 데이터 상태
  // ---------------------------------------
  const [gwData, setGwData] = useState<EducationRecord[]>([])
  const [dsData, setDsData] = useState<EducationRecord[]>([])

  // ---------------------------------------
  // 4-2. API 연결 상태
  // ---------------------------------------
  const [gwStatus, setGwStatus] = useState<ApiStatus>('loading')
  const [dsStatus, setDsStatus] = useState<ApiStatus>('loading')

  // ---------------------------------------
  // 4-3. 로딩 및 오류 상태
  // ---------------------------------------
  const [isLoading, setIsLoading] = useState(false)
  const [gwError, setGwError] = useState('')
  const [dsError, setDsError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')


  // =======================================
  // 5. GW·DS 교육 데이터 조회
  // =======================================
  const loadEducationData = useCallback(async () => {
    setIsLoading(true)

    setGwStatus('loading')
    setDsStatus('loading')

    setGwError('')
    setDsError('')

    // ---------------------------------------
    // 5-1. 최근 30일 조회 날짜 설정
    // ---------------------------------------
    const endDate = new Date()
    const startDate = new Date(endDate)

    startDate.setDate(startDate.getDate() - 29)

    const params = {
      startDate: formatIsoDate(startDate),
      endDate: formatIsoDate(endDate),
    }

    try {
      // ---------------------------------------
      // 5-2. GW·DS 데이터 동시 조회
      // ---------------------------------------
      const results = await Promise.allSettled([
        getEducationByDateRange({
          businessType: 'GW',
          ...params,
        }),
        getEducationByDateRange({
          businessType: 'DS',
          ...params,
        }),
      ])

      // ---------------------------------------
      // 5-3. GW 조회 결과 처리
      // ---------------------------------------
      if (results[0].status === 'fulfilled') {
        setGwData(results[0].value)
        setGwStatus('connected')
      } else {
        setGwData([])
        setGwStatus('error')

        setGwError(
          results[0].reason instanceof Error
            ? results[0].reason.message
            : 'GW 데이터 조회 실패',
        )
      }

      // ---------------------------------------
      // 5-4. DS 조회 결과 처리
      // ---------------------------------------
      if (results[1].status === 'fulfilled') {
        setDsData(results[1].value)
        setDsStatus('connected')
      } else {
        setDsData([])
        setDsStatus('error')

        setDsError(
          results[1].reason instanceof Error
            ? results[1].reason.message
            : 'DS 데이터 조회 실패',
        )
      }

      // ---------------------------------------
      // 5-5. 마지막 조회 시간 기록
      // ---------------------------------------
      setLastUpdated(
        new Intl.DateTimeFormat('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date()),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])


  // =======================================
  // 6. 외부 반환
  // =======================================
  return {
    gwData,
    dsData,
    gwStatus,
    dsStatus,
    isLoading,
    gwError,
    dsError,
    lastUpdated,
    loadEducationData,
  }
}