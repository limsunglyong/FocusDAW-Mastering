/// <reference types="vite/client" />

// 빌드 시 vite.config 의 define 으로 주입되는 앱 버전(= package.json 의 version)
declare const __APP_VERSION__: string;
