"use client";

import { useState } from "react";
import Link from "next/link";
import GlobeClient from "../components/GlobeClient";
import type { SatView } from "../components/Globe";

const GROUPS: { id: string; label: string; limit: number }[] = [
  { id: "active", label: "All active", limit: 150 },
  { id: "sar", label: "SAR fleet", limit: 120 },
  { id: "planet", label: "Planet", limit: 140 },
  { id: "resource", label: "Earth obs", limit: 120 },
  { id: "stations", label: "Stations", limit: 40 },
];

export default function MissionControl() {
  const [group, setGroup] = useState(GROUPS[0]);
  const [stats, setStats] = useState<{ count: number; source: string }>({
    count: 0,
    source: "…",
  });
  const [sats, setSats] = useState<SatView[]>([]);

  return (
    <div className="mc">
      <div className="mc-globe">
        <GlobeClient
          key={group.id}
          group={group.id}
          limit={group.limit}
          height="100%"
          autoRotate
          onStats={setStats}
          onSats={setSats}
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
        <div className="row spread" style={{ padding: "13px 15px 10px" }}>
          <span className="label">Live telemetry</span>
          <span className="faint mono" style={{ fontSize: 10 }}>
            SGP4 · realtime
          </span>
        </div>
        <hr className="hair" />
        <div className="mc-list">
          {sats.length === 0 && (
            <div className="faint mono mc-empty">propagating orbits…</div>
          )}
          {sats.map((s, i) => (
            <div key={i} className="mc-row">
              <span className={`dot ${s.type}`} />
              <span className="mc-name mono">{s.name}</span>
              <span className="mc-alt mono faint tnum">
                {Math.round(s.alt)} km
              </span>
            </div>
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

      <div className="mc-hint mono faint">drag to orbit · scroll to zoom</div>

      <style dangerouslySetInnerHTML={{ __html: css }} />
    </div>
  );
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
.mc-panel{ position:absolute; z-index:10; top:70px; right:18px; width:300px; max-width:calc(100vw - 36px); background:rgba(10,14,23,.72); backdrop-filter:blur(10px); }
@media (max-width:640px){ .mc-panel{ display:none; } .mc-groups{ flex-direction:row; flex-wrap:wrap; right:18px; } }
.mc-list{ max-height:46vh; overflow-y:auto; padding:6px 0; }
.mc-empty{ padding:16px; font-size:11px; text-align:center; }
.mc-row{ display:flex; align-items:center; gap:9px; padding:6px 15px; }
.mc-row:hover{ background:rgba(255,255,255,.03); }
.mc-name{ font-size:11px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mc-alt{ font-size:10.5px; }
.dot{ width:7px; height:7px; border-radius:50%; flex:none; }
.dot.optical{ background:#5b8bff; box-shadow:0 0 6px #5b8bff; }
.dot.sar{ background:#ffb020; box-shadow:0 0 6px #ffb020; }
.dot.station{ background:#34d17a; box-shadow:0 0 6px #34d17a; }
.mc-legend{ display:flex; gap:16px; padding:11px 15px; font-family:var(--mono); font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
.mc-hint{ position:absolute; z-index:10; bottom:14px; left:0; right:0; text-align:center; font-size:10px; letter-spacing:.14em; text-transform:uppercase; pointer-events:none; }
`;
