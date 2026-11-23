# 프로젝트 구조

이 문서는 프로젝트의 디렉터리 구성과 주요 모듈의 역할을 설명합니다.

## 1. 전체 디렉터리 구조

```text
email_sms_auto
├── README.md
├── app.js                         # 예약 발송 스케줄러 진입점
├── security_info.js               # 비공개 인증 및 운영 설정
│
└── google-sheet-reader
    ├── Frontend                    # React + TypeScript 프론트엔드
    │   ├── public
    │   └── src
    │       ├── Assets              # 이미지 및 정적 리소스
    │       ├── Components          # 공통 UI 및 차트 컴포넌트
    │       ├── Configs             # 프론트엔드 설정
    │       ├── CSS                 # 화면별 스타일
    │       ├── Hooks               # 커스텀 React Hooks
    │       ├── Pages               # 페이지 컴포넌트
    │       ├── Services            # API 요청 및 데이터 처리
    │       ├── Types               # TypeScript 타입
    │       ├── Utils               # 공통 유틸리티
    │       ├── App.css
    │       ├── App.tsx
    │       └── main.tsx
    │
    ├── Routes                      # Express API 라우터
    │   ├── dispatchRoutes.js
    │   ├── educationRoutes.js
    │   └── logRoutes.js
    │
├── src                         # 자동화 및 데이터 처리 모듈
│   ├── Configs                  # 자동화 실행에 필요한 설정 및 메시지 템플릿 관리
│   │   ├── Config.js            # 사업 유형, 실행 옵션, 발송 대상 등 공통 설정
│   │   ├── GmailConfig.js       # Gmail 이메일 발송 계정 및 SMTP 설정
│   │   ├── MessageConfig.js     # 문자 및 이메일 발송 관련 공통 설정
│   │   ├── SheetConfig.js       # Google Sheets 문서 ID, 시트명, 컬럼 정보 설정
│   │   └── SmsBody.js           # 문자 발송 메시지 본문 구성
│   │
│   ├── Services                            # 데이터 조회, 발송, 로그 등 핵심 기능 처리
│   │   ├── 00_Scheduler.js                 # 정해진 시간에 자동화 작업을 실행하는 스케줄러
│   │   ├── GmailService.js                 # Gmail을 이용한 이메일 발송 처리
│   │   ├── GroupService.js                 # 교육 일정 및 수요처 기준으로 발송 대상 그룹화
│   │   ├── LogService.js                   # 문자 및 이메일 발송 결과 기록 및 관리
│   │   ├── NotificationService.js          # 발송 대상에 따라 문자 및 이메일 발송 작업 실행
│   │   ├── NotificationTargetService.js    # 사업 유형별 발송 대상자 및 수신 정보 결정
│   │   ├── SheetService.js                 # Google Sheets에서 교육 데이터 조회 및 가공
│   │   ├── SmsService.js                   # 문자 및 장문 문자(LMS) 발송 처리
│   │   └── TemplateService.js              # 사업 유형 및 발송 대상별 메시지 템플릿 생성
│   │
│   ├── Utils                               # 여러 모듈에서 공통으로 사용하는 유틸리티
│   │   ├── DataMapper.js                   # 조회한 데이터를 서비스에서 사용하기 적합한 형태로 변환
│   │   └── Logger.js                       # 자동화 실행 과정 및 오류 로그 출력
│   │
│   └── 01_Main.js                          # 자동화 전체 실행 흐름을 제어하는 메인 진입점
    │
    ├── server.js                           # Express API 서버 진입점
    ├── package.json
    └── package-lock.json
```

> 주요 파일 중심으로 정리한 구조. 실제 저장소에 추가 파일이 있다면 저장소의 최신 구조를 기준으로 반영.

## 2. Frontend

React와 TypeScript로 교육 운영 데이터를 조회하고 발송 작업을 실행하는 웹 화면을 구성.

| 경로 | 역할 |
|---|---|
| `src/Pages` | 대시보드, 교육 데이터, 사업 현황, 발송 로그 페이지 |
| `src/Components` | 공통 UI 및 교육 운영 추이 차트 |
| `src/Services` | API 클라이언트, 교육 데이터, 발송 및 로그 API 요청 |
| `src/Hooks` | 데이터 조회 및 화면 상태 관리 |
| `src/Types` | 교육 데이터 및 API 응답 타입 정의 |
| `src/Utils` | 날짜 변환 등 공통 유틸리티 |
| `src/CSS` | 페이지별 스타일 및 반응형 레이아웃 |
| `src/Configs` | API 기본 주소 등 프론트엔드 설정 |

### 주요 페이지

| 페이지 | 역할 |
|---|---|
| `Dashboard` | 전체 운영 현황 및 주요 지표 표시 |
| `EducationDataPage` | GW·DS 교육 데이터 조회 |
| `BusinessStatusPage` | 사업별 교육 운영 현황 집계 |
| `LogDataPage` | 이메일·문자 발송 이력 검색 및 상세 확인 |

