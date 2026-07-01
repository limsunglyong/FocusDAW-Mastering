// FocusDAW Mastering Desk v0.1.0 (Phase 0) - Electron 실행 런처
// 일부 환경에는 ELECTRON_RUN_AS_NODE=1 이 설정돼 있어 `electron .` 가 일반 Node 처럼 동작하며
// 메인 프로세스의 app 객체가 undefined 가 된다. 여기서 해당 변수를 제거한 깨끗한 env 로 electron 을 띄운다.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronPath = require('electron'); // electron 실행 파일 절대경로(string)

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const requestedArgs = process.argv.slice(2);
const electronArgs = requestedArgs[0] === '--script'
  ? requestedArgs.slice(1)
  : ['.', ...requestedArgs];
const child = spawn(electronPath, electronArgs, {
  stdio: 'inherit',
  env,
});

child.on('close', (code) => process.exit(code ?? 0));
