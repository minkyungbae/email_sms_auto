/**
 * @file OperationService.ts
 * @author 배민경
 * @created 2026-11-26
 * @updated 2026-11-27
 * @description
 * 운영 데이터(수요처정보 / 운영인력정보 / 강사배정 / 센터 강사비 / 센터 교구재) 조회 API 요청
 * 20261127 추가: MBO 진행현황 수정 (PATCH /api/operations/mbo/progress/:row)
 */

import { API_CONFIG, createMboProgressApiUrl, createOperationApiUrl } from '../Configs/api'
import { requestApiData } from './ApiClient'
import type { MboProgressResult, OperationDataMap, OperationKey, OperationResult } from '../Types/operations'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// =======================================
// 운영 데이터 조회
// refresh=true 이면 서버 캐시를 무시하고 시트를 다시 조회
// =======================================
export async function getOperationData<K extends OperationKey>(
  key: K,
  refresh = false,
): Promise<OperationResult<OperationDataMap[K]>> {
  const result = await requestApiData<unknown>(createOperationApiUrl(key, refresh), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: API_CONFIG.OPERATIONS_TIMEOUT_MS,
    timeoutMessage: '시트 조회 시간이 초과되었습니다.',
    networkErrorMessage: '백엔드 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.',
    invalidResponseMessage: '운영 데이터 API 응답 형식이 올바르지 않습니다.',
    requestFailureMessage: '시트 조회에 실패했습니다.',
  })

  if (!isRecord(result) || !isRecord(result.data)) {
    throw new Error('운영 데이터 API 응답 형식이 올바르지 않습니다.')
  }

  return {
    key,
    sheetName: String(result.sheetName ?? ''),
    fetchedAt: String(result.fetchedAt ?? ''),
    data: result.data as OperationDataMap[K],
  }
}

// =======================================
// MBO 진행현황 수정 (시트에 바로 저장)
// name: 성과지표 이름 (시트 행이 바뀌었는지 확인용)
// 20261127 추가
// =======================================
export async function updateMboProgress(
  row: string,
  changes: { name: string; status?: string; note?: string; actual?: number },
): Promise<MboProgressResult> {
  const data = await requestApiData<unknown>(createMboProgressApiUrl(row), {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(changes),
    timeoutMs: API_CONFIG.OPERATIONS_TIMEOUT_MS,
    timeoutMessage: '진행현황 저장 시간이 초과되었습니다.',
    networkErrorMessage: '백엔드 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.',
    invalidResponseMessage: '진행현황 저장 API 응답 형식이 올바르지 않습니다.',
    requestFailureMessage: '진행현황 저장에 실패했습니다.',
  })

  if (!isRecord(data)) {
    throw new Error('진행현황 저장 API 응답 형식이 올바르지 않습니다.')
  }

  return {
    행: String(data.행 ?? row),
    진행상태: String(data.진행상태 ?? ''),
    진행현황: String(data.진행현황 ?? ''),
    진행실적: String(data.진행실적 ?? ''),
    진행율: String(data.진행율 ?? ''),
  }
}
