"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ThreeGlobe from "three-globe";
import * as satellite from "satellite.js";
import { FALLBACK_TLES, type Tle } from "@/lib/satellites";

const EARTH_RADIUS_KM = 6371;
const GLOBE_R = 100; // three-globe default radius

export interface SatView {
  name: string;
  lat: number;
  lng: number;
  alt: number; // km
  type: "optical" | "sar" | "station";
  groundKm: number; // great-circle distance to target (Infinity if no target)
}

export interface GlobeHandle {
  count: number;
  source: string;
}

interface GlobeProps {
  group?: string;
  limit?: number;
  target?: { lat: number; lng: number } | null;
  /** name (or substring) of the satellite to emphasise with an orbit + beam */
  highlightName?: string | null;
  sensor?: "optical" | "sar";
  autoRotate?: boolean;
  focusTarget?: boolean;
  /** camera distance when focusing the target (globe radius = 100) */
  focusDistance?: number;
  height?: string;
  onStats?: (s: { count: number; source: string }) => void;
  onSats?: (sats: SatView[]) => void;
  /** fired when a satellite point is clicked (null = clicked empty space) */
  onSelectSat?: (name: string | null) => void;
}

function classify(name: string): "optical" | "sar" | "station" {
  const n = name.toUpperCase();
  if (/ISS|ZARYA|CSS|TIANHE|STATION/.test(n)) return "station";
  if (/CAPELLA|UMBRA|ICEYE|SAR|STRIX|SENTINEL-1/.test(n)) return "sar";
  return "optical";
}

const COLOR = {
  optical: new THREE.Color("#5b8bff"),
  sar: new THREE.Color("#ffb020"),
  station: new THREE.Color("#34d17a"),
  target: new THREE.Color("#34d17a"),
};

