// /architecture — interactive 3D map of the system (SK-WEB-021).
// React owns only the overlay UI (hint, buttons, info card); the scene is
// vanilla three.js, dynamically imported so the ~170 KB gz library loads
// only on this route, after hydration. The server-rendered prose below the
// island is the no-JS / no-WebGL / crawler fallback — this component may
// fail without losing the page's content.
//
// The scene is a lit diorama: labelled card slabs standing on a fogged
// floor, casting real shadows. All text is baked into canvas textures on
// the meshes themselves — it scales with distance, occludes correctly,
// and always sits on its own surface (no screen-space DOM labels).
//
// Zoom levels: far = three floor zones with title chips (You ask → the
// engine → your data); near = the full node graph. Camera distance drives
// a continuous blend between the two, so "zoom in from the simple high
// level to the depth" is literally the camera dolly.

import { useEffect, useRef, useState } from "react";
import type { ArchGroupId, ArchNode } from "../data/architecture";
import {
  ARCH_EDGES,
  ARCH_GROUP_EDGES,
  ARCH_GROUPS,
  ARCH_NODES,
  archNeighborLabels,
  archNodeById,
} from "../data/architecture";
import ErrorBoundary from "./ErrorBoundary";

type ThreeModule = typeof import("three");
type Object3D = import("three").Object3D;
type Group = import("three").Group;
type Mesh = import("three").Mesh;
type Material = import("three").Material;
type Texture = import("three").Texture;
type Vector3 = import("three").Vector3;

// Calm-token palette (SK-WEB-020), as scene colors.
const C = {
  bg: 0x0d0f0c,
  cardFront: 0x232823,
  cardSide: 0x2b302a,
  zoneFill: "rgba(37, 43, 36, 0.85)",
  zoneLine: "rgba(86, 93, 84, 1)",
  chipFill: "rgba(15, 18, 15, 0.97)",
  chipLine: "rgba(62, 207, 142, 0.35)",
  ink: "#f2f4f1",
  muted: "#9aa099",
  accentCss: "#3ecf8e",
  edge: 0x6a716a,
  accent: 0x3ecf8e,
} as const;

const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Node cards: world size + texture resolution (px per world unit).
const NODE_W = 3.2;
const NODE_H = 1.5;
const NODE_D = 0.34;
const CARD_TILT = -0.17; // lean back toward the raised camera
const PPU = 256;

// Camera distances that map to the two levels of detail.
const DETAIL_DIST = 15;
const OVERVIEW_DIST = 26;
// Aimed slightly behind the zones so the content band sits centered in the
// frame instead of stacking in the top half over empty foreground floor.
const START_POS: [number, number, number] = [0, 12, 22];
const TARGET: [number, number, number] = [0, 0, -2.5];

interface SceneCallbacks {
  onReady(): void;
  onFail(): void;
  onSelect(node: ArchNode | null): void;
  onView(view: "overview" | "detail"): void;
  onUnlock(): void;
}

interface SceneHandle {
  focusOverview(): void;
  zoomBy(factor: number): void;
  clearSelection(): void;
  dispose(): void;
}

// Layout coords in the data module are (x, row) on a flat plan; the scene
// lays that plan onto the floor: x stays x, the row becomes depth (-z).
function toWorld(three: ThreeModule, pos: [number, number, number], y: number) {
  return new three.Vector3(pos[0], y, -pos[1]);
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrink font size until `text` fits `maxWidth` at the given weight/family. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  px: number,
  maxWidth: number,
  weight: string,
  family: string,
) {
  let size = px;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 4;
  } while (size > 18);
  return size;
}

