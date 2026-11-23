# 설치 및 실행 가이드

이 문서는 프로젝트의 로컬 개발 환경 구성과 실행 방법을 설명합니다.

## 1. 실행 환경

| 항목 | 요구 사항 |
|---|---|
| Node.js | 18 이상 권장 |
| 패키지 관리자 | npm |
| 데이터 저장소 | Google Sheets |
| 데이터 연동 | Google Apps Script |
| 이메일 발송 | Gmail SMTP 계정 및 앱 비밀번호 |
| 문자 발송 | 뿌리오 API 계정 및 인증 정보 |

프론트엔드와 백엔드는 별도 디렉터리에서 패키지를 설치하고 실행.

## 2. 저장소 복제

```bash
git clone <repository-url>
cd email_sms_auto/google-sheet-reader
```

`<repository-url>`에는 실제 Git 저장소 주소를 입력.

## 3. 백엔드 패키지 설치

`google-sheet-reader` 디렉터리에서 실행.

```bash
npm install
```

예약 발송 스케줄러를 사용하는 경우 `node-cron`을 설치.

```bash
npm install node-cron@^3.0.3
```

## 4. 프론트엔드 패키지 설치

```bash
cd Frontend
npm install
```

## 5. 환경변수 설정

### 5.1 백엔드

`google-sheet-reader/.env` 파일을 생성.

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

GW_APPS_SCRIPT_URL=
DS_APPS_SCRIPT_URL=
LOG_APPS_SCRIPT_URL=
LOG_API_TOKEN=

GMAIL_USER=
GMAIL_APP_PASSWORD=
```

| 변수 | 설명 |
|---|---|
| `PORT` | Express API 서버 포트 |
| `FRONTEND_URL` | CORS에서 허용할 프론트엔드 주소 |
| `GW_APPS_SCRIPT_URL` | GW 교육 데이터 조회용 Apps Script 웹 앱 URL |
| `DS_APPS_SCRIPT_URL` | DS 교육 데이터 조회용 Apps Script 웹 앱 URL |
| `LOG_APPS_SCRIPT_URL` | 발송 로그 저장·조회용 Apps Script 웹 앱 URL |
| `LOG_API_TOKEN` | 로그 Apps Script 요청 인증 토큰 |
| `GMAIL_USER` | Gmail 발송 계정 |
| `GMAIL_APP_PASSWORD` | Gmail 앱 비밀번호 |

### 5.2 프론트엔드

`google-sheet-reader/Frontend/.env.local` 파일을 생성.

```env
VITE_API_BASE_URL=http://localhost:3000
```

| 변수 | 설명 |
|---|---|
| `VITE_API_BASE_URL` | 프론트엔드에서 요청할 백엔드 API 기본 주소 |

## 6. 비공개 설정 파일

자동화 모듈은 프로젝트 루트의 `security_info.js`에서 민감 정보를 불러옴.

```text
email_sms_auto/
├── security_info.js
├── app.js
└── google-sheet-reader/
```

해당 파일에는 실제 코드에서 참조하는 테스트 수신자 정보, 스프레드시트 ID, 뿌리오 API 인증 정보, 사업별 연락처 링크 등의 비공개 설정이 포함됨.

정확한 필드명과 export 구조는 프로젝트 코드에서 사용하는 형식을 따라야 함. 이 파일은 공개 저장소에 업로드하지 않음.

## 7. Google Apps Script 설정

| 용도 | 설정 |
|---|---|
| GW 교육 데이터 조회 | 웹 앱 배포 URL을 `GW_APPS_SCRIPT_URL`에 등록 |
| DS 교육 데이터 조회 | 웹 앱 배포 URL을 `DS_APPS_SCRIPT_URL`에 등록 |
| 발송 로그 저장·조회 | 웹 앱 배포 URL을 `LOG_APPS_SCRIPT_URL`에 등록 |

추가 확인 사항:

1. Apps Script가 대상 스프레드시트에 접근할 수 있도록 권한을 설정.
2. 로그 Apps Script의 스크립트 속성에 인증 토큰을 설정.
3. Node.js의 `LOG_API_TOKEN`과 Apps Script의 토큰 값이 일치하는지 확인.
4. 로그 스프레드시트 ID는 비공개 설정에서 관리.
5. Apps Script 배포 권한과 스프레드시트 접근 권한을 확인.

## 8. 백엔드 API 서버 실행

`google-sheet-reader` 디렉터리에서 실행.

```bash
npm run server
```

기본 주소는 `http://localhost:3000`

