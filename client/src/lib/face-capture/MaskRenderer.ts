// ============================================================
// MaskRenderer — Tessellation intérieure (discrete, peu opaque) + contours
// (lèvres, yeux, bas du nez) + ovale extérieur.
// Landmarks alignés sur object-fit: cover comme la vidéo.
// ============================================================
//
// Coordinates: normalized to video bitmap (videoWidth × videoHeight), then to
// overlay pixels like the <video> element. WebGL backing store syncs each frame
// so layout after React mount stays correct.

import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { LandmarkPoint } from './types';
import { FACEMESH_FEATURE_CONTOURS_ORDERED } from './facemesh-feature-contours';
import { FACEMESH_TESSELATION_TRIS } from './facemesh-tesselation-tris';

/** Opacité du maillage intérieur vs traits saillants (~30 % des contours). */
const INNER_MESH_OPACITY_FACTOR = 0.3;

/**
 * Contour visage MediaPipe — ordre cyclique (front → tempes → mâchoire → menton).
 * Utilisé pour le trait extérieur épais (sans réordonner via Set).
 */
const FACEMESH_FACE_OVAL_ORDERED: number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176,
  149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

/**
 * Map normalized landmark in video bitmap space to overlay element CSS pixels,
 * matching object-fit: cover (same math as painting the video into the box).
 */
function videoNormToElementPx(
  nx: number,
  ny: number,
  videoW: number,
  videoH: number,
  elW: number,
  elH: number,
): { x: number; y: number } {
  const scale = Math.max(elW / videoW, elH / videoH);
  const offsetX = (elW - videoW * scale) * 0.5;
  const offsetY = (elH - videoH * scale) * 0.5;
  const px = nx * videoW * scale + offsetX;
  const py = ny * videoH * scale + offsetY;
  return { x: px, y: py };
}

/** Write DOM-oriented pixel in element → NDC (y-up) into out xyz */
function elementPxToNdcOut(
  px: number,
  py: number,
  elW: number,
  elH: number,
  out: { x: number; y: number; z: number },
): void {
  out.x = (px / elW) * 2 - 1;
  out.y = -((py / elH) * 2 - 1);
  out.z = 0;
}

export class MaskRenderer {
  private static readonly MAX_OVERLAY_PIXEL_RATIO = 1.25;

  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.OrthographicCamera | null = null;
  private overlay: HTMLCanvasElement | null = null;

  private meshGeo: THREE.BufferGeometry | null = null;
  private meshMat: THREE.MeshBasicMaterial | null = null;
  private meshMesh: THREE.Mesh | null = null;

  private featureLineMat: LineMaterial | null = null;
  private readonly _featureLines: { geo: LineGeometry; line: Line2 }[] = [];

  private ovalGeo: LineGeometry | null = null;
  private ovalMat: LineMaterial | null = null;
  private ovalLine: Line2 | null = null;

  /** Holding-state scan bar (clipped to the face oval at runtime). */
  private scanMat: THREE.MeshBasicMaterial | null = null;
  private scanGlowMat: THREE.MeshBasicMaterial | null = null;
  private scanMesh: THREE.Mesh | null = null;
  private scanGlowMesh: THREE.Mesh | null = null;

  private _alignmentQuality = 0;
  private _lastBufferW = 0;
  private _lastBufferH = 0;
  private _resizeObserver: ResizeObserver | null = null;

  /** Réutilisation buffers par contour (tailles fixes connues à l’init). */
  private _featurePosBuffers: Float32Array[] = [];
  private _meshPos: Float32Array | null = null;
  private _meshPosAttr: THREE.BufferAttribute | null = null;
  private _ovalPos: Float32Array | null = null;
  private readonly _meshColor = new THREE.Color();
  private readonly _ovalColor = new THREE.Color();
  private readonly _ndcScratch = { x: 0, y: 0, z: 0 };