## 3. Backend API

Express를 사용해 프론트엔드 요청을 처리하고 교육 데이터, 발송 로그 및 자동화 기능을 연결.

| 파일 | 역할 |
|---|---|
| `server.js` | Express 서버, 미들웨어 및 라우터 설정 |
| `Routes/educationRoutes.js` | 사업 유형과 날짜 조건에 따른 교육 데이터 조회 |
| `Routes/logRoutes.js` | 발송 로그 조회 |
| `Routes/dispatchRoutes.js` | 발송 설정 조회, 발송 실행 및 작업 상태 조회 |

### 주요 API

| Method | Endpoint | 기능 |
|---|---|---|
| `GET` | `/api/health` | 서버 상태 확인 |
| `GET` | `/api/education/:businessType` | 교육 데이터 조회 |
| `GET` | `/api/logs` | 발송 로그 조회 |
| `GET` | `/api/dispatch/settings` | 발송 설정 조회 |
| `POST` | `/api/dispatch/run` | 발송 자동화 실행 |
| `GET` | `/api/dispatch/status/:jobId` | 발송 작업 상태 조회 |

자세한 요청 및 응답 정보는 [API 명세](./API.md)를 참고.

## 4. Automation

교육 데이터를 바탕으로 발송 대상을 생성하고 이메일·SMS 발송 및 결과 저장을 처리.

### 4.1 실행 진입점

| 파일 | 역할 |
|---|---|
| `src/01_Main.js` | 데이터 조회, 그룹화, 발송, 로그 저장까지 자동화 실행 |
| `app.js` | 예약 발송 스케줄러 실행 진입점 |
| `src/Services/00_Scheduler.js` | 정기 실행 시간 설정 및 발송 API 호출 |

### 4.2 Configs

| 파일 | 역할 |
|---|---|
| `Config.js` | 자동화 공통 설정 및 실행 기준 |
| `GmailConfig.js` | Gmail SMTP 관련 설정 |
| `MessageConfig.js` | 사업별 메시지 및 발송 설정 |
| `SheetConfig.js` | Google Sheets 및 컬럼 헤더 설정 |
| `SmsBody.js` | SMS 메시지 본문 구성 |

### 4.3 Services

| 파일 | 역할 |
|---|---|
| `SheetService.js` | Google Apps Script를 통한 교육 데이터 조회 |
| `GroupService.js` | GW·DS 사업별 교육 일정 그룹화 |
| `NotificationTargetService.js` | 그룹별 발송 대상 및 수신 정보 생성 |
| `NotificationService.js` | 사업 및 발송 채널에 따른 알림 처리 |
| `TemplateService.js` | 템플릿 변수 치환 및 메시지 생성 |
| `GmailService.js` | Gmail SMTP 이메일 발송 |
| `SmsService.js` | 뿌리오 API 인증 및 SMS/LMS 발송 |
| `LogService.js` | 발송 결과 로그 생성 및 일괄 저장 |

### 4.4 Utils

| 파일 | 역할 |
|---|---|
| `DataMapper.js` | 사업별 원본 데이터를 공통 객체 구조로 변환 |
| `Logger.js` | 자동화 실행 과정의 로그 출력 |

## 5. 외부 서비스 연동

| 서비스 | 연동 목적 |
|---|---|
| Google Sheets | 교육 운영 데이터 및 발송 로그 저장 |
| Google Apps Script | Google Sheets 조회·저장 API |
| Gmail SMTP | 이메일 발송 |
| 뿌리오 API | SMS/LMS 발송 |

## 6. 주요 처리 흐름

### 교육 데이터 조회

```text
React Page
    ↓
Frontend Service
    ↓
Express educationRoutes
    ↓
SheetService
    ↓
Google Apps Script
    ↓
Google Sheets
    ↓
DataMapper
    ↓
Frontend 화면 표시
```

### 이메일·문자 발송

```text
Frontend 발송 요청
    ↓
Express dispatchRoutes
    ↓
01_Main.js / runDispatch()
    ↓
SheetService
    ↓
GroupService
    ↓
NotificationTargetService
    ↓
NotificationService
    ├── GmailService
    └── SmsService
    ↓
LogService
    ↓
Google Apps Script
    ↓
Google Sheets 발송 로그
```

### 예약 발송

```text
app.js
    ↓
00_Scheduler.js
    ↓
Cron 실행 시간 도달
    ↓
GET /api/dispatch/settings
    ↓
POST /api/dispatch/run
    ↓
Express 발송 자동화 처리
```

---

## 참고 문서

- [프로젝트 README](../README.md)
- [API 명세](./API.md)
- [설치 및 실행 가이드](./SETUP.md)