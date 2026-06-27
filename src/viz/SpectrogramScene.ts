// FocusDAW Mastering Desk v0.2.26 (Phase 2) - Three.js 스펙트로그램 씬
// _refer/FocusSpectogram/src/viz/SpectrogramScene.ts 트림 이식.
// 포함: scene/camera/renderer/OrbitControls + 서피스 메쉬 + 그리드 + 축 + resetView.
// 제외(범위 한정): EQ 오버레이·플레이헤드·LUFS 평면·noise 하이라이트·정사영 토글·카메라 동기화.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Spectrogram } from '../audio/stft';
import { buildSpectrogramGeometry, SURFACE_DIMENSIONS } from './surface';
import { buildAxes } from './axes';

// 뷰 리셋용 기본 카메라 상태(서피스 60% 축소에 맞춰 거리도 축소)
const DEFAULT_CAM_POS = new THREE.Vector3(54, 42, 54);
const DEFAULT_TARGET = new THREE.Vector3(0, SURFACE_DIMENSIONS.HEIGHT * 0.3, 0);

export class SpectrogramScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private mesh: THREE.Mesh | null = null;
  private axisGroup: THREE.Group | null = null;
  private disposeAxes: (() => void) | null = null;
  private frameId = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x031716);

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 4000);
    this.camera.position.copy(DEFAULT_CAM_POS);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.copy(DEFAULT_TARGET);
    this.controls.update();

    // 조명 (vertexColors 기반이지만 normals 음영용으로 약하게)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(60, 120, 40);
    this.scene.add(dir);

    this.addGrid();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  private addGrid() {
    const { WIDTH, DEPTH } = SURFACE_DIMENSIONS;
    const grid = new THREE.GridHelper(Math.max(WIDTH, DEPTH), 20, 0x10b981, 0x0e4b48);
    (grid.material as THREE.Material).opacity = 0.25;
    (grid.material as THREE.Material).transparent = true;
    grid.position.y = 0;
    this.scene.add(grid);
  }

  /** 스펙트로그램 교체 (null이면 메쉬/축 제거) */
  setSpectrogram(spec: Spectrogram | null) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this.axisGroup) {
      this.scene.remove(this.axisGroup);
      this.disposeAxes?.();
      this.axisGroup = null;
      this.disposeAxes = null;
    }
    if (!spec || spec.frames === 0) return;

    const { geometry } = buildSpectrogramGeometry(spec);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.6,
      metalness: 0.1,
      flatShading: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    const { group, dispose } = buildAxes(SURFACE_DIMENSIONS, {
      duration: spec.frames * spec.timeStep,
      maxFreq: spec.bins * spec.freqStep,
      maxDb: spec.maxDb,
    });
    this.axisGroup = group;
    this.disposeAxes = dispose;
    this.scene.add(group);
  }

  /** 카메라/타깃을 기본 뷰로 복원 (Reset View 버튼) */
  resetView() {
    this.camera.position.copy(DEFAULT_CAM_POS);
    this.controls.target.copy(DEFAULT_TARGET);
    this.controls.update();
  }

  private onResize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    this.frameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.setSpectrogram(null);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
