// FocusDAW Mastering Desk v0.2.0 (Phase 1) - 파일 선택 다이얼로그 헬퍼
// 숨김 <input> 기반. Electron 렌더러에서도 동작하며 별도 IPC 없이 File 객체를 얻는다.
//  - Files 모드: 다중 파일 선택(미지원 확장자도 그대로 반환 → 로딩 단계에서 에러 표시)
//  - Folder 모드: webkitdirectory 로 폴더(하위 포함) 스캔 → 오디오 확장자만 필터(Recursive 충족)
// v0.1.4: 폴더 드래그&드롭 지원(webkitGetAsEntry 재귀 순회), 명시적 선택은 사전 필터 제거(MT-5).
import { ACCEPT_ATTR, isAcceptedAudioFile } from './decoder';

/**
 * 파일/폴더 선택 다이얼로그를 열어 File 목록을 반환 (취소 시 빈 배열)
 * @param opts.recursive 폴더 모드에서 하위 폴더 포함 여부(Sub Folder=true / Root=false). 기본 true.
 */
export function openAudioFilePicker(opts?: { directory?: boolean; recursive?: boolean }): Promise<File[]> {
  const recursive = opts?.recursive ?? true;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (opts?.directory) {
      // webkitdirectory: 폴더 전체(하위 포함) 선택. Root 모드면 최상위 파일만 필터.
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    } else {
      input.accept = ACCEPT_ATTR;
    }
    input.style.display = 'none';
    let settled = false;

    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      resolve(files);
      input.remove();
    };

    input.addEventListener('change', () => {
      const all = input.files ? Array.from(input.files) : [];
      if (!opts?.directory) {
        // 명시적 파일 선택은 미지원 파일도 그대로 전달 → 로딩 단계에서 에러를 보여준다(MT-5).
        finish(all);
        return;
      }
      // 폴더 스캔: 오디오만 필터. Root 모드면 최상위 폴더 파일만(상대경로 깊이 2: "<folder>/<file>").
      const audio = all.filter((f) => isAcceptedAudioFile(f.name));
      finish(recursive ? audio : audio.filter((f) => (f.webkitRelativePath || '').split('/').length <= 2));
    });
    // 다이얼로그를 닫아 취소한 경우(브라우저별 best-effort)
    window.addEventListener('focus', () => { setTimeout(() => finish([]), 400); }, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * DataTransfer(드래그&드롭)에서 File 목록을 추출.
 *  - 개별 파일 드롭: 미지원 파일도 포함(에러 표시 목적)
 *  - 폴더 드롭: webkitGetAsEntry 로 오디오 수집. recursive=true(Sub Folder)면 하위까지, false(Root)면 최상위만.
 * webkitGetAsEntry 는 드롭 이벤트 동안 동기적으로 호출해야 하므로 엔트리를 먼저 캡처한다.
 * @param recursive 드롭된 폴더의 하위 폴더 포함 여부. 기본 true.
 */
export async function audioFilesFromDataTransfer(dt: DataTransfer | null, recursive = true): Promise<File[]> {
  if (!dt) return [];

  // 엔트리는 await 이전에 동기 캡처(이벤트 종료 후 DataTransferItem 무효화 방지)
  const items = dt.items ? Array.from(dt.items) : [];
  const entries = items
    .filter((it) => it.kind === 'file')
    .map((it) => (typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null));

  if (entries.some((e) => e)) {
    const out: File[] = [];
    for (const entry of entries) {
      if (!entry) continue;
      if (entry.isFile) {
        const f = await fileFromEntry(entry as FileSystemFileEntry);
        if (f) out.push(f); // 개별 파일은 미지원도 포함
      } else if (entry.isDirectory) {
        await collectDir(entry as FileSystemDirectoryEntry, out, recursive); // 폴더는 오디오만
      }
    }
    return out;
  }

  // 폴백: 엔트리 API 미지원 환경의 평면 파일 목록
  return dt.files ? Array.from(dt.files) : [];
}

function fileFromEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((res) => entry.file((f) => res(f), () => res(null)));
}

async function collectDir(dir: FileSystemDirectoryEntry, out: File[], recursive: boolean): Promise<void> {
  const reader = dir.createReader();
  // readEntries 는 한 번에 일부만 반환하므로 빌 때까지 반복 호출한다.
  const readBatch = (): Promise<FileSystemEntry[]> =>
    new Promise((res) => reader.readEntries((e) => res(e), () => res([])));

  let batch = await readBatch();
  while (batch.length) {
    for (const ent of batch) {
      if (ent.isFile) {
        const f = await fileFromEntry(ent as FileSystemFileEntry);
        if (f && isAcceptedAudioFile(f.name)) out.push(f);
      } else if (ent.isDirectory && recursive) {
        await collectDir(ent as FileSystemDirectoryEntry, out, recursive);
      }
    }
    batch = await readBatch();
  }
}
