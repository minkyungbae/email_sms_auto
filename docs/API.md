# API 명세

교육사업 운영 관리 및 문자·이메일 발송 자동화 시스템의 백엔드 REST API 명세입니다.

- 기본 서버 주소: `http://localhost:3000`
- 응답 형식: JSON
- 공통 응답 예시:

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

> `data`의 세부 구조는 API별 처리 결과에 따라 달라짐. 아래 내용은 현재 프로젝트 문서에 기재된 엔드포인트와 요청 형식을 기준으로 정리.

---

## 1. 서버 상태 확인

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/health` |
| 설명 | Express API 서버 상태 확인 |

```http
GET /api/health
```

## 2. 교육 데이터 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/education/:businessType` |
| 지원 사업 | `GW`, `DS` |
| 설명 | 특정 날짜 또는 날짜 범위의 교육 데이터 조회 |

### Path Parameter

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `businessType` | O | 사업 유형 (`GW`, `DS`) |

### Query Parameters

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `date` | 조건부 | 특정 날짜 (`YYYY-MM-DD`) |
| `startDate` | 조건부 | 조회 시작일 (`YYYY-MM-DD`) |
| `endDate` | 조건부 | 조회 종료일 (`YYYY-MM-DD`) |

단일 날짜 조회와 기간 조회 조건은 동시에 전달하지 않음.

**특정 날짜 조회**

```http
GET /api/education/GW?date=2026-11-23
```

**기간 조회**

```http
GET /api/education/DS?startDate=2026-11-01&endDate=2026-11-30
```

## 3. 발송 로그 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/logs` |
| 설명 | Google Apps Script를 통한 발송 로그 조회 |

```http
GET /api/logs
```

조회 결과는 웹 화면에서 검색, 필터링, 정렬 및 상세 조회에 사용.

## 4. 발송 설정 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/dispatch/settings` |
| 설명 | 실행 사업, 발송 기준일, 테스트 모드 등 발송 설정 조회 |

```http
GET /api/dispatch/settings
```

예약 발송 스케줄러도 해당 API를 호출해 발송 설정을 확인.

## 5. 발송 자동화 실행

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/dispatch/run` |
| 설명 | 이메일 및 SMS 자동화 작업 실행 |
| 접수 상태 | `202 Accepted` |

### Request Body

```json
{
  "confirm": true,
  "targetDate": "2026-11-23"
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `confirm` | Boolean | O | 발송 실행 확인 |
| `targetDate` | String | O | 발송 대상 교육 기준일 (`YYYY-MM-DD`) |

요청이 접수되면 발송 작업을 비동기로 시작하고 작업 ID를 반환. 이미 작업이 실행 중인 경우 중복 실행을 제한.

## 6. 발송 작업 상태 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/dispatch/status/:jobId` |
| 설명 | 작업 ID 기준 발송 진행 상태 및 결과 조회 |

```http
GET /api/dispatch/status/{jobId}
```

### 작업 상태

| 상태 | 설명 |
|---|---|
| `queued` | 실행 대기 |
| `running` | 발송 작업 실행 중 |
| `succeeded` | 작업 완료 |
| `failed` | 작업 실패 |

현재 작업 상태는 Express 서버 메모리에서 관리하므로 서버 재시작 시 기존 작업 상태는 유지되지 않음.

## 7. API 요약

| 기능 | Method | Endpoint |
|---|---|---|
| 서버 상태 확인 | `GET` | `/api/health` |
| 교육 데이터 조회 | `GET` | `/api/education/:businessType` |
| 발송 로그 조회 | `GET` | `/api/logs` |
| 발송 설정 조회 | `GET` | `/api/dispatch/settings` |
| 발송 자동화 실행 | `POST` | `/api/dispatch/run` |
| 발송 작업 상태 조회 | `GET` | `/api/dispatch/status/:jobId` |

## 참고 사항

- 기본 포트는 `3000`이며 `PORT` 환경변수로 변경할 수 있음.
- 교육 데이터와 발송 로그는 Google Apps Script를 통해 Google Sheets와 연동함.
- 발송 API는 실제 이메일 및 문자 발송으로 이어질 수 있으므로 테스트 모드와 수신 대상 설정을 확인해야 함.
- 현재 API 서버에는 사용자 로그인 및 권한 확인 기능이 없음. 외부 공개 시 인증·인가와 네트워크 접근 제한이 필요함.
