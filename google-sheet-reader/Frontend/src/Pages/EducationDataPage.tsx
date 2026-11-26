/**
 * @file EducationDataPage.tsx
 * @author 배민경
 * @created 2026-11-18
 * @updated 2026-11-26
 * @description
 * 교육 실적 현황 화면
 * 
 * 20261123 수정: GW, DS의 권역/지역과 수요처명/학교명으로 컬럼 통일 및 DS의 담당교사&보조강사명 추가
 * 20261125 수정: 페이지명 변경(교육 데이터 → 교육 실적 현황)
 *               상단 수료 실적 그래프, 중단 실적 집계 표(수료실적_RAW) 추가
 *               하단에 기존 GW·DS 교육 일정 데이터 조회 유지
 * 20261126 수정: GW / DS 완전 분리 - 워크스페이스 사업 데이터만 조회 (사업 구분 선택·전체 사업 조회 삭제)
 * 20261126 삭제: 하단 교육 일정 데이터 영역 (조회 조건 / 결과 요약 / 교육 데이터 목록 표)
 *               → 수료 실적 그래프·집계 표만 표시
 */

import PerformanceOverview from '../Components/PerformanceOverview' // 20261125 추가: 수료 실적 그래프·표

function EducationDataPage() {
  return (
    <div className="page-content">
      {/* 20261118 추가: 페이지 제목 */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">EDUCATION PERFORMANCE</p>
          <h1>교육 실적 현황</h1>
          <p className="page-subtitle">
            수료 실적을 그래프와 집계 표로 확인합니다.
          </p>
        </div>
      </section>

      {/* 20261125 추가: 상단 수료 실적 그래프 + 중단 실적 집계 표 */}
      <PerformanceOverview />
    </div>
  )
}

export default EducationDataPage