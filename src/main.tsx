import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyTheme, DEFAULT_THEME } from './theme/themes';

// 초기 테마 주입(첫 페인트 전 CSS 변수 세팅)
applyTheme(DEFAULT_THEME);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
