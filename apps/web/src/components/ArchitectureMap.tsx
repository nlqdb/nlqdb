// /architecture — interactive 3D map of the system (SK-WEB-021).
// React owns only the overlay UI (hint, buttons, info card); the scene is
// vanilla three.js, dynamically imported so the ~170 KB gz library loads
// only on this route, after hydration. The server-rendered prose below the
// island is the no-JS / no-WebGL / crawler fallback — this component may
// fail without losing the page's content.
//
// Zoom levels: far = three group cards (You ask → engine → your data);
// near = the full node graph. Camera distance drives a continuous blend
// between the two, so "zoom in from the simple high level to the depth"
// is literally the camera dolly.

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
type Css2dModule = typeof import("three/addons/renderers/CSS2DRenderer.js");
type Object3D = import("three").Object3D;
type Mesh = import("three").Mesh;
type MeshBasicMaterial = import("three").MeshBasicMaterial;
type Vector3 = import("three").Vector3;
type QuadraticBezierCurve3 = import("three").QuadraticBezierCurve3;

// Calm-token palette (SK-WEB-020), as scene colors.
const C = {
  cardFront: 0x191c19,
  cardSide: 0x2e332e,
  groupCard: 0x181c17,
  groupSide: 0x2c302b,
  edge: 0x565c56,
  accent: 0x3ecf8e,
} as const;

// Camera distances that map to the two levels of detail.
const DETAIL_DIST = 18;
const OVERVIEW_DIST = 30;
const START_POS: [number, number, number] = [0, 4, 34];

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

