"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TIERS, partner } from "@/lib/catalog";
import { esriImageUrl, fmtCoord, bboxAround, type LatLng } from "@/lib/geo";

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
  const [span, setSpan] = useState(240); // meters shown in preview
  const [tierId, setTierId] = useState("priority");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const searchTimer = useRef<any>(null);

  const previewUrl = useMemo(
    () => esriImageUrl(loc, span, 720),
    [loc.lat, loc.lng, span]
  );
  const selectedTier = TIERS.find((t) => t.id === tierId)!;

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

  // click on preview refines the pin within the current bbox
  function refine(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width; // 0..1 left→right
    const fy = (e.clientY - rect.top) / rect.height; // 0..1 top→bottom
    const b = bboxAround(loc, span);
    const lng = b.minLng + fx * (b.maxLng - b.minLng);
    const lat = b.maxLat - fy * (b.maxLat - b.minLat);
    setLoc({ lat, lng });
    setLabel("Pinned coordinates");
  }

  async function checkout() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, location: loc, label, target }),
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

            {/* satellite preview — click to refine */}
            <div className="preview" onClick={refine} title="Click to refine the pin">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Overhead satellite preview of target" />
              <div className="crosshair">
                <span className="ch-v" />
                <span className="ch-h" />
                <span className="ch-ring" />
              </div>
              <div className="preview-foot mono">
                <span>{fmtCoord(loc)}</span>
                <span className="faint">ESRI · WORLD IMAGERY</span>
              </div>
              <div className="zoombar">
                <button onClick={(e) => { e.stopPropagation(); setSpan((s) => Math.max(90, s - 90)); }}>+</button>
                <button onClick={(e) => { e.stopPropagation(); setSpan((s) => Math.min(1200, s + 120)); }}>−</button>
              </div>
            </div>

            <input
              className="field mono"
              style={{ marginTop: 10, fontSize: 12 }}
              placeholder="What is this? (e.g. my house)"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
        </div>

        {/* ── right: capture spec ── */}
        <div className="panel console-spec">
          <div className="row spread" style={{ padding: "16px 18px 12px" }}>
            <span className="label">02 · Choose your capture</span>
            <span className="faint mono" style={{ fontSize: 10 }}>
              8 constellations online
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
            <div className="row spread" style={{ marginBottom: 4 }}>
              <span className="muted mono" style={{ fontSize: 12 }}>
                {selectedTier.name} · {partner(selectedTier.partnerId).name}
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
              )}&tier=${tierId}&label=${encodeURIComponent(
                label
              )}&target=${encodeURIComponent(target)}`}
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
`;
