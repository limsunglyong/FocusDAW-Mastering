import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
// FocusDAW Mastering Desk v0.1.2 (Phase 0) - 앱 버전 단일 출처화.
// package.json 의 version 을 빌드 시점에 __APP_VERSION__ 으로 주입 → src/version.ts 가 이를 읽는다.
// (electron-builder/electron-updater 도 동일한 package.json version 을 사용하므로 표시 버전과 릴리스 버전이 일치)
var require = createRequire(import.meta.url);
var pkg = require('./package.json');
export default defineConfig({
    base: './',
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
        port: 5173,
        open: false,
    },
});