function cardMesh(
  three: ThreeModule,
  w: number,
  h: number,
  depth: number,
  front: number,
  side: number,
) {
  const geo = new three.ExtrudeGeometry(roundedRectShape(three, w, h, Math.min(0.35, h / 4)), {
    depth,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -depth / 2);
  const frontMat = new three.MeshBasicMaterial({ color: front, transparent: true });
  const sideMat = new three.MeshBasicMaterial({ color: side, transparent: true });
  return new three.Mesh(geo, [frontMat, sideMat]);
}

function labelObject(css2d: Css2dModule, className: string, html: string) {
  const el = document.createElement("div");
  el.className = className;
  el.innerHTML = html;
  return new css2d.CSS2DObject(el);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  const [{ OrbitControls }, css2d] = await Promise.all([
    import("three/addons/controls/OrbitControls.js"),
    import("three/addons/renderers/CSS2DRenderer.js"),
  ]);

  let renderer: import("three").WebGLRenderer;
  try {
    renderer = new three.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    cb.onFail();
    return null;
  }

  const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.domElement.className = "arch3d-canvas";
  container.appendChild(renderer.domElement);

  const labelRenderer = new css2d.CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.className = "arch3d-labels";
  container.appendChild(labelRenderer.domElement);

  const scene = new three.Scene();
  const camera = new three.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    200,
  );
  camera.position.set(...START_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 11;
  controls.maxDistance = 46;
  controls.maxPolarAngle = Math.PI * 0.78;
  controls.minPolarAngle = Math.PI * 0.18;
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

  // ---- Group cards (the overview level) ----
  const groupMeshes: Mesh[] = [];
  for (const g of ARCH_GROUPS) {
    const mesh = cardMesh(three, g.size[0], g.size[1], 0.5, C.groupCard, C.groupSide);
    mesh.position.set(g.center[0], g.center[1], -1.1);
    mesh.renderOrder = 0;
    mesh.userData = { kind: "group", id: g.id };
    scene.add(mesh);
    groupMeshes.push(mesh);

    const label = labelObject(
      css2d,
      "arch3d-grouplabel",
      `<strong>${escapeHtml(g.label)}</strong><span>${escapeHtml(g.sub)}</span>`,
    );
    label.position.set(g.center[0], g.center[1] + g.size[1] / 2 + 0.6, 0);
    scene.add(label);
  }

  // ---- Node cards (the detail level) ----
  const NODE_W = 3.2;
  const NODE_H = 1.5;
  const nodeMeshes = new Map<string, Mesh>();
  const nodeOutlines = new Map<string, Mesh>();
  for (const n of ARCH_NODES) {
    const mesh = cardMesh(three, NODE_W, NODE_H, 0.35, C.cardFront, C.cardSide);
    mesh.position.set(...n.pos);
    mesh.renderOrder = 2;
    mesh.userData = { kind: "node", id: n.id };
    scene.add(mesh);
    nodeMeshes.set(n.id, mesh);

    // Accent halo, revealed on hover/selection.
    const outline = cardMesh(three, NODE_W + 0.22, NODE_H + 0.22, 0.1, C.accent, C.accent);
    outline.position.set(n.pos[0], n.pos[1], n.pos[2] - 0.3);
    outline.renderOrder = 1;
    outline.visible = false;
    scene.add(outline);
    nodeOutlines.set(n.id, outline);

    const roadmap = n.roadmap ? "<em>roadmap</em>" : "";
    const label = labelObject(css2d, "arch3d-nodelabel", `${escapeHtml(n.label)}${roadmap}`);
    label.position.set(n.pos[0], n.pos[1], n.pos[2] + 0.4);
    scene.add(label);
  }

  // ---- Edges ----
  interface EdgeVisual {
    mesh: Mesh;
    arrow: Mesh;
    curve: QuadraticBezierCurve3;
    pulse: Mesh | null;
    phase: number;
    fromId: string;
    toId: string;
    aggregate: boolean;
  }
  const edgeVisuals: EdgeVisual[] = [];
  const pulseGeo = new three.SphereGeometry(0.11, 10, 10);
  const arrowGeo = new three.ConeGeometry(0.16, 0.4, 10);
  const up = new three.Vector3(0, 1, 0);

  function addEdge(
    from: Vector3,
    to: Vector3,
    opts: { aggregate: boolean; fromId: string; toId: string; label?: string; phase: number },
  ) {
    const mid = from.clone().add(to).multiplyScalar(0.5);
    mid.z += opts.aggregate ? 1.6 : 0.9;
    const curve = new three.QuadraticBezierCurve3(from, mid, to);
    const tube = new three.TubeGeometry(curve, 32, opts.aggregate ? 0.07 : 0.04, 8, false);
    const mat = new three.MeshBasicMaterial({ color: C.edge, transparent: true });
    const mesh = new three.Mesh(tube, mat);
    mesh.renderOrder = 1;
    scene.add(mesh);

    // Arrowhead just short of the target card, so direction reads at a glance.
    const len = curve.getLength();
    const tArrow = Math.max(0.55, 1 - 2.1 / len);
    const arrowMat = new three.MeshBasicMaterial({ color: C.edge, transparent: true });
    const arrow = new three.Mesh(arrowGeo, arrowMat);
    arrow.position.copy(curve.getPointAt(tArrow));
    arrow.quaternion.setFromUnitVectors(up, curve.getTangentAt(tArrow).normalize());
    arrow.renderOrder = 1;
    scene.add(arrow);

    let pulse: Mesh | null = null;
    if (motionOk) {
      const pulseMat = new three.MeshBasicMaterial({ color: C.accent, transparent: true });
      pulse = new three.Mesh(pulseGeo, pulseMat);
      pulse.renderOrder = 3;
      scene.add(pulse);
    }

    if (opts.label) {
      const label = labelObject(
        css2d,
        `arch3d-edgelabel${opts.aggregate ? " arch3d-edgelabel--agg" : ""}`,
        escapeHtml(opts.label),
      );
      label.position.copy(curve.getPointAt(0.5)).add(new three.Vector3(0, 0.35, 0.4));
      scene.add(label);
    }

    edgeVisuals.push({
      mesh,
      arrow,
      curve,
      pulse,
      phase: opts.phase,
      fromId: opts.fromId,
      toId: opts.toId,
      aggregate: opts.aggregate,
    });
  }

  ARCH_EDGES.forEach((e, i) => {
    const a = archNodeById(e.from);
    const b = archNodeById(e.to);
    if (!a || !b) return;
    addEdge(new three.Vector3(...a.pos), new three.Vector3(...b.pos), {
      aggregate: false,
      fromId: e.from,
      toId: e.to,
      label: e.label,
      phase: (i * 0.37) % 1,
    });
  });

  const groupCenter = (id: ArchGroupId) => {
    const g = ARCH_GROUPS.find((x) => x.id === id);
    return new three.Vector3(g ? g.center[0] : 0, g ? g.center[1] : 0, 0);
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
  let selectedId: string | null = null;
  let neighborIds = new Set<string>();
  let detailBlend = 0; // 0 = overview, 1 = detail
  let lastView: "overview" | "detail" | null = null;
  let disposed = false;
  let unlocked = false;

  function setPointerFromEvent(ev: PointerEvent | MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function pick(ev: PointerEvent | MouseEvent): { kind: string; id: string } | null {
    setPointerFromEvent(ev);
    raycaster.setFromCamera(pointer, camera);
    const targets: Object3D[] =
      detailBlend > 0.45 ? [...nodeMeshes.values()] : (groupMeshes as Object3D[]);
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
  const flight = {
    active: false,
    t: 0,
    fromPos: new three.Vector3(),
    toPos: new three.Vector3(),
    fromTarget: new three.Vector3(),
    toTarget: new three.Vector3(),
  };
  function flyTo(pos: Vector3, target: Vector3) {
    flight.active = true;
    flight.t = 0;
    flight.fromPos.copy(camera.position);
    flight.toPos.copy(pos);
    flight.fromTarget.copy(controls.target);
    flight.toTarget.copy(target);
  }

  function focusGroup(id: ArchGroupId) {
    const c = groupCenter(id);
    flyTo(new three.Vector3(c.x * 0.82, c.y + 2.2, 15.5), new three.Vector3(c.x * 0.82, c.y, 0));
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
    labelRenderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  // ---- Render loop ----
  const t0 = performance.now();
  let raf = 0;

  function setOpacity(mesh: Mesh, value: number) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      (m as MeshBasicMaterial).opacity = value;
    }
    mesh.visible = value > 0.02;
  }

  function dimFactor(id: string) {
    if (!selectedId) return 1;
    if (id === selectedId || neighborIds.has(id)) return 1;
    return 0.15;
  }

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;

    // Idle life before the first interaction: a gentle sway, not a full
    // orbit — a full revolution would show the map mirrored from behind.
    if (controls.autoRotate) {
      controls.autoRotateSpeed = Math.sin(t * 0.4) * 0.9;
    }

    if (flight.active) {
      flight.t = Math.min(1, flight.t + 0.022);
      const k = easeOut(flight.t);
      camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      if (flight.t >= 1) flight.active = false;
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

    // Overview ↔ detail crossfade.
    for (const mesh of groupMeshes) {
      const backdrop = 0.24; // stays as a faint plate behind the nodes
      setOpacity(mesh, backdrop + (1 - detailBlend) * (0.92 - backdrop));
    }
    for (const n of ARCH_NODES) {
      const mesh = nodeMeshes.get(n.id);
      if (mesh) setOpacity(mesh, detailBlend * dimFactor(n.id));
      const outline = nodeOutlines.get(n.id);
      if (outline) {
        const on = detailBlend > 0.45 && (n.id === selectedId || n.id === hoveredId);
        outline.visible = on;
        if (on) setOpacity(outline, 0.85);
      }
    }

    for (const e of edgeVisuals) {
      const vis = e.aggregate
        ? 1 - detailBlend
        : detailBlend * Math.min(dimFactor(e.fromId), dimFactor(e.toId));
      const isSelectedEdge =
        selectedId !== null && !e.aggregate && (e.fromId === selectedId || e.toId === selectedId);
      const mats = [e.mesh.material, e.arrow.material] as MeshBasicMaterial[];
      for (const m of mats) {
        m.color.setHex(isSelectedEdge ? C.accent : C.edge);
        m.opacity = vis * (isSelectedEdge ? 1 : 0.8);
      }
      e.mesh.visible = vis > 0.03;
      e.arrow.visible = vis > 0.03;
      if (e.pulse) {
        const u = (t * (e.aggregate ? 0.16 : 0.12) + e.phase) % 1;
        e.pulse.position.copy(e.curve.getPointAt(u));
        (e.pulse.material as MeshBasicMaterial).opacity = vis;
        e.pulse.visible = vis > 0.03;
      }
    }

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  container.dataset.view = "overview";
  frame();
  cb.onReady();

  return {
    focusOverview() {
      applySelection(null);
      flyTo(new three.Vector3(...START_POS), new three.Vector3(0, 0, 0));
    },
    zoomBy(factor: number) {
      unlock();
      const dir = camera.position.clone().sub(controls.target);
      const len = Math.min(46, Math.max(11, dir.length() * factor));
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
          for (const m of mats) m.dispose();
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
              ? "Click the map to explore — zoom into a card to see inside."
              : view === "overview"
                ? "Scroll to zoom in · drag to orbit · click a card to fly into it."
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
