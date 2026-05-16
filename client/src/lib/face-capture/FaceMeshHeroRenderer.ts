// Rendu 3D hero onboarding — maillage filaire + surlignages métriques.

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {
  buildFaceMesh3DPositions,
  type BuildFaceMesh3DFrame,
  type HeroMetricHighlight,
} from './build-face-mesh-3d';
import {
  FACEMESH_LEFT_EYE_CANTHUS_LATERAL,
  FACEMESH_LEFT_EYE_CANTHUS_MEDIAL,
  FACEMESH_LEFT_EYE_ORDERED,
  FACEMESH_RIGHT_EYE_CANTHUS_LATERAL,
  FACEMESH_RIGHT_EYE_CANTHUS_MEDIAL,
  FACEMESH_RIGHT_EYE_ORDERED,
} from './facemesh-feature-contours';
import {
  FACEMESH_FACE_OVAL_JAW_LOWER_ARC_ORDERED,
  FACEMESH_FACE_OVAL_ORDERED,
} from './facemesh-face-oval';
import { FACEMESH_TESSELATION_TRIS } from './facemesh-tesselation-tris';
import type { LandmarkPoint } from './types';

const WIRE_OPACITY = 0.42;
const HIGHLIGHT_COLOR = 0x38bdf8;
const HIGHLIGHT_OPACITY = 0.92;

type HighlightChain = readonly number[];

function chainsForHighlight(highlight: HeroMetricHighlight): HighlightChain[] {
  switch (highlight) {
    case 'eyes':
      return [
        FACEMESH_RIGHT_EYE_ORDERED,
        FACEMESH_LEFT_EYE_ORDERED,
      ];
    case 'jaw':
      return [FACEMESH_FACE_OVAL_JAW_LOWER_ARC_ORDERED];
    case 'shape':
      return [FACEMESH_FACE_OVAL_ORDERED];
    default:
      return [];
  }
}

function segmentsForHighlight(highlight: HeroMetricHighlight): [number, number][] {
  if (highlight !== 'eyes') return [];
  return [
    [FACEMESH_RIGHT_EYE_CANTHUS_MEDIAL, FACEMESH_RIGHT_EYE_CANTHUS_LATERAL],
    [FACEMESH_LEFT_EYE_CANTHUS_MEDIAL, FACEMESH_LEFT_EYE_CANTHUS_LATERAL],
  ];
}

export class FaceMeshHeroRenderer {
  private static readonly MAX_PIXEL_RATIO = 1.5;
  /** Inclinaison de présentation (rad) : recule légèrement le front vers l’arrière. */
  private static readonly PRESENTATION_PITCH = -0.09;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private faceRoot: THREE.Group | null = null;
  private meshGeo: THREE.BufferGeometry | null = null;
  private meshMat: THREE.MeshBasicMaterial | null = null;
  private meshMesh: THREE.Mesh | null = null;
  private highlightGroup: THREE.Group | null = null;
  private readonly highlightLines: Line2[] = [];
  private highlightMat: LineMaterial | null = null;
  private _positions: Float32Array | null = null;
  private _posAttr: THREE.BufferAttribute | null = null;
  private _highlight = 'full' as HeroMetricHighlight;
  private _landmarks: LandmarkPoint[] | null = null;
  private _raf = 0;
  private _running = false;
  private _idleEnabled = true;
  private _dragYaw = 0;
  private _dragPitch = 0;
  private _time = 0;