function glowSprite(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.85)");
  g.addColorStop(0.5, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = EARTH_RADIUS_KM;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface SatRec {
  name: string;
  rec: satellite.SatRec;
  type: "optical" | "sar" | "station";
}

export default function Globe(props: GlobeProps) {
  const {
    group = "active",
    limit = 130,
    target = null,
    highlightName = null,
    autoRotate = true,
    focusTarget = false,
    focusDistance = 260,
    height = "100%",
    onStats,
    onSats,
    onSelectSat,
  } = props;

  const mountRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef({ onStats, onSats, onSelectSat });
  cbRef.current = { onStats, onSats, onSelectSat };
  const propsRef = useRef({ target, highlightName, autoRotate, focusTarget, focusDistance });
  propsRef.current = { target, highlightName, autoRotate, focusTarget, focusDistance };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const width = mount.clientWidth || 800;
    const heightPx = mount.clientHeight || 500;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, heightPx);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.5, 6000);
    camera.position.set(0, 90, 320);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 150;
    controls.maxDistance = 900;
    controls.enablePan = false;

    // lights
    scene.add(new THREE.AmbientLight(0xbcc6dd, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(-1, 0.4, 1).multiplyScalar(400);
    scene.add(sun);

    // world group (globe + sats + target) — spins together
    const world = new THREE.Group();
    scene.add(world);

    const globe = new ThreeGlobe()
      .globeImageUrl(
        "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      )
      .bumpImageUrl("//unpkg.com/three-globe/example/img/earth-topology.png")
      .showAtmosphere(true)
      .atmosphereColor("#3a6bff")
      .atmosphereAltitude(0.16);
    // subtle specular tweak
    const globeMat = globe.globeMaterial() as THREE.MeshPhongMaterial;
    globeMat.shininess = 6;
    globeMat.specular = new THREE.Color("#1a2540");
    world.add(globe);

    // starfield
    const starGeo = new THREE.BufferGeometry();
    const starN = 1400;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 1800 + Math.random() * 1600;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i * 3 + 2] = r * Math.cos(ph);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0x9fb0d0, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0.7 })
    );
    scene.add(stars);

    // satellite points
    const sprite = glowSprite();
    let recs: SatRec[] = [];
    let satGeo = new THREE.BufferGeometry();
    let satPoints = new THREE.Points(
      satGeo,
      new THREE.PointsMaterial({
        size: 4.8,
        map: sprite,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
    );
    world.add(satPoints);

    // target marker (pin + expanding ping via ringsData + vertical beam)
    const targetGroup = new THREE.Group();
    world.add(targetGroup);

    // highlight orbit + tasking beam
    const highlightGroup = new THREE.Group();
    world.add(highlightGroup);
    let orbitLine: THREE.Line | null = null;
    let beamLine: THREE.Line | null = null;
    let highlightSprite: THREE.Sprite | null = null;

    function coord(lat: number, lng: number, altKm: number) {
      const c = globe.getCoords(lat, lng, altKm / EARTH_RADIUS_KM) as {
        x: number;
        y: number;
        z: number;
      };
      return new THREE.Vector3(c.x, c.y, c.z);
    }

    function buildTarget() {
      targetGroup.clear();
      const t = propsRef.current.target;
      if (!t) return;
      // expanding radar ping
      globe.ringsData([{ lat: t.lat, lng: t.lng }]);
      (globe as any)
        .ringColor(() => (tt: number) => `rgba(52,209,122,${1 - tt})`)
        .ringMaxRadius(4.5)
        .ringPropagationSpeed(2.2)
        .ringRepeatPeriod(900);
      // vertical beam from surface upward
      const base = coord(t.lat, t.lng, 0);
      const top = coord(t.lat, t.lng, 520);
      const bg = new THREE.BufferGeometry().setFromPoints([base, top]);
      const beam = new THREE.Line(
        bg,
        new THREE.LineBasicMaterial({ color: COLOR.target, transparent: true, opacity: 0.55 })
      );
      targetGroup.add(beam);
      // marker dot
      const dot = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: sprite, color: COLOR.target, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      dot.position.copy(base);
      dot.scale.setScalar(9);
      targetGroup.add(dot);
    }

    function buildHighlight() {
      highlightGroup.clear();
      orbitLine = beamLine = null;
      highlightSprite = null;
      const hn = propsRef.current.highlightName;
      if (!hn) return;
      const rec = recs.find((r) => r.name.toUpperCase().includes(hn.toUpperCase())) || recs[0];
      if (!rec) return;
      // one-orbit trail
      const periodMin = (2 * Math.PI) / rec.rec.no; // rec.no in rad/min
      const now = new Date();
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 96; k++) {
        const when = new Date(now.getTime() + (k / 96) * periodMin * 60000);
        const p = propagate(rec.rec, when);
        if (p) pts.push(coord(p.lat, p.lng, p.alt));
      }
      if (pts.length > 2) {
        orbitLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x3a6bff, transparent: true, opacity: 0.5 })
        );
        highlightGroup.add(orbitLine);
      }
      highlightSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: sprite, color: 0x9fc0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      highlightSprite.scale.setScalar(11);
      highlightGroup.add(highlightSprite);
      beamLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0x34d17a, transparent: true, opacity: 0.7 })
      );
      highlightGroup.add(beamLine);
    }

    function propagate(rec: satellite.SatRec, when: Date) {
      const pv = satellite.propagate(rec, when);
      if (!pv || !pv.position || typeof pv.position === "boolean") return null;
      const gmst = satellite.gstime(when);
      const geo = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, gmst);
      return {
        lat: satellite.degreesLat(geo.latitude),
        lng: satellite.degreesLong(geo.longitude),
        alt: geo.height,
      };
    }

    function setRecs(tles: Tle[], source: string) {
      if (disposed) return;
      recs = tles
        .map((t) => {
          try {
            const rec = satellite.twoline2satrec(t.line1, t.line2);
            return { name: t.name, rec, type: classify(t.name) } as SatRec;
          } catch {
            return null;
          }
        })
        .filter((x): x is SatRec => !!x);

      const n = recs.length;
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      recs.forEach((r, i) => {
        const c = COLOR[r.type];
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      });
      satGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      satGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      buildHighlight();
      cbRef.current.onStats?.({ count: n, source });
    }

    // Seed instantly with the curated set so the globe is never empty, then
    // upgrade to the live Celestrak feed the moment it arrives.
    setRecs(FALLBACK_TLES, "loading");
    fetch(`/api/satellites?group=${encodeURIComponent(group)}&limit=${limit}`)
      .then((r) => r.json())
      .then((data: { tles: Tle[]; source: string }) => {
        if (data?.tles?.length) setRecs(data.tles, data.source);
      })
      .catch(() => {});

    buildTarget();

    // react to target/highlight changes
    let lastTargetKey = keyOf(propsRef.current.target);
    let lastHl = propsRef.current.highlightName;

    function keyOf(t: { lat: number; lng: number } | null) {
      return t ? `${t.lat.toFixed(3)},${t.lng.toFixed(3)}` : "";
    }

    // camera focus (accounts for current world rotation so the target frames)
    let lastFocusDist = propsRef.current.focusDistance;
    function focusOn(lat: number, lng: number) {
      const dist = propsRef.current.focusDistance ?? 260;
      const dir = coord(lat, lng, 0)
        .clone()
        .applyQuaternion(world.quaternion)
        .normalize();
      const to = dir.multiplyScalar(dist);
      const from = camera.position.clone();
      const start = performance.now();
      const dur = 1200;
      function step(now: number) {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(from, to, e);
        if (t < 1 && !disposed) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if (propsRef.current.focusTarget && propsRef.current.target) {
      focusOn(propsRef.current.target.lat, propsRef.current.target.lng);
    }

    // click a satellite to select it
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 3.2 };
    const ndc = new THREE.Vector2();
    let downX = 0,
      downY = 0;
    function onDown(e: PointerEvent) {
      downX = e.clientX;
      downY = e.clientY;
    }
    function onUp(e: PointerEvent) {
      // ignore drags (orbit control)
      if (Math.abs(e.clientX - downX) > 5 || Math.abs(e.clientY - downY) > 5) return;
      if (!cbRef.current.onSelectSat || recs.length === 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(satPoints);
      if (hits.length && hits[0].index != null && recs[hits[0].index]) {
        cbRef.current.onSelectSat(recs[hits[0].index].name);
      } else {
        cbRef.current.onSelectSat(null);
      }
    }
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // animation
    let lastProp = 0;
    const posBuf = { arr: null as Float32Array | null };
    let raf = 0;

    function tick(ts: number) {
      if (disposed) return;
      raf = requestAnimationFrame(tick);

      // handle prop changes
      const tk = keyOf(propsRef.current.target);
      if (tk !== lastTargetKey) {
        lastTargetKey = tk;
        buildTarget();
        if (propsRef.current.focusTarget && propsRef.current.target)
          focusOn(propsRef.current.target.lat, propsRef.current.target.lng);
      }
      if (propsRef.current.highlightName !== lastHl) {
        lastHl = propsRef.current.highlightName;
        buildHighlight();
      }
      if (
        propsRef.current.focusDistance !== lastFocusDist &&
        propsRef.current.focusTarget &&
        propsRef.current.target
      ) {
        lastFocusDist = propsRef.current.focusDistance;
        focusOn(propsRef.current.target.lat, propsRef.current.target.lng);
      }

      // spin
      if (propsRef.current.autoRotate) world.rotation.y += 0.0006;

      // propagate every ~200ms
      if (ts - lastProp > 200 && recs.length) {
        lastProp = ts;
        const when = new Date();
        const posAttr = satGeo.getAttribute("position") as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const t = propsRef.current.target;
        const views: SatView[] = [];
        for (let i = 0; i < recs.length; i++) {
          const p = propagate(recs[i].rec, when);
          if (!p) continue;
          const v = coord(p.lat, p.lng, p.alt);
          arr[i * 3] = v.x;
          arr[i * 3 + 1] = v.y;
          arr[i * 3 + 2] = v.z;
          const groundKm = t ? haversineKm(t, p) : Infinity;
          views.push({ name: recs[i].name, lat: p.lat, lng: p.lng, alt: p.alt, type: recs[i].type, groundKm });
        }
        posAttr.needsUpdate = true;

        // highlight sat position + beam
        const hn = propsRef.current.highlightName;
        if (hn && highlightSprite) {
          const rec = recs.find((r) => r.name.toUpperCase().includes(hn.toUpperCase())) || recs[0];
          const p = rec && propagate(rec.rec, when);
          if (p) {
            const v = coord(p.lat, p.lng, p.alt);
            highlightSprite.position.copy(v);
            if (beamLine && t) {
              const g = beamLine.geometry as THREE.BufferGeometry;
              g.setFromPoints([v, coord(t.lat, t.lng, 0)]);
              g.attributes.position.needsUpdate = true;
            }
          }
        }

        if (cbRef.current.onSats) {
          views.sort((a, b) => a.groundKm - b.groundKm);
          const top = views.slice(0, 12);
          // always surface the highlighted sat's live telemetry to the parent
          if (hn) {
            const hv = views.find((v) =>
              v.name.toUpperCase().includes(hn.toUpperCase())
            );
            if (hv && !top.includes(hv)) top.unshift(hv);
          }
          cbRef.current.onSats(top);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);

    // resize
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || heightPx;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      renderer.dispose();
      sprite.dispose();
      starGeo.dispose();
      satGeo.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, limit]);

  return <div ref={mountRef} style={{ width: "100%", height }} />;
}
