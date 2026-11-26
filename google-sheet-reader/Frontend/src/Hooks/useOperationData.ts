/**
 * @file useOperationData.ts
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-26
 * @description
 * 운영 데이터 조회 상태 관리 (처음 화면 진입 시 조회, 새로고침 시 서버 캐시 무시)
 */

import { useEffect, useState } from 'react'

import { getOperationData } from '../Services/OperationService'
import type { OperationDataMap, OperationKey, OperationResult } from '../Types/operations'

type LoadState<K extends OperationKey> = {
  requestKey: number
  result: OperationResult<OperationDataMap[K]> | null
  error: string
}

export function useOperationData<K extends OperationKey>(key: K) {
  const [reloadToken, setReloadToken] = useState(0)
  const [loadState, setLoadState] = useState<LoadState<K> | null>(null)

  // 응답이 현재 요청 번호와 다르면 조회 중
  const isLoading = loadState?.requestKey !== reloadToken

  useEffect(() => {
    let isActive = true

    getOperationData(key, reloadToken > 0)
      .then((result) => {
        if (isActive) setLoadState({ requestKey: reloadToken, result, error: '' })
      })
      .catch((error: unknown) => {
        if (!isActive) return

        setLoadState((current) => ({
          requestKey: reloadToken,
          result: current?.result ?? null, // 새로고침 실패 시 이전 데이터 유지
          error: error instanceof Error ? error.message : '시트 조회에 실패했습니다.',
        }))
      })

    return () => {
      isActive = false
    }
  }, [key, reloadToken])

  return {
    result: loadState?.result ?? null,
    data: loadState?.result?.data ?? null,
    error: loadState?.error ?? '',
    isLoading,
    reload: () => setReloadToken((token) => token + 1),
  }
}