  init(canvas: HTMLCanvasElement): void {
    const parent = canvas.parentElement;
    const w = Math.max(parent?.clientWidth ?? canvas.clientWidth, 2);
    const h = Math.max(parent?.clientHeight ?? canvas.clientHeight, 2);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, FaceMeshHeroRenderer.MAX_PIXEL_RATIO),
    );
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.01, 20);
    this.camera.position.set(0, 0, 2.35);
    this.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.55);
    key.position.set(0.4, 0.6, 1.2);
    this.scene.add(key);

    this.faceRoot = new THREE.Group();
    this.scene.add(this.faceRoot);

    this.meshGeo = new THREE.BufferGeometry();
    this.meshGeo.setIndex(FACEMESH_TESSELATION_TRIS);
    this.meshMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: WIRE_OPACITY,
      side: THREE.DoubleSide,
      depthTest: true,
    });
    this.meshMesh = new THREE.Mesh(this.meshGeo, this.meshMat);
    this.faceRoot.add(this.meshMesh);

    this.highlightGroup = new THREE.Group();
    this.faceRoot.add(this.highlightGroup);

    this.highlightMat = new LineMaterial({
      color: HIGHLIGHT_COLOR,
      linewidth: 3.5,
      transparent: true,
      opacity: HIGHLIGHT_OPACITY,
      depthTest: true,
      resolution: new THREE.Vector2(w, h),
    });
  }

  setLandmarks(landmarks: LandmarkPoint[], frame?: BuildFaceMesh3DFrame): void {
    this._landmarks = landmarks;
    const built = buildFaceMesh3DPositions(landmarks, frame);
    if (!built || !this.meshGeo) return;

    const need = built.positions.length;
    if (!this._positions || this._positions.length !== need) {
      this._positions = built.positions;
      this._posAttr = new THREE.BufferAttribute(this._positions, 3);
      this.meshGeo.setAttribute('position', this._posAttr);
    } else {
      this._positions.set(built.positions);
      this._posAttr!.needsUpdate = true;
    }
    this.meshGeo.setDrawRange(0, FACEMESH_TESSELATION_TRIS.length);
    this._rebuildHighlights();
    this._fitMeshToView();
  }

  setHighlight(highlight: HeroMetricHighlight): void {
    if (this._highlight === highlight) return;
    this._highlight = highlight;
    this._rebuildHighlights();
  }

  setIdleEnabled(enabled: boolean): void {
    this._idleEnabled = enabled;
  }

  setDragRotation(yawRad: number, pitchRad: number): void {
    this._dragYaw = yawRad;
    this._dragPitch = pitchRad;
  }

  resize(w: number, h: number): void {
    if (!this.renderer || !this.camera || w <= 0 || h <= 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.highlightMat) {
      this.highlightMat.resolution.set(w, h);
    }
    this._fitMeshToView();
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._time = performance.now();
    const tick = () => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(tick);
      this._renderFrame();
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  /** Recule la caméra pour cadrer le maillage (largeur + hauteur) sans déformer les proportions. */
  private _fitMeshToView(): void {
    if (!this._positions || !this.camera) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < this._positions.length; i += 3) {
      const x = this._positions[i]!;
      const y = this._positions[i + 1]!;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const width = maxX - minX;
    const height = maxY - minY;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 1e-4 ||
      height < 1e-4
    ) {
      return;
    }

    const fovRad = (this.camera.fov * Math.PI) / 180;
    const distV = (height / 2 / Math.tan(fovRad / 2)) * 1.18;
    const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * this.camera.aspect);
    const distH = (width / 2 / Math.tan(hFov / 2)) * 1.18;
    const dist = Math.max(distV, distH, 1.85);
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
  }

  private _renderFrame(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.faceRoot) return;

    const t = (performance.now() - this._time) * 0.001;
    const idleY = this._idleEnabled ? Math.sin(t * 0.55) * 0.1 : 0;
    const idleX = this._idleEnabled ? Math.sin(t * 0.38) * 0.018 : 0;

    this.faceRoot.rotation.y = this._dragYaw + idleY;
    this.faceRoot.rotation.x =
      this._dragPitch +
      idleX +
      FaceMeshHeroRenderer.PRESENTATION_PITCH;
    this.faceRoot.rotation.z = 0;

    this.renderer.render(this.scene, this.camera);
  }

  private _rebuildHighlights(): void {
    if (!this.highlightGroup || !this._positions || !this.highlightMat || !this._landmarks) {
      return;
    }

    for (const line of this.highlightLines) {
      this.highlightGroup.remove(line);
      line.geometry.dispose();
    }
    this.highlightLines.length = 0;

    const highlight = this._highlight;
    if (highlight === 'full') return;

    const pos = this._positions;
    const lmCount = this._landmarks.length;

    const pointAt = (idx: number): [number, number, number] | null => {
      if (idx < 0 || idx >= lmCount) return null;
      const i = idx * 3;
      return [pos[i]!, pos[i + 1]!, pos[i + 2]!];
    };

    const addLine = (coords: number[]) => {
      if (coords.length < 6) return;
      const geo = new LineGeometry();
      geo.setPositions(coords);
      const line = new Line2(geo, this.highlightMat!);
      line.renderOrder = 2;
      this.highlightGroup!.add(line);
      this.highlightLines.push(line);
    };

    for (const chain of chainsForHighlight(highlight)) {
      const coords: number[] = [];
      for (const idx of chain) {
        const p = pointAt(idx);
        if (!p) {
          coords.length = 0;
          break;
        }
        coords.push(p[0], p[1], p[2]);
      }
      if (coords.length >= 6) {
        const first = pointAt(chain[0]!);
        if (first && highlight === 'shape') {
          coords.push(first[0], first[1], first[2]);
        }
        addLine(coords);
      }
    }

    for (const [a, b] of segmentsForHighlight(highlight)) {
      const pa = pointAt(a);
      const pb = pointAt(b);
      if (pa && pb) addLine([...pa, ...pb]);
    }
  }

  dispose(): void {
    this.stop();
    for (const line of this.highlightLines) {
      line.geometry.dispose();
    }
    this.highlightLines.length = 0;
    this.highlightMat?.dispose();
    this.highlightMat = null;
    this.meshGeo?.dispose();
    this.meshMat?.dispose();
    this.meshGeo = null;
    this.meshMat = null;
    this.meshMesh = null;
    this.highlightGroup = null;
    this.faceRoot = null;
    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this._positions = null;
    this._posAttr = null;
    this._landmarks = null;
  }
}