  init(overlayCanvas: HTMLCanvasElement): void {
    this.overlay = overlayCanvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas: overlayCanvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, MaskRenderer.MAX_OVERLAY_PIXEL_RATIO),
    );

    const cw = Math.max(overlayCanvas.clientWidth, 2);
    const ch = Math.max(overlayCanvas.clientHeight, 2);
    this.renderer.setSize(cw, ch, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.set(0, 0, 1);

    this.renderer.sortObjects = false;
    this._lastBufferW = cw;
    this._lastBufferH = ch;

    /**
     * Watch the canvas's own CSS box for layout changes (rotation, address bar
     * collapse, parent resize, panel collapse...). Without this, `_syncCanvasSize`
     * only reacts inside `render()` using the values its caller passes in — if
     * those drift from the canvas's actual box, the mesh is composited at the
     * wrong scale and ends up offset.
     */
    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(() => {
        if (!this.overlay) return;
        this._syncCanvasSize(this.overlay.clientWidth, this.overlay.clientHeight);
      });
      this._resizeObserver.observe(overlayCanvas);
    }

    this._buildGeometries();
  }

  private _buildGeometries(): void {
    if (!this.scene || !this.overlay) return;

    this.meshGeo = new THREE.BufferGeometry();
    this.meshGeo.setIndex(FACEMESH_TESSELATION_TRIS);
    this.meshMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      wireframe: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    this.meshMesh = new THREE.Mesh(this.meshGeo, this.meshMat);
    this.meshMesh.renderOrder = 0;
    this.scene.add(this.meshMesh);

    this.featureLineMat = new LineMaterial({
      color: 0xffffff,
      linewidth: 3.0,
      transparent: true,
      opacity: 0.88,
      depthTest: false,
      depthWrite: false,
      resolution: new THREE.Vector2(this.overlay.clientWidth, this.overlay.clientHeight),
    });

    for (let i = 0; i < FACEMESH_FEATURE_CONTOURS_ORDERED.length; i++) {
      const ordered = FACEMESH_FEATURE_CONTOURS_ORDERED[i]!;
      const nPts = ordered.length;
      this._featurePosBuffers[i] = new Float32Array(nPts * 3);
      const geo = new LineGeometry();
      const line = new Line2(geo, this.featureLineMat);
      line.renderOrder = 1;
      this.scene.add(line);
      this._featureLines.push({ geo, line });
    }

    this.ovalGeo = new LineGeometry();
    this.ovalMat = new LineMaterial({
      color: 0xffffff,
      linewidth: 4.125,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
      resolution: new THREE.Vector2(this.overlay.clientWidth, this.overlay.clientHeight),
    });
    this.ovalLine = new Line2(this.ovalGeo, this.ovalMat);
    this.ovalLine.renderOrder = 2;
    this.scene.add(this.ovalLine);

    /**
     * Scan bar: thin plane (emerald) clipped to the face silhouette.
     * `scanGlowMesh` is a wider semi-transparent halo.
     */
    const scanGeo = new THREE.PlaneGeometry(1, 1);
    this.scanGlowMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.35,
      depthTest: false,
      depthWrite: false,
    });
    this.scanGlowMesh = new THREE.Mesh(scanGeo, this.scanGlowMat);
    this.scanGlowMesh.renderOrder = 6;
    this.scanGlowMesh.visible = false;
    this.scene.add(this.scanGlowMesh);

    this.scanMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: false,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    });
    this.scanMesh = new THREE.Mesh(scanGeo, this.scanMat);
    this.scanMesh.renderOrder = 7;
    this.scanMesh.visible = false;
    this.scene.add(this.scanMesh);
  }

  /**
   * Keep WebGL backing store in sync with layout (fixes 0×0 init + resize).
   */
  private _syncCanvasSize(elW: number, elH: number): void {
    if (!this.renderer) return;
    if (elW <= 0 || elH <= 0) return;

    const w = Math.round(elW);
    const h = Math.round(elH);
    if (w !== this._lastBufferW || h !== this._lastBufferH) {
      this.renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, MaskRenderer.MAX_OVERLAY_PIXEL_RATIO),
      );
      this.renderer.setSize(w, h, false);
      this._lastBufferW = w;
      this._lastBufferH = h;
    }
  }

  resize(w: number, h: number): void {
    if (!this.renderer) return;
    if (w <= 0 || h <= 0) return;
    this._syncCanvasSize(w, h);
  }

  setAlignmentQuality(q: number): void {
    this._alignmentQuality = q;
  }

  /**
   * @param videoW videoWidth / intrinsic frame width fed to MediaPipe
   * @param videoH videoHeight / intrinsic frame height
   * @param elW clientWidth of the overlay (= video element box)
   * @param elH clientHeight
   * @param opts.holdingProgress when defined, draws a light-blue scan bar at
   *   y = lerp(faceTop, faceBottom, progress), with width clipped to the
   *   actual face oval at that y (intersection-based, not bounding box).
   */
  render(
    landmarks: LandmarkPoint[],
    videoW: number,
    videoH: number,
    _elW: number,
    _elH: number,
    opts?: { holdingProgress?: number },
  ): void {
    if (!this.scene || !this.overlay || !this.renderer || !this.camera) return;
    if (landmarks.length < 3) return;
    /**
     * Single source of truth for the rendering box: the canvas's own CSS
     * dimensions. We deliberately ignore the caller-passed `_elW`/`_elH`
     * (typically `videoEl.clientWidth`) because the canvas is the actual
     * compositing target — any drift between those two boxes (different
     * Tailwind utilities, intrinsic 300×150 attributes, layout race) would
     * shift the mesh horizontally even with otherwise-correct math.
     */
    const elW = this.overlay.clientWidth;
    const elH = this.overlay.clientHeight;
    if (elW <= 0 || elH <= 0 || videoW <= 0 || videoH <= 0) return;

    if (this.meshMesh) {
      this.meshMesh.visible = true;
    }
    if (this.meshMat) {
      this.meshMat.wireframe = true;
    }
    for (const { line } of this._featureLines) {
      line.visible = true;
    }
    if (this.ovalLine) {
      this.ovalLine.visible = true;
    }

    this._syncCanvasSize(elW, elH);

    const q = this._alignmentQuality;

    const lineOpacity = 0.48 + q * 0.47;
    /** Traits lèvres / yeux / nez */
    const featureOpacity = Math.min(1, lineOpacity * 0.85 + 0.1);
    /** contour ovale visage */
    const rimOpacity = Math.min(1, lineOpacity * 0.88 + 0.12);
    /** Maillage intérieur : plus discret que les contours (WebGL fil ~1 px). */
    const meshOpacity = Math.min(1, featureOpacity * INNER_MESH_OPACITY_FACTOR);
    this._meshColor.setRGB(1, 1, 1);
    this._ovalColor.copy(this._meshColor);

    let bboxMinY = Infinity;
    let bboxMaxY = -Infinity;
    if (this.meshGeo && this.meshMesh && this.meshMat) {
      const need = landmarks.length * 3;
      if (!this._meshPos || this._meshPos.length !== need) {
        this._meshPos = new Float32Array(need);
        this._meshPosAttr = new THREE.BufferAttribute(this._meshPos, 3);
        this.meshGeo.setAttribute('position', this._meshPosAttr);
      }
      const pos = this._meshPos!;
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i]!;
        const { x: px, y: py } = videoNormToElementPx(lm.x, lm.y, videoW, videoH, elW, elH);
        const ndcX = (px / elW) * 2 - 1;
        const ndcY = -((py / elH) * 2 - 1);
        pos[i * 3] = ndcX;
        pos[i * 3 + 1] = ndcY;
        pos[i * 3 + 2] = 0;
        if (ndcY < bboxMinY) bboxMinY = ndcY;
        if (ndcY > bboxMaxY) bboxMaxY = ndcY;
      }
      this._meshPosAttr!.needsUpdate = true;
      this.meshGeo.setDrawRange(0, FACEMESH_TESSELATION_TRIS.length);
      this.meshMat.color.copy(this._meshColor);
      this.meshMat.opacity = meshOpacity;
    }

    if (this.featureLineMat) {
      this.featureLineMat.color.copy(this._ovalColor);
      this.featureLineMat.opacity = featureOpacity;
    }

    for (let fi = 0; fi < this._featureLines.length; fi++) {
      const { geo, line } = this._featureLines[fi]!;
      const ordered = FACEMESH_FEATURE_CONTOURS_ORDERED[fi]!;
      const buf = this._featurePosBuffers[fi]!;
      let ok = true;
      for (let j = 0; j < ordered.length; j++) {
        const idx = ordered[j]!;
        const lm = landmarks[idx];
        if (!lm) {
          ok = false;
          break;
        }
        const { x: px, y: py } = videoNormToElementPx(lm.x, lm.y, videoW, videoH, elW, elH);
        elementPxToNdcOut(px, py, elW, elH, this._ndcScratch);
        buf[j * 3] = this._ndcScratch.x;
        buf[j * 3 + 1] = this._ndcScratch.y;
        buf[j * 3 + 2] = this._ndcScratch.z;
      }
      if (ok) {
        geo.setPositions(buf);
      } else {
        line.visible = false;
      }
    }

    if (this.featureLineMat && this.renderer) {
      const dw = this.renderer.domElement.width;
      const dh = this.renderer.domElement.height;
      if (dw > 0 && dh > 0) {
        this.featureLineMat.resolution.set(dw, dh);
      }
    }

    if (this.ovalGeo && this.ovalLine && this.ovalMat && this.renderer) {
      const n = FACEMESH_FACE_OVAL_ORDERED.length;
      const need = (n + 1) * 3;
      if (!this._ovalPos || this._ovalPos.length !== need) {
        this._ovalPos = new Float32Array(need);
      }
      const op = this._ovalPos;
      let ok = true;
      for (let i = 0; i < n; i++) {
        const idx = FACEMESH_FACE_OVAL_ORDERED[i]!;
        const lm = landmarks[idx];
        if (!lm) {
          ok = false;
          break;
        }
        const { x: px, y: py } = videoNormToElementPx(lm.x, lm.y, videoW, videoH, elW, elH);
        elementPxToNdcOut(px, py, elW, elH, this._ndcScratch);
        op[i * 3] = this._ndcScratch.x;
        op[i * 3 + 1] = this._ndcScratch.y;
        op[i * 3 + 2] = this._ndcScratch.z;
      }
      if (ok) {
        op[n * 3] = op[0]!;
        op[n * 3 + 1] = op[1]!;
        op[n * 3 + 2] = op[2]!;
        this.ovalGeo.setPositions(op);
        this.ovalMat.color.copy(this._ovalColor);
        this.ovalMat.opacity = rimOpacity;
        const dw = this.renderer.domElement.width;
        const dh = this.renderer.domElement.height;
        if (dw > 0 && dh > 0) {
          this.ovalMat.resolution.set(dw, dh);
        }
      }
    }

    /**
     * Holding-state scan bar: positioned within the face oval (not just the
     * mesh bbox), so its width tracks the face silhouette as it sweeps top
     * to bottom. Hidden when no `holdingProgress` is provided.
     */
    const holdingProgress = opts?.holdingProgress;
    if (holdingProgress !== undefined && this.scanMesh && this.scanGlowMesh) {
      const clampedProgress = Math.max(0, Math.min(1, holdingProgress));
      /**
       * Once the sweep reaches 100%, hide the bar immediately — otherwise it
       * sits at the bottom of the face until `Capturing` clears state, which
       * feels like a stuck artifact.
       */
      if (clampedProgress >= 1) {
        this.scanMesh.visible = false;
        this.scanGlowMesh.visible = false;
      } else {
        const faceHeight = bboxMaxY - bboxMinY;
        const yMargin = faceHeight * 0.02;
        const yTop = bboxMaxY - yMargin;
        const yBot = bboxMinY + yMargin;
        const barY = yTop + (yBot - yTop) * clampedProgress;
        const xRange = this._computeOvalXAtY(landmarks, videoW, videoH, elW, elH, barY);
        if (xRange) {
          const w = Math.max(0.01, xRange.xMax - xRange.xMin);
          const cx = (xRange.xMin + xRange.xMax) * 0.5;
          this.scanMesh.position.set(cx, barY, 0);
          this.scanMesh.scale.set(w, 0.012, 1);
          this.scanGlowMesh.position.set(cx, barY, 0);
          this.scanGlowMesh.scale.set(w, 0.06, 1);
          this.scanMesh.visible = true;
          this.scanGlowMesh.visible = true;
        } else {
          this.scanMesh.visible = false;
          this.scanGlowMesh.visible = false;
        }
      }
    } else {
      if (this.scanMesh) this.scanMesh.visible = false;
      if (this.scanGlowMesh) this.scanGlowMesh.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Compute the x-range in NDC where a horizontal line at `y = barY`
   * intersects the face oval polygon. Returns null when the line doesn't
   * cross the oval (above forehead apex or below chin).
   *
   * Linear scan over the oval's edges: for each edge crossing y=barY, lerp
   * to find the exact x. We then take min/max of the crossings (typically
   * 2 — left side and right side of the face).
   */
  private _computeOvalXAtY(
    landmarks: LandmarkPoint[],
    videoW: number,
    videoH: number,
    elW: number,
    elH: number,
    barY: number,
  ): { xMin: number; xMax: number } | null {
    let xMin = Infinity;
    let xMax = -Infinity;
    const oval = FACEMESH_FACE_OVAL_ORDERED;
    for (let i = 0; i < oval.length; i++) {
      const aIdx = oval[i]!;
      const bIdx = oval[(i + 1) % oval.length]!;
      const a = landmarks[aIdx];
      const b = landmarks[bIdx];
      if (!a || !b) continue;
      const aPx = videoNormToElementPx(a.x, a.y, videoW, videoH, elW, elH);
      const bPx = videoNormToElementPx(b.x, b.y, videoW, videoH, elW, elH);
      const aNdcY = -((aPx.y / elH) * 2 - 1);
      const bNdcY = -((bPx.y / elH) * 2 - 1);
      if (aNdcY === bNdcY) continue;
      if ((aNdcY - barY) * (bNdcY - barY) > 0) continue;
      const t = (barY - aNdcY) / (bNdcY - aNdcY);
      const aNdcX = (aPx.x / elW) * 2 - 1;
      const bNdcX = (bPx.x / elW) * 2 - 1;
      const x = aNdcX + t * (bNdcX - aNdcX);
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
    }
    if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) return null;
    return { xMin, xMax };
  }

  clear(): void {
    if (this.meshGeo) {
      this.meshGeo.setDrawRange(0, 0);
    }
    if (this.meshMesh) {
      this.meshMesh.visible = false;
    }
    for (const { line } of this._featureLines) {
      line.visible = false;
    }
    if (this.ovalLine) {
      this.ovalLine.visible = false;
    }
    if (this.scanMesh) this.scanMesh.visible = false;
    if (this.scanGlowMesh) this.scanGlowMesh.visible = false;
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this.meshGeo?.dispose();
    this.meshMat?.dispose();
    this.meshGeo = null;
    this.meshMat = null;
    this.meshMesh = null;
    for (const { geo } of this._featureLines) {
      geo.dispose();
    }
    this._featureLines.length = 0;
    this.featureLineMat?.dispose();
    this.featureLineMat = null;

    this.ovalGeo?.dispose();
    this.ovalMat?.dispose();

    (this.scanMesh?.geometry as THREE.BufferGeometry | undefined)?.dispose();
    this.scanMat?.dispose();
    this.scanGlowMat?.dispose();
    this.scanMesh = null;
    this.scanGlowMesh = null;
    this.scanMat = null;
    this.scanGlowMat = null;

    this.renderer?.dispose();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
  }
}
