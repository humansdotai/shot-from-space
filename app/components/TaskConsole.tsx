"use client";

import { useEffect, useRef, useState } from "react";
import {
  TIERS,
  partner,
  PARTNERS,
  RESOLUTIONS,
  resolutionIndexFor,
} from "@/lib/catalog";
import { fmtCoord, type LatLng } from "@/lib/geo";
import LocatorMapClient from "./LocatorMapClient";

// local datetime-local string for "now", rounded to the minute
function nowLocalInput(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

interface GeoResult {
  label: string;
  lat: number;
  lng: number;
  type: string;
}

const DEFAULT: LatLng = { lat: 40.6892, lng: -74.0445 }; // Statue of Liberty

export default function TaskConsole() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState<LatLng>(DEFAULT);
  const [label, setLabel] = useState("Statue of Liberty, New York");
  const [target, setTarget] = useState("my house");
  const [tierId, setTierId] = useState("priority");
  const [sensor, setSensor] = useState<"optical" | "sar">("optical");
  const [resIdx, setResIdx] = useState(1); // 0.30 m
  // time-dependent: set on the client only, to avoid SSR/hydration mismatch
  const [attemptAt, setAttemptAt] = useState<string>("");
  const [minAttempt, setMinAttempt] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const searchTimer = useRef<any>(null);

  const selectedTier = TIERS.find((t) => t.id === tierId)!;

  useEffect(() => {
    const now = nowLocalInput();
    setAttemptAt(now);
    setMinAttempt(now);
  }, []);

  // selecting a tier seeds the capture parameters with its spec
  useEffect(() => {
    setSensor(selectedTier.sensor === "sar" ? "sar" : "optical");
    setResIdx(resolutionIndexFor(selectedTier.resolution));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierId]);

  // SAR floor: radar isn't sub-0.25 m here; keep the slider sensible
  useEffect(() => {
    if (sensor === "sar" && RESOLUTIONS[resIdx].m < 0.25) setResIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor]);

  // debounced geocode
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
        const d = await r.json();
        setResults(d.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [query]);

  function pick(r: GeoResult) {
    setLoc({ lat: r.lat, lng: r.lng });
    setLabel(r.label.split(",").slice(0, 3).join(","));
    setQuery(r.label.split(",")[0]);
    setOpen(false);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLabel("Your current location");
        setQuery("");
      },
      () => setErr("Location permission denied.")
    );
  }


  async function checkout() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId,
          location: loc,
          label,
          target,
          sensor,
          resolution: RESOLUTIONS[resIdx].label,
          attemptAt: new Date(attemptAt || Date.now()).toISOString(),
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.url) throw new Error(d.error || "Checkout failed.");
      window.location.href = d.url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="console">
      <div className="console-grid">
        {/* ── left: target acquisition ── */}
        <div className="panel console-target">
          <div className="row spread" style={{ padding: "16px 18px 12px" }}>
            <span className="label">01 · Target acquisition</span>
            <span className="chip on">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 9,
                  background: "var(--green)",
                  display: "inline-block",
                }}
              />
              locked
            </span>
          </div>
          <hr className="hair" />

          <div style={{ padding: 18 }}>
            <div style={{ position: "relative" }}>
              <input
                className="field"
                placeholder="Search an address, city or landmark…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => results.length && setOpen(true)}
              />
              {open && results.length > 0 && (
                <div className="results">
                  {results.map((r, i) => (
                    <button key={i} className="result" onClick={() => pick(r)}>
                      <span className="mono result-name">
                        {r.label.split(",")[0]}
                      </span>
                      <span className="faint mono result-sub">
                        {r.label.split(",").slice(1, 3).join(",")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="row wrap-gap" style={{ marginTop: 10, gap: 8 }}>
              <button className="btn ghost mini" onClick={useMyLocation}>
                ⌖ Use my location
              </button>
              <div className="coord-inputs">
                <input
                  className="field mono coord"
                  value={loc.lat.toFixed(5)}
                  onChange={(e) =>
                    setLoc((l) => ({ ...l, lat: parseFloat(e.target.value) || 0 }))
                  }
                  aria-label="latitude"
                />
                <input
                  className="field mono coord"
                  value={loc.lng.toFixed(5)}
                  onChange={(e) =>
                    setLoc((l) => ({ ...l, lng: parseFloat(e.target.value) || 0 }))
                  }
                  aria-label="longitude"
                />
              </div>
            </div>

            {/* interactive satellite locator — drag map, crosshair = target */}
            <LocatorMapClient value={loc} onChange={setLoc} height={300} />

            {/* live coordinate readout */}
            <div className="coord-readout">
              <span className="mono">{fmtCoord(loc)}</span>
              <span className="faint mono" style={{ fontSize: 10 }}>
                ESRI · WORLD IMAGERY
              </span>
            </div>

            <input
              className="field mono"
              style={{ marginTop: 10, fontSize: 12 }}
              placeholder="What is this? (e.g. my house)"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />

            {/* ── capture parameters ── */}
            <hr className="hair" style={{ margin: "16px 0 14px" }} />
            <span className="label">Capture parameters</span>

            {/* sensor toggle */}
            <div className="param">
              <span className="param-l">Sensor</span>
              <div className="seg">
                <button
                  className={`seg-btn ${sensor === "optical" ? "on" : ""}`}
                  onClick={() => setSensor("optical")}
                >
                  ◉ Optical
                </button>
                <button
                  className={`seg-btn ${sensor === "sar" ? "on sar" : ""}`}
                  onClick={() => setSensor("sar")}
                >
                  ◈ SAR · radar
                </button>
              </div>
            </div>
            <div className="param-note faint mono">
              {sensor === "sar"
                ? "Synthetic-aperture radar — sees through cloud, smoke and darkness."
                : "Daylight optical — true-colour imagery, cloud-screened."}
            </div>

            {/* resolution slider */}
            <div className="param" style={{ marginTop: 12 }}>
              <span className="param-l">Resolution</span>
              <span className="param-v mono">
                {RESOLUTIONS[resIdx].label}
                <span className="faint"> / px</span>
              </span>
            </div>
            <input
              className="slider"
              type="range"
              min={0}
              max={RESOLUTIONS.length - 1}
              step={1}
              value={resIdx}
              onChange={(e) => setResIdx(parseInt(e.target.value, 10))}
              aria-label="resolution"
            />
            <div className="slider-ticks mono faint">
              <span>sharpest</span>
              <span>widest</span>
            </div>

            {/* attempt date/time */}
            <div className="param" style={{ marginTop: 12 }}>
              <span className="param-l">Attempt from</span>
              <span className="faint mono" style={{ fontSize: 10 }}>
                72 h collection window
              </span>
            </div>
            <input
              className="field mono"
              type="datetime-local"
              style={{ marginTop: 8, fontSize: 12, colorScheme: "dark" }}
              value={attemptAt}
              min={minAttempt}
              onChange={(e) => setAttemptAt(e.target.value)}
              aria-label="earliest attempt"
            />
          </div>
        </div>

        {/* ── right: capture spec ── */}
        <div className="panel console-spec">
          <div className="row spread" style={{ padding: "16px 18px 12px" }}>
            <span className="label">02 · Choose your capture</span>
            <span className="faint mono" style={{ fontSize: 10 }}>
              {PARTNERS.length} constellations online
            </span>
          </div>
          <hr className="hair" />

          <div className="tiers">
            {TIERS.map((t) => {
              const p = partner(t.partnerId);
              const on = t.id === tierId;
              return (
                <button
                  key={t.id}
                  className={`tier ${on ? "on" : ""}`}
                  onClick={() => setTierId(t.id)}
                >
                  <div className="row spread">
                    <span className="tier-name">{t.name}</span>
                    <span className="tier-price mono">${t.price}</span>
                  </div>
                  <div className="tier-tag muted">{t.tagline}</div>
                  <div className="row wrap-gap" style={{ gap: 6, marginTop: 8 }}>
                    <span className={`chip ${t.sensor === "sar" ? "sar" : ""}`}>
                      {t.resolution} {t.sensor}
                    </span>
                    <span className="chip">{p.name}</span>
                    <span className="chip">
                      ETA {t.eta[0]}–{t.eta[1]}m
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <hr className="hair" />
          <div style={{ padding: 18 }}>
            <div className="row wrap-gap" style={{ gap: 6, marginBottom: 10 }}>
              <span className={`chip ${sensor === "sar" ? "sar" : ""}`}>
                {RESOLUTIONS[resIdx].label} {sensor}
              </span>
              <span className="chip">{partner(selectedTier.partnerId).name}</span>
              {attemptAt && (
                <span className="chip">
                  {new Date(attemptAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {new Date(attemptAt).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            <div className="row spread" style={{ marginBottom: 4 }}>
              <span className="muted mono" style={{ fontSize: 12 }}>
                {selectedTier.name}
              </span>
              <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>
                ${selectedTier.price}.00
              </span>
            </div>
            <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={checkout} disabled={busy}>
              {busy ? "Opening secure checkout…" : `◎ Task satellite · pay $${selectedTier.price}`}
            </button>
            {err && <div className="err mono">{err}</div>}
            <a
              className="demo-link mono"
              href={`/order/demo?lat=${loc.lat.toFixed(5)}&lng=${loc.lng.toFixed(
                5
              )}&tier=${tierId}&sensor=${sensor}&res=${encodeURIComponent(
                RESOLUTIONS[resIdx].label
              )}&label=${encodeURIComponent(label)}&target=${encodeURIComponent(
                target
              )}`}
            >
              ▷ Preview a demo pass — no charge
            </a>
            <div className="faint mono" style={{ fontSize: 10, marginTop: 10, textAlign: "center", letterSpacing: "0.04em" }}>
              Secured by Stripe · captures dispatched on payment
            </div>
          </div>
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
.console { margin-top: 26px; }
.console-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 18px; }
@media (max-width: 940px){ .console-grid{ grid-template-columns: 1fr; } }
.results { position:absolute; z-index:20; left:0; right:0; top:calc(100% + 6px);
  background: var(--panel-2); border:1px solid var(--line-2); border-radius:10px; overflow:hidden;
  box-shadow: 0 20px 50px -20px rgba(0,0,0,.7); }
.result { display:flex; flex-direction:column; gap:1px; width:100%; text-align:left; padding:9px 12px; background:none; border:none; cursor:pointer; border-bottom:1px solid var(--line); }
.result:last-child{ border-bottom:none; }
.result:hover{ background: var(--cobalt-soft); }
.result-name{ font-size:12px; color:var(--ink); }
.result-sub{ font-size:10px; }
.btn.mini { padding:9px 12px; font-size:10px; }
.coord-inputs{ display:flex; gap:8px; flex:1; min-width: 180px; }
.field.coord{ padding:9px 10px; font-size:12px; text-align:center; }
.preview{ position:relative; margin-top:12px; aspect-ratio: 16/10; border-radius:12px; overflow:hidden;
  border:1px solid var(--line-2); cursor: crosshair; background:#0a0e17; }
.preview img{ width:100%; height:100%; object-fit:cover; display:block; }
.crosshair{ position:absolute; inset:0; pointer-events:none; }
.ch-v{ position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(52,209,122,.6); transform:translateX(-.5px); }
.ch-h{ position:absolute; top:50%; left:0; right:0; height:1px; background:rgba(52,209,122,.6); transform:translateY(-.5px); }
.ch-ring{ position:absolute; left:50%; top:50%; width:44px; height:44px; margin:-22px 0 0 -22px; border:1px solid var(--green); border-radius:50%; box-shadow:0 0 0 1px rgba(0,0,0,.3), 0 0 18px rgba(52,209,122,.5); animation:ping 2.4s ease-out infinite; }
@keyframes ping{ 0%{transform:scale(.7);opacity:1} 70%{transform:scale(1.25);opacity:.25} 100%{transform:scale(.7);opacity:1} }
.preview-foot{ position:absolute; left:0; right:0; bottom:0; display:flex; justify-content:space-between; padding:7px 10px; font-size:10px;
  background:linear-gradient(transparent, rgba(5,7,13,.85)); color:var(--ink); letter-spacing:.05em; }
.zoombar{ position:absolute; top:8px; right:8px; display:flex; flex-direction:column; gap:4px; }
.zoombar button{ width:26px; height:26px; border:1px solid var(--line-2); background:rgba(10,14,23,.8); color:var(--ink); border-radius:7px; cursor:pointer; font-size:15px; line-height:1; }
.zoombar button:hover{ background: var(--cobalt); border-color:var(--cobalt); }
.tiers{ display:flex; flex-direction:column; }
.tier{ text-align:left; background:none; border:none; border-bottom:1px solid var(--line); padding:14px 18px; cursor:pointer; transition: background .12s; position:relative; }
.tier:hover{ background: rgba(255,255,255,.03); }
.tier.on{ background: var(--cobalt-soft); }
.tier.on::before{ content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--cobalt); }
.tier-name{ font-family:var(--display); font-weight:600; font-size:15px; }
.tier-price{ font-size:15px; font-weight:700; }
.tier-tag{ font-size:12px; margin-top:2px; line-height:1.4; }
.err{ margin-top:10px; color:var(--red); font-size:11px; text-align:center; }
.demo-link{ display:block; text-align:center; margin-top:12px; font-size:11px; letter-spacing:.06em; color:var(--muted); text-transform:uppercase; transition:color .15s; }
.demo-link:hover{ color:var(--cobalt); }
.coord-readout{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:10px; padding:9px 12px;
  border:1px solid var(--line-2); border-radius:10px; background:var(--void); }
.coord-readout > span:first-child{ font-size:13px; color:var(--green); letter-spacing:.02em; }
.param{ display:flex; align-items:center; justify-content:space-between; margin-top:12px; }
.param-l{ font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
.param-v{ font-size:13px; color:var(--ink); }
.param-note{ font-size:10.5px; margin-top:6px; line-height:1.4; }
.seg{ display:flex; gap:6px; }
.seg-btn{ font-family:var(--mono); font-size:11px; letter-spacing:.04em; color:var(--muted); background:var(--void);
  border:1px solid var(--line-2); border-radius:8px; padding:7px 11px; cursor:pointer; transition:all .12s; }
.seg-btn:hover{ color:var(--ink); }
.seg-btn.on{ color:var(--ink); border-color:var(--cobalt); background:var(--cobalt-soft); }
.seg-btn.on.sar{ border-color:rgba(255,176,32,.5); background:rgba(255,176,32,.1); color:var(--amber); }
.slider{ -webkit-appearance:none; appearance:none; width:100%; height:4px; border-radius:3px; margin-top:10px;
  background:linear-gradient(90deg, var(--cobalt), var(--green)); outline:none; cursor:pointer; }
.slider::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:16px; height:16px; border-radius:50%;
  background:#fff; border:2px solid var(--cobalt); box-shadow:0 0 8px rgba(58,107,255,.6); cursor:pointer; }
.slider::-moz-range-thumb{ width:15px; height:15px; border-radius:50%; background:#fff; border:2px solid var(--cobalt); cursor:pointer; }
.slider-ticks{ display:flex; justify-content:space-between; font-size:9px; letter-spacing:.1em; text-transform:uppercase; margin-top:6px; }
input[type=datetime-local].field{ color-scheme:dark; }
`;