function makeTexture(
  three: ThreeModule,
  maxAniso: number,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const tex = new three.CanvasTexture(canvas);
  tex.colorSpace = three.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/** Node-card face: label (auto-fit), plus a small accent "roadmap" tag. */
function nodeFaceTexture(three: ThreeModule, maxAniso: number, node: ArchNode): Texture {
  const w = NODE_W * PPU;
  const h = NODE_H * PPU;
  return makeTexture(three, maxAniso, w, h, (ctx) => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = fitFont(ctx, node.label, 60, w - 90, "600", SANS);
    ctx.font = `600 ${size}px ${SANS}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(node.label, w / 2, node.roadmap ? h * 0.42 : h / 2);
    if (node.roadmap) {
      ctx.font = `500 26px ${MONO}`;
      ctx.fillStyle = C.accentCss;
      const tag = "R O A D M A P";
      const tw = ctx.measureText(tag).width;
      ctx.strokeStyle = C.chipLine;
      ctx.lineWidth = 2;
      roundedRectPath(ctx, w / 2 - tw / 2 - 22, h * 0.62, tw + 44, 52, 26);
      ctx.stroke();
      ctx.fillText(tag, w / 2, h * 0.62 + 28);
    }
  });
}

/** Free-standing chip: rounded pill background so it reads over anything. */
function chipTexture(
  three: ThreeModule,
  maxAniso: number,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Texture {
  return makeTexture(three, maxAniso, w, h, (ctx) => {
    ctx.fillStyle = C.chipFill;
    ctx.strokeStyle = C.zoneLine;
    ctx.lineWidth = 3;
    roundedRectPath(ctx, 3, 3, w - 6, h - 6, Math.min(48, h / 2 - 3));
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    draw(ctx);
  });
}

function zoneChipTexture(
  three: ThreeModule,
  maxAniso: number,
  title: string,
  sub: string,
): Texture {
  const w = 1152;
  const h = 320;
  return chipTexture(three, maxAniso, w, h, (ctx) => {
    const size = fitFont(ctx, title, 116, w - 140, "600", SANS);
    ctx.font = `600 ${size}px ${SANS}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(title, w / 2, h * 0.36);
    const subSize = fitFont(ctx, sub.toUpperCase(), 52, w - 160, "600", MONO);
    ctx.font = `600 ${subSize}px ${MONO}`;
    ctx.fillStyle = "#c6c9c3";
    ctx.fillText(sub.toUpperCase(), w / 2, h * 0.75);
  });
}