서버 상태 확인:

```text
http://localhost:3000/api/health
```

## 9. 프론트엔드 개발 서버 실행

`google-sheet-reader/Frontend` 디렉터리에서 실행.

```bash
npm run dev
```

Vite 기본 개발 주소는 `http://localhost:5173`

프론트엔드와 백엔드 개발 서버는 별도 프로세스이므로 각각 실행해야 함.

## 10. 예약 발송 스케줄러 실행

예약 발송은 프로젝트 최상위 `app.js`에서 `google-sheet-reader/src/Services/00_Scheduler.js`를 불러오는 구조.

### 10.1 package.json 설정

`google-sheet-reader/package.json`의 `scripts`에 다음 항목을 추가.

```json
{
  "scheduler": "node ../app.js"
}
```

기존 `scripts` 항목은 유지하고 `scheduler`만 추가.

### 10.2 스케줄러 실행

`google-sheet-reader` 디렉터리에서 실행.

```bash
npm run scheduler
```

| 항목 | 설정 |
|---|---|
| 실행 주기 | 매일 오전 10시 |
| 시간대 | `Asia/Seoul` |
| Cron 표현식 | `0 10 * * *` |
| 발송 설정 조회 | `GET /api/dispatch/settings` |
| 발송 실행 | `POST /api/dispatch/run` |

스케줄러는 Express API 서버를 호출하므로 API 서버도 실행 중이어야 함.

### 10.3 실행 프로세스

| 터미널 | 실행 위치 | 명령어 | 역할 |
|---|---|---|---|
| 1번 | `google-sheet-reader` | `npm run server` | Express API 서버 |
| 2번 | `google-sheet-reader` | `npm run scheduler` | 예약 발송 스케줄러 |
| 3번 | `google-sheet-reader/Frontend` | `npm run dev` | React 개발 서버 |

> 스케줄러는 Node.js 프로세스가 실행 중일 때만 동작. PC 종료, 절전 또는 프로세스 중단 시 예약 실행이 누락될 수 있으며, 현재 누락된 예약을 자동 보충하는 기능은 없음.

## 11. 자동화 프로그램 단독 실행

웹 화면을 통하지 않고 `src/01_Main.js`를 직접 실행할 수 있음.

`google-sheet-reader` 디렉터리에서 실행.

```bash
npm start
```

실제 이메일 또는 문자가 발송될 수 있으므로 테스트 모드, 수신 대상, 사업 유형 및 발송 기준일을 먼저 확인.

## 12. 프론트엔드 검사 및 빌드

`google-sheet-reader/Frontend` 디렉터리에서 실행.

```bash
npm run lint
npm run build
```

## 13. 실행 전 확인 사항

- [ ] 백엔드 및 프론트엔드 패키지 설치
- [ ] `.env` 및 `.env.local` 생성
- [ ] `security_info.js` 구성
- [ ] Apps Script 웹 앱 배포 및 URL 등록
- [ ] Google Sheets 접근 권한 확인
- [ ] Gmail SMTP 및 뿌리오 API 설정 확인
- [ ] 테스트 모드 및 테스트 수신자 확인
- [ ] API 서버 정상 실행 확인
- [ ] 예약 발송 사용 시 스케줄러 실행 확인

---

실제 운영 환경에서는 테스트 수신자와 발송 기준일을 먼저 확인한 뒤 발송 기능을 사용. 민감 정보가 포함된 설정 파일과 실제 교육 데이터는 공개 저장소에 포함하지 않음.
