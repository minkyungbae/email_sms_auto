/**
 * @file vite.config.ts
 * @author 배민경
 * @description Vite 개발 서버 및 빌드 설정
 */

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// =============================================================
// 1. Vite 개발 서버 설정
// =============================================================
export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',

    // Cloudflare 임시 터널 접속 허용
    allowedHosts: [
      'ann-bid-high-founded.trycloudflare.com', // 재배포 할 때마다 수정 필요
    ],
  },
})