function edgeChipTexture(
  three: ThreeModule,
  maxAniso: number,
  text: string,
  big: boolean,
): Texture {
  const w = big ? 896 : 512;
  const h = big ? 176 : 128;
  return chipTexture(three, maxAniso, w, h, (ctx) => {
    const size = fitFont(ctx, text, big ? 68 : 52, w - 90, "500", MONO);
    ctx.font = `500 ${size}px ${MONO}`;
    ctx.fillStyle = C.accentCss;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

/** Floor: base tone + radial rim fade + per-pixel grain. The grain is the
    banding fix — a dark 8-bit gradient alone shows visible hue rings; baked
    noise breaks them up (material.dithering handles the lit side). */
function floorTexture(three: ThreeModule, maxAniso: number): Texture {
  const S = 1024;
  return makeTexture(three, maxAniso, S, S, (ctx) => {
    ctx.fillStyle = "#141613";
    ctx.fillRect(0, 0, S, S);
    const rim = ctx.createRadialGradient(S / 2, S / 2, S * 0.16, S / 2, S / 2, S * 0.5);
    rim.addColorStop(0, "rgba(13, 15, 12, 0)");
    rim.addColorStop(0.7, "rgba(13, 15, 12, 0.45)");
    rim.addColorStop(1, "rgba(13, 15, 12, 1)");
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, S, S);
    const img = ctx.getImageData(0, 0, S, S);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const n = (Math.random() - 0.5) * 9;
      px[i] += n;
      px[i + 1] += n;
      px[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  });
}

/** One comet streak, tiled and UV-scrolled along each edge tube — replaces
    the old pulse spheres, whose loop restart read as a visible teleport. */
function streakTexture(three: ThreeModule): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, "rgba(62, 207, 142, 0)");
    g.addColorStop(0.5, "rgba(62, 207, 142, 0)");
    g.addColorStop(0.86, "rgba(62, 207, 142, 0.75)");
    g.addColorStop(0.96, "rgba(190, 255, 224, 1)");
    g.addColorStop(1, "rgba(62, 207, 142, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 8);
  }
  const tex = new three.CanvasTexture(canvas);
  tex.colorSpace = three.SRGBColorSpace;
  tex.wrapS = three.RepeatWrapping;
  return tex;
}

/** Floor zone: rounded region with a hairline border, drawn as a texture. */
function zoneTexture(three: ThreeModule, maxAniso: number, w: number, d: number): Texture {
  const tw = Math.round(w * 64);
  const th = Math.round(d * 64);
  return makeTexture(three, maxAniso, tw, th, (ctx) => {
    ctx.fillStyle = C.zoneFill;
    ctx.strokeStyle = C.zoneLine;
    ctx.lineWidth = 3;
    roundedRectPath(ctx, 3, 3, tw - 6, th - 6, 56);
    ctx.fill();
    ctx.stroke();
  });
}

function roundedRectShape(three: ThreeModule, w: number, h: number, r: number) {
  const s = new three.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function easeOut(t: number) {
  return 1 - (1 - t) ** 3;
}

function smoothstep(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

async function createArchScene(
  container: HTMLElement,
  cb: SceneCallbacks,
): Promise<SceneHandle | null> {
  const three = await import("three");
  const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

  let renderer: import("three").WebGLRenderer;
  try {
    renderer = new three.WebGLRenderer({ antialias: true });
  } catch {
    cb.onFail();
    return null;
  }

  const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = three.PCFSoftShadowMap;
  renderer.domElement.className = "arch3d-canvas";
  container.appendChild(renderer.domElement);

  const scene = new three.Scene();
  scene.background = new three.Color(C.bg);
  scene.fog = new three.Fog(C.bg, 40, 92);

  const camera = new three.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    220,
  );
  camera.position.set(...START_POS);

  // ---- Light rig: soft hemisphere fill + one shadow-casting key. ----
  scene.add(new three.HemisphereLight(0x3a403a, 0x10120f, 1.9));
  const key = new three.DirectionalLight(0xffffff, 2.0);
  key.position.set(14, 26, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -24;
  key.shadow.camera.right = 24;
  key.shadow.camera.top = 24;
  key.shadow.camera.bottom = -24;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6; // feathered contact shadows, not hard black wedges
  scene.add(key);
  const rim = new three.DirectionalLight(0x3ecf8e, 0.35);
  rim.position.set(-18, 8, -14);
  scene.add(rim);

  // ---- Floor + grid ----
  const floor = new three.Mesh(
    new three.CircleGeometry(60, 64).rotateX(-Math.PI / 2),
    new three.MeshStandardMaterial({
      map: floorTexture(three, maxAniso),
      roughness: 0.96,
      metalness: 0,
      dithering: true,
    }),
  );
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new three.GridHelper(120, 60, 0x20241f, 0x171a16);
  grid.position.y = 0.02;
  (grid.material as Material).transparent = true;
  (grid.material as Material).opacity = 0.45;
  scene.add(grid);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 10;
  controls.maxDistance = 46;
  controls.maxPolarAngle = Math.PI * 0.46; // never under the floor
  controls.minPolarAngle = Math.PI * 0.1;
  // Scroll-trap guard: the wheel zooms the scene only after the visitor
  // opts in with a first click/tap; until then the page keeps scrolling.
  controls.enableZoom = false;
  // One finger keeps scrolling the page on touch; two fingers drive the map.
  (controls.touches as { ONE: unknown; TWO: unknown }).ONE = null;
  controls.touches.TWO = three.TOUCH.DOLLY_ROTATE;
  // OrbitControls sets touch-action:none, which would also swallow vertical
  // page scrolls started on the canvas — restore the pan-y default.
  renderer.domElement.style.touchAction = "pan-y";
  controls.autoRotate = motionOk;
  controls.autoRotateSpeed = 0.45;

  // Anything whose opacity the render loop drives.
  interface Fadeable {
    mesh: Mesh;
    mats: Material[];
    base: number; // opacity at full visibility
  }
  function fadeable(mesh: Mesh, base = 1): Fadeable {
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[];
    for (const m of mats) m.transparent = true;
    return { mesh, mats, base };
  }
  function applyFade(f: Fadeable, k: number) {
    const v = f.base * k;
    for (const m of f.mats) {
      (m as Material & { opacity: number }).opacity = v;
    }
    f.mesh.visible = v > 0.02;
    f.mesh.castShadow = f.mesh.castShadow && v > 0.3;
  }

  // ---- Floor zones + standing title chips (the overview level) ----
  const zoneMeshes: Mesh[] = [];
  const zoneIds: ArchGroupId[] = [];
  const zoneFades: Fadeable[] = [];
  const chipFades: Fadeable[] = [];
  const billboards: Mesh[] = [];
  for (const g of ARCH_GROUPS) {
    const zone = new three.Mesh(
      new three.PlaneGeometry(g.size[0], g.size[1]).rotateX(-Math.PI / 2),
      new three.MeshBasicMaterial({
        map: zoneTexture(three, maxAniso, g.size[0], g.size[1]),
        transparent: true,
        depthWrite: false,
      }),
    );
    zone.position.set(g.center[0], 0.04, -g.center[1]);
    zone.userData = { kind: "group", id: g.id };
    scene.add(zone);
    zoneMeshes.push(zone);
    zoneIds.push(g.id);
    zoneFades.push(fadeable(zone));

    // Title chip standing at the back edge of the zone. Billboarded every
    // frame: text planes at an oblique angle mip-blur into mush; facing the
    // camera keeps them sharp while still scaling with distance.
    const chipW = 7.2;
    const chip = new three.Mesh(
      new three.PlaneGeometry(chipW, chipW * (320 / 1152)),
      new three.MeshBasicMaterial({
        map: zoneChipTexture(three, maxAniso, g.label, g.sub),
        transparent: true,
        depthWrite: false,
      }),
    );
    chip.position.set(g.center[0], 1.6, -(g.center[1] + g.size[1] / 2) - 1.1);
    chip.renderOrder = 4;
    scene.add(chip);
    chipFades.push(fadeable(chip));
    billboards.push(chip);
  }

  // ---- Node cards: lit slab + baked text face + accent halo ----
  const cardGroups = new Map<string, Group>();
  const cardFades = new Map<string, Fadeable[]>();
  const nodeHalos = new Map<string, Mesh>();
  const pickMeshes: Mesh[] = [];
  const bodyGeo = new three.ExtrudeGeometry(roundedRectShape(three, NODE_W, NODE_H, 0.26), {
    depth: NODE_D,
    bevelEnabled: false,
  });
  bodyGeo.translate(0, 0, -NODE_D / 2);
  const haloGeo = new three.ExtrudeGeometry(
    roundedRectShape(three, NODE_W + 0.24, NODE_H + 0.24, 0.32),
    { depth: 0.06, bevelEnabled: false },
  );

  for (const n of ARCH_NODES) {
    const group = new three.Group();
    group.position.copy(toWorld(three, n.pos, 0.95));
    group.rotation.x = CARD_TILT;

    const body = new three.Mesh(bodyGeo, [
      new three.MeshStandardMaterial({
        color: C.cardFront,
        roughness: 0.72,
        metalness: 0.08,
        dithering: true,
      }),
      new three.MeshStandardMaterial({
        color: C.cardSide,
        roughness: 0.85,
        metalness: 0.05,
        dithering: true,
      }),
    ]);
    body.castShadow = true;
    body.userData = { kind: "node", id: n.id };
    group.add(body);

    const face = new three.Mesh(
      new three.PlaneGeometry(NODE_W, NODE_H),
      new three.MeshBasicMaterial({
        map: nodeFaceTexture(three, maxAniso, n),
        transparent: true,
        depthWrite: false,
      }),
    );
    face.position.z = NODE_D / 2 + 0.012;
    face.renderOrder = 2;
    face.userData = { kind: "node", id: n.id };
    group.add(face);

    const halo = new three.Mesh(
      haloGeo,
      new three.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0.9 }),
    );
    halo.position.z = -0.1;
    halo.visible = false;
    group.add(halo);

    scene.add(group);
    cardGroups.set(n.id, group);
    cardFades.set(n.id, [fadeable(body), fadeable(face)]);
    nodeHalos.set(n.id, halo);
    pickMeshes.push(body, face);
  }

  // ---- Edges ----
  interface EdgeVisual {
    fades: Fadeable[];
    accentables: Material[];
    streak: Texture | null;
    speed: number;
    phase: number;
    fromId: string;
    toId: string;
    aggregate: boolean;
  }
  const edgeVisuals: EdgeVisual[] = [];
  const arrowGeo = new three.ConeGeometry(0.11, 0.3, 10);
  const puckGeo = new three.SphereGeometry(0.14, 12, 12);
  const up = new three.Vector3(0, 1, 0);
  const streakBase = motionOk ? streakTexture(three) : null;

  function addEdge(
    from: Vector3,
    to: Vector3,
    opts: { aggregate: boolean; fromId: string; toId: string; label?: string; phase: number },
  ) {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.y += opts.aggregate ? 2.1 : 1.05;
    const curve = new three.QuadraticBezierCurve3(from, mid, to);
    const r = opts.aggregate ? 0.07 : 0.04;
    const tube = new three.TubeGeometry(curve, 32, r, 8, false);
    const mat = new three.MeshBasicMaterial({ color: C.edge });
    const mesh = new three.Mesh(tube, mat);
    scene.add(mesh);

    // Small, quiet arrowhead near the target — the streaks carry the flow
    // story; this is only the reduced-motion / at-a-glance direction cue.
    // Staggered per edge so fan-ins don't clump their cones in one spot.
    const len = curve.getLength();
    const tArrow = Math.max(0.5, 1 - (1.8 + opts.phase * 1.1) / len);
    const arrowMat = new three.MeshBasicMaterial({
      color: opts.aggregate ? C.accent : C.edge,
    });
    const arrow = new three.Mesh(arrowGeo, arrowMat);
    if (opts.aggregate) arrow.scale.setScalar(1.25);
    arrow.position.copy(curve.getPointAt(tArrow));
    arrow.quaternion.setFromUnitVectors(up, curve.getTangentAt(tArrow).normalize());
    scene.add(arrow);

    const fades = [fadeable(mesh, 0.85), fadeable(arrow, 0.6)];

    // Aggregate routes get endpoint pucks so the line reads as a route
    // between places, not a wire dead-ending in mid-air.
    if (opts.aggregate) {
      for (const p of [from, to]) {
        const puck = new three.Mesh(puckGeo, new three.MeshBasicMaterial({ color: C.accent }));
        puck.position.copy(p);
        scene.add(puck);
        fades.push(fadeable(puck, 0.9));
      }
    }

    // Flow: a comet streak scrolled along the tube's length-wise UVs —
    // continuous motion with no loop seam anywhere on the curve.
    let streak: Texture | null = null;
    if (streakBase) {
      streak = streakBase.clone();
      streak.repeat.x = Math.max(1, Math.round(len / 7));
      streak.needsUpdate = true;
      const streakMesh = new three.Mesh(
        new three.TubeGeometry(curve, 32, r * 2.1, 8, false),
        new three.MeshBasicMaterial({
          map: streak,
          transparent: true,
          depthWrite: false,
          blending: three.AdditiveBlending,
        }),
      );
      streakMesh.renderOrder = 3;
      scene.add(streakMesh);
      fades.push(fadeable(streakMesh));
    }

    if (opts.label) {
      const big = opts.aggregate;
      const w = big ? 3.4 : 1.55;
      const chip = new three.Mesh(
        new three.PlaneGeometry(w, w * (big ? 176 / 896 : 128 / 512)),
        new three.MeshBasicMaterial({
          map: edgeChipTexture(three, maxAniso, opts.label, big),
          transparent: true,
          depthWrite: false,
        }),
      );
      // Big chips float above the flow. Small ones clear both the tube and
      // any card title behind them: same-row edges lean well forward into
      // the row gap; cross-row edges sit low over their diagonal.
      const sameRow = Math.abs(from.z - to.z) < 0.5;
      chip.position
        .copy(curve.getPointAt(0.5))
        .add(
          new three.Vector3(0, big ? 0.75 : sameRow ? 0.35 : 0.28, big ? 0 : sameRow ? 0.75 : 0.45),
        );
      chip.renderOrder = 4;
      scene.add(chip);
      fades.push(fadeable(chip));
      billboards.push(chip);
    }

    edgeVisuals.push({
      fades,
      accentables: [mat, arrowMat],
      streak,
      // Per-edge speed jitter (±~30%) so the streaks never phase-lock into
      // one synchronized metronome loop across the whole scene.
      speed: (opts.aggregate ? 0.45 : 0.3) * (0.72 + ((opts.phase * 7.3) % 1) * 0.6),
      phase: opts.phase,
      fromId: opts.fromId,
      toId: opts.toId,
      aggregate: opts.aggregate,
    });
  }

  // Detail edges dock LOW on the cards (y 0.5, bottom third) so tubes and
  // arrowheads never cross the label text baked at card-center height.
  ARCH_EDGES.forEach((e, i) => {
    const a = archNodeById(e.from);
    const b = archNodeById(e.to);
    if (!a || !b) return;
    addEdge(toWorld(three, a.pos, 0.5), toWorld(three, b.pos, 0.5), {
      aggregate: false,
      fromId: e.from,
      toId: e.to,
      label: e.label,
      phase: (i * 0.37) % 1,
    });
  });

  const groupCenter = (id: ArchGroupId) => {
    const g = ARCH_GROUPS.find((x) => x.id === id);
    return g ? toWorld(three, [g.center[0], g.center[1], 0], 1.1) : new three.Vector3();
  };
  ARCH_GROUP_EDGES.forEach((e, i) => {
    addEdge(groupCenter(e.from), groupCenter(e.to), {
      aggregate: true,
      fromId: e.from,
      toId: e.to,
      label: e.label,
      phase: i * 0.5,
    });
  });

  // ---- Interaction ----
  const raycaster = new three.Raycaster();
  const pointer = new three.Vector2();
  let hoveredId: string | null = null;
  let hoveredZoneId: string | null = null;
  let selectedId: string | null = null;
  let neighborIds = new Set<string>();
  let detailBlend = 0; // 0 = overview, 1 = detail
  let lastView: "overview" | "detail" | null = null;
  let disposed = false;
  let unlocked = false;

  function pick(ev: PointerEvent | MouseEvent): { kind: string; id: string } | null {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const targets: Object3D[] = detailBlend > 0.45 ? pickMeshes : (zoneMeshes as Object3D[]);
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    return hit.object.userData as { kind: string; id: string };
  }

  function applySelection(id: string | null) {
    selectedId = id;
    neighborIds = new Set<string>();
    if (id) {
      for (const e of ARCH_EDGES) {
        if (e.from === id) neighborIds.add(e.to);
        if (e.to === id) neighborIds.add(e.from);
      }
    }
    cb.onSelect(id ? (archNodeById(id) ?? null) : null);
  }

  // Camera fly-to (used for group focus + the overview/zoom buttons).
  // Time-based, not frame-based — slow devices get the same 850 ms glide.
  const FLIGHT_MS = 850;
  const flight = {
    active: false,
    startedAt: 0,
    fromPos: new three.Vector3(),
    toPos: new three.Vector3(),
    fromTarget: new three.Vector3(),
    toTarget: new three.Vector3(),
  };
  function flyTo(pos: Vector3, target: Vector3) {
    flight.active = true;
    flight.startedAt = performance.now();
    flight.fromPos.copy(camera.position);
    flight.toPos.copy(pos);
    flight.fromTarget.copy(controls.target);
    flight.toTarget.copy(target);
  }

  function focusGroup(id: ArchGroupId) {
    const c = groupCenter(id);
    flyTo(new three.Vector3(c.x * 0.82, 8.5, 11), new three.Vector3(c.x * 0.82, 0.5, -1));
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    controls.enableZoom = true;
    controls.autoRotate = false;
    cb.onUnlock();
  }

  let downAt: [number, number] | null = null;
  function onPointerDown(ev: PointerEvent) {
    downAt = [ev.clientX, ev.clientY];
    unlock();
  }
  function onPointerUp(ev: PointerEvent) {
    if (!downAt) return;
    const moved = Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]);
    downAt = null;
    if (moved > 6) return; // drag, not a click
    const hit = pick(ev);
    if (!hit) {
      applySelection(null);
      return;
    }
    if (hit.kind === "group") {
      focusGroup(hit.id as ArchGroupId);
    } else {
      applySelection(hit.id === selectedId ? null : hit.id);
    }
  }
  function onPointerMove(ev: PointerEvent) {
    const hit = pick(ev);
    hoveredId = hit && hit.kind === "node" ? hit.id : null;
    hoveredZoneId = hit && hit.kind === "group" ? hit.id : null;
    renderer.domElement.style.cursor = hit ? "pointer" : "grab";
  }
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  controls.addEventListener("start", unlock);

  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  // ---- Render loop ----
  const t0 = performance.now();
  let raf = 0;

  function dimFactor(id: string) {
    if (!selectedId) return 1;
    if (id === selectedId || neighborIds.has(id)) return 1;
    return 0.12;
  }

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;

    // Idle life before the first interaction: a gentle sway, not a full
    // orbit — a full revolution would show the map mirrored from behind.
    // cos, not sin: sin's integral is one-sided, drifting the camera off
    // to the left; cos oscillates the azimuth symmetrically around start.
    if (controls.autoRotate) {
      controls.autoRotateSpeed = Math.cos(t * 0.4) * 0.9;
    }

    if (flight.active) {
      const ft = Math.min(1, (performance.now() - flight.startedAt) / FLIGHT_MS);
      const k = easeOut(ft);
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      if (ft >= 1) flight.active = false;
    }
    controls.update();

    const dist = camera.position.distanceTo(controls.target);
    detailBlend = 1 - smoothstep((dist - DETAIL_DIST) / (OVERVIEW_DIST - DETAIL_DIST));

    const view = detailBlend > 0.45 ? "detail" : "overview";
    if (view !== lastView) {
      lastView = view;
      container.dataset.view = view;
      cb.onView(view);
    }

    // Overview ↔ detail crossfade. Zones stay as faint floor regions in
    // detail; title chips recede; cards + detail edges rise. A hovered
    // zone brightens so the click affordance is felt before the click.
    for (let i = 0; i < zoneFades.length; i++) {
      const hover = hoveredZoneId === zoneIds[i] && detailBlend < 0.45 ? 0.25 : 0;
      applyFade(zoneFades[i], Math.min(1, 0.4 + (1 - detailBlend) * 0.6 + hover));
    }
    for (const f of chipFades) applyFade(f, 0.15 + (1 - detailBlend) * 0.85);

    for (const n of ARCH_NODES) {
      const group = cardGroups.get(n.id);
      const fades = cardFades.get(n.id);
      // Cards stay faintly present at overview (the zones visibly contain
      // things worth zooming into). In detail view they also fade with
      // distance from the focus point, so cards outside the zone being
      // explored never leave half-cropped labels at the frame edges.
      const raw = group
        ? Math.min(1, Math.max(0.2, 1.45 - group.position.distanceTo(controls.target) / 16))
        : 1;
      const distFade = 1 - detailBlend * (1 - raw);
      const k = (0.16 + 0.84 * detailBlend) * dimFactor(n.id) * distFade;
      if (fades) {
        for (const f of fades) {
          applyFade(f, k);
          if (f.mesh.castShadow !== undefined) f.mesh.castShadow = k > 0.3;
        }
      }
      // Tactile hover: the card leans up a touch.
      if (group) {
        const targetScale = n.id === hoveredId || n.id === selectedId ? 1.06 : 1;
        group.scale.lerp(new three.Vector3(targetScale, targetScale, targetScale), 0.18);
      }
      const halo = nodeHalos.get(n.id);
      if (halo) {
        halo.visible = detailBlend > 0.45 && (n.id === selectedId || n.id === hoveredId);
      }
    }

    for (const e of edgeVisuals) {
      const vis = e.aggregate
        ? 1 - detailBlend
        : detailBlend * Math.min(dimFactor(e.fromId), dimFactor(e.toId));
      const isSelectedEdge =
        selectedId !== null && !e.aggregate && (e.fromId === selectedId || e.toId === selectedId);
      if (!e.aggregate) {
        for (const m of e.accentables) {
          (m as Material & { color: import("three").Color }).color.setHex(
            isSelectedEdge ? C.accent : C.edge,
          );
        }
      }
      for (const f of e.fades) applyFade(f, vis * (isSelectedEdge ? 1.18 : 1));
      if (e.streak) {
        e.streak.offset.x = -(t * e.speed + e.phase);
      }
    }

    // Text chips face the camera every frame — oblique text planes
    // mip-blur into mush; billboarding keeps them sharp while they still
    // scale and occlude like everything else.
    for (const b of billboards) b.quaternion.copy(camera.quaternion);

    renderer.render(scene, camera);
  }

  container.dataset.view = "overview";
  frame();
  cb.onReady();

  return {
    focusOverview() {
      applySelection(null);
      flyTo(new three.Vector3(...START_POS), new three.Vector3(...TARGET));
    },
    zoomBy(factor: number) {
      unlock();
      const dir = camera.position.clone().sub(controls.target);
      const len = Math.min(46, Math.max(10, dir.length() * factor));
      flyTo(
        controls.target.clone().add(dir.normalize().multiplyScalar(len)),
        controls.target.clone(),
      );
    },
    clearSelection() {
      applySelection(null);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      controls.dispose();
      scene.traverse((obj) => {
        const mesh = obj as Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of mats) {
            const tex = (m as Material & { map?: Texture | null }).map;
            if (tex) tex.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
      container.replaceChildren();
      delete container.dataset.view;
    },
  };
}

function ArchitectureMapInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [selected, setSelected] = useState<ArchNode | null>(null);
  const [view, setView] = useState<"overview" | "detail">("overview");
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let handle: SceneHandle | null = null;

    createArchScene(container, {
      onReady: () => {
        if (!cancelled) setStatus("ready");
      },
      onFail: () => {
        if (!cancelled) setStatus("failed");
      },
      onSelect: (node) => {
        if (!cancelled) setSelected(node);
      },
      onView: (v) => {
        if (!cancelled) setView(v);
      },
      onUnlock: () => {
        if (!cancelled) setLocked(false);
      },
    })
      .then((h) => {
        handle = h;
        handleRef.current = h;
        // Unmounted while three was still downloading.
        if (cancelled && h) h.dispose();
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });

    return () => {
      cancelled = true;
      if (handle) handle.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") handleRef.current?.clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (status === "failed") {
    return (
      <p className="arch3d-fallback">
        This browser can't render the 3D map — the full architecture is written out below.
      </p>
    );
  }

  const groupLabel = selected
    ? (ARCH_GROUPS.find((g) => g.id === selected.group)?.label ?? "")
    : "";

  return (
    <div className="arch3d">
      <div ref={containerRef} className="arch3d-stage" aria-hidden="true" />

      {status === "loading" && <p className="arch3d-loading">Loading the map…</p>}

      {status === "ready" && (
        <>
          <div className="arch3d-hud">
            <button
              type="button"
              className="btn arch3d-hud-btn"
              onClick={() => handleRef.current?.focusOverview()}
              disabled={view === "overview" && !selected}
            >
              Overview
            </button>
            <button
              type="button"
              className="btn arch3d-hud-btn"
              aria-label="Zoom in"
              onClick={() => handleRef.current?.zoomBy(0.62)}
            >
              +
            </button>
            <button
              type="button"
              className="btn arch3d-hud-btn"
              aria-label="Zoom out"
              onClick={() => handleRef.current?.zoomBy(1.6)}
            >
              &minus;
            </button>
          </div>

          <p className="arch3d-hint">
            {locked
              ? "Click the map to explore — zoom into a zone to see inside."
              : view === "overview"
                ? "Scroll to zoom in · drag to orbit · click a zone to fly into it."
                : "Click a piece to see what it does · zoom out for the big picture."}
          </p>

          {selected && (
            <aside className="arch3d-card" aria-live="polite">
              <p className="arch3d-card-kicker">
                {groupLabel}
                {selected.roadmap && <span className="arch3d-card-roadmap">roadmap</span>}
              </p>
              <h3 className="arch3d-card-title">{selected.label}</h3>
              <p className="arch3d-card-blurb">{selected.blurb}</p>
              <p className="arch3d-card-links">
                Talks to: {archNeighborLabels(selected.id).join(" · ")}
              </p>
              <button
                type="button"
                className="btn arch3d-card-close"
                onClick={() => handleRef.current?.clearSelection()}
              >
                Close
              </button>
            </aside>
          )}
        </>
      )}
    </div>
  );
}

// SK-WEB-001 — every island ships behind an ErrorBoundary.
export default function ArchitectureMap() {
  return (
    <ErrorBoundary surface="architecture-map">
      <ArchitectureMapInner />
    </ErrorBoundary>
  );
}
