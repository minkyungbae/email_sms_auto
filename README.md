```
email_sms_auto/
│
├── README.md
├── app.js                         # 기존 자동화 프로젝트
│
└── google-sheet-reader/
    │
    ├── Frontend/                  # React 프론트엔드
    │   ├── .env.local             # 프론트 API 주소 설정
    │   ├── package.json           # 프론트 패키지
    │   └── src/
    │       ├── Configs/
    │       │   └── api.ts
    │       ├── Pages/
    │       │   └── Dashboard.tsx
    │       ├── Services/
    │       │   └── EducationService.ts
    │       ├── Types/
    │       │   └── education.ts
    │       ├── Utils/
    │       ├── App.tsx
    │       ├── App.css
    │       └── index.css
    │
    ├── routes/                    # Node.js API 라우터
    │   └── educationRoutes.js
    │
    ├── server.js                  # Node.js 서버 진입점
    ├── .env                       # 백엔드 환경변수
    ├── package.json               # 백엔드 패키지
    │
    └── src/                       # 기존 백엔드 로직
        ├── 01_Main.js
        ├── Configs/
        │   ├── Config.js
        │   ├── GmailConfig.js
        │   ├── MessageConfig.js
        │   └── SheetConfig.js
        ├── Services/
        │   ├── GmailService.js
        │   ├── GroupService.js
        │   ├── LogService.js
        │   ├── NotificationService.js
        │   ├── NotificationTargetService.js
        │   ├── SheetService.js
        │   ├── SmsService.js
        │   └── TemplateService.js
        └── Utils/
            ├── DataMapper.js
            └── Logger.js
```