"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import GlobeClient from "../components/GlobeClient";
import type { SatView } from "../components/Globe";
import { fmtCoord } from "@/lib/geo";

const GROUPS: { id: string; label: string; limit: number }[] = [
  { id: "active", label: "All active", limit: 150 },
  { id: "sar", label: "SAR fleet", limit: 120 },
  { id: "planet", label: "Planet", limit: 140 },
  { id: "resource", label: "Earth obs", limit: 120 },
  { id: "stations", label: "Stations", limit: 40 },
];

const TYPE_LABEL: Record<string, string> = {
  optical: "Optical imager",
  sar: "SAR · radar",
  station: "Crewed station",
};

export default function MissionControl() {
  const [group, setGroup] = useState(GROUPS[0]);
  const [stats, setStats] = useState<{ count: number; source: string }>({
    count: 0,
    source: "…",
  });
  const [sats, setSats] = useState<SatView[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [auto, setAuto] = useState<string | null>(null);
  const satsRef = useRef<SatView[]>([]);
  satsRef.current = sats;
  const autoIdx = useRef(0);

  const highlight = selected ?? auto;
  const focusSat = sats.find((s) => highlight && s.name === highlight) ?? null;

  // auto-cycle the highlight when the user hasn't picked one manually
  useEffect(() => {
    if (selected) return;
    const tick = () => {
      const list = satsRef.current;
      if (list.length) {
        autoIdx.current = (autoIdx.current + 1) % list.length;
        setAuto(list[autoIdx.current].name);
      }
    };
    tick();
    const iv = setInterval(tick, 4500);
    return () => clearInterval(iv);
  }, [selected, group.id]);

  // seed the first highlight the moment telemetry arrives
  useEffect(() => {
    if (!selected && !auto && sats.length) setAuto(sats[0].name);
  }, [sats, selected, auto]);

  // reset selection when the constellation changes
  useEffect(() => {
    setSelected(null);
    setAuto(null);
    autoIdx.current = 0;
  }, [group.id]);

  return (
    <div className="mc">
      <div className="mc-globe">
        <GlobeClient
          key={group.id}
          group={group.id}
          limit={group.limit}
          height="100%"
          autoRotate
          highlightName={highlight}
          onStats={setStats}
          onSats={setSats}
          onSelectSat={(n) => setSelected(n)}
        />
      </div>

      {/* top bar */}
      <div className="mc-top">
        <Link href="/" className="brand">
          <span className="sat-dot" />
          SHOT&nbsp;FROM&nbsp;SPACE
        </Link>
        <div className="row" style={{ gap: 8 }}>
          <span className="chip on">● {stats.count} TRACKED</span>
          <span className="chip">{stats.source.toUpperCase()}</span>
          <Link href="/#task" className="chip" style={{ color: "var(--ink)" }}>
            TASK A SAT →
          </Link>
        </div>
      </div>

      {/* group switcher */}
      <div className="mc-groups">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            className={`mc-group ${g.id === group.id ? "on" : ""}`}
            onClick={() => setGroup(g)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* telemetry panel */}
      <div className="mc-panel panel">
        {/* focused-satellite readout */}
        <div className="mc-focus">
          <div className="row spread">
            <span className="label">
              {selected ? "Selected satellite" : "Now tracking"}
            </span>
            {selected ? (
              <button className="mc-clear mono" onClick={() => setSelected(null)}>
                auto ↻
              </button>
            ) : (
              <span className="faint mono" style={{ fontSize: 9 }}>
                auto-cycling
              </span>
            )}
          </div>
          {focusSat ? (
            <>
              <div className="mc-focus-name">
                <span className={`dot ${focusSat.type}`} />
                {focusSat.name}
              </div>
              <div className="mc-focus-grid mono">
                <span className="faint">TYPE</span>
                <span>{TYPE_LABEL[focusSat.type] ?? focusSat.type}</span>
                <span className="faint">ALTITUDE</span>
                <span className="tnum">{Math.round(focusSat.alt)} km</span>
                <span className="faint">POSITION</span>
                <span className="tnum">{fmtCoord({ lat: focusSat.lat, lng: focusSat.lng })}</span>
                <span className="faint">VELOCITY</span>
                <span className="tnum">≈ {orbitalV(focusSat.alt)} km/s</span>
              </div>
            </>
          ) : (
            <div className="faint mono mc-empty">acquiring telemetry…</div>
          )}
        </div>

        <hr className="hair" />
        <div className="row spread" style={{ padding: "10px 15px 6px" }}>
          <span className="label">Live feed · click to lock</span>
          <span className="faint mono" style={{ fontSize: 9 }}>
            SGP4
          </span>
        </div>
        <div className="mc-list">
          {sats.length === 0 && (
            <div className="faint mono mc-empty">propagating orbits…</div>
          )}
          {sats.map((s) => (
            <button
              key={s.name}
              className={`mc-row ${s.name === highlight ? "on" : ""}`}
              onClick={() => setSelected(s.name)}
            >
              <span className={`dot ${s.type}`} />
              <span className="mc-name mono">{s.name}</span>
              <span className="mc-alt mono faint tnum">{Math.round(s.alt)} km</span>
            </button>
          ))}
        </div>
        <hr className="hair" />
        <div className="mc-legend">
          <span className="row" style={{ gap: 6 }}>
            <span className="dot optical" /> optical
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="dot sar" /> SAR
          </span>
          <span className="row" style={{ gap: 6 }}>
            <span className="dot station" /> station
          </span>
        </div>
      </div>

      <div className="mc-hint mono faint">
        drag to orbit · scroll to zoom · click a satellite to lock
      </div>

      <style dangerouslySetInnerHTML={{ __html: css }} />
    </div>
  );
}

// circular orbital speed at altitude (km/s), GM_earth = 398600 km^3/s^2
function orbitalV(altKm: number): string {
  const r = 6371 + altKm;
  return Math.sqrt(398600 / r).toFixed(2);
}

const css = `
.mc{ position:fixed; inset:0; overflow:hidden; }
.mc-globe{ position:absolute; inset:0; }
.mc-top{ position:absolute; z-index:10; top:0; left:0; right:0; height:56px; display:flex; align-items:center; justify-content:space-between;
  padding:0 18px; background:linear-gradient(180deg, rgba(5,7,13,.8), transparent); }
.mc-groups{ position:absolute; z-index:10; top:70px; left:18px; display:flex; flex-direction:column; gap:6px; }
.mc-group{ font-family:var(--mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);
  background:rgba(10,14,23,.6); border:1px solid var(--line); border-radius:8px; padding:8px 12px; cursor:pointer; text-align:left; backdrop-filter:blur(6px); transition:all .12s; }
.mc-group:hover{ color:var(--ink); border-color:var(--line-2); }
.mc-group.on{ color:var(--ink); border-color:var(--cobalt); background:var(--cobalt-soft); }
.mc-panel{ position:absolute; z-index:10; top:70px; right:18px; width:312px; max-width:calc(100vw - 36px); background:rgba(10,14,23,.78); backdrop-filter:blur(10px); }
@media (max-width:640px){ .mc-panel{ display:none; } .mc-groups{ flex-direction:row; flex-wrap:wrap; right:18px; } }
.mc-focus{ padding:13px 15px 12px; }
.mc-clear{ font-size:9px; letter-spacing:.06em; text-transform:uppercase; color:var(--cobalt); background:none; border:1px solid var(--cobalt-soft); border-radius:6px; padding:2px 7px; cursor:pointer; }
.mc-clear:hover{ background:var(--cobalt-soft); }
.mc-focus-name{ display:flex; align-items:center; gap:8px; font-family:var(--display); font-weight:600; font-size:16px; color:var(--ink); margin-top:9px; }
.mc-focus-grid{ display:grid; grid-template-columns:auto 1fr; gap:5px 12px; margin-top:11px; font-size:11px; }
.mc-focus-grid .faint{ font-size:9.5px; letter-spacing:.1em; align-self:center; }
.mc-focus-grid span:nth-child(even){ color:var(--ink); text-align:right; }
.mc-list{ max-height:34vh; overflow-y:auto; padding:4px 0; }
.mc-empty{ padding:14px; font-size:11px; text-align:center; }
.mc-row{ display:flex; align-items:center; gap:9px; padding:6px 15px; width:100%; text-align:left; background:none; border:none; cursor:pointer; color:var(--ink); }
.mc-row:hover{ background:rgba(255,255,255,.04); }
.mc-row.on{ background:var(--cobalt-soft); }
.mc-name{ font-size:11px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mc-alt{ font-size:10.5px; }
.dot{ width:7px; height:7px; border-radius:50%; flex:none; }
.dot.optical{ background:#5b8bff; box-shadow:0 0 6px #5b8bff; }
.dot.sar{ background:#ffb020; box-shadow:0 0 6px #ffb020; }
.dot.station{ background:#34d17a; box-shadow:0 0 6px #34d17a; }
.mc-legend{ display:flex; gap:16px; padding:11px 15px; font-family:var(--mono); font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
.mc-hint{ position:absolute; z-index:10; bottom:14px; left:0; right:0; text-align:center; font-size:10px; letter-spacing:.14em; text-transform:uppercase; pointer-events:none; }
`;
