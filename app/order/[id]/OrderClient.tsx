"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GlobeClient from "../../components/GlobeClient";
import { tier as getTier, partner as getPartner, TIERS } from "@/lib/catalog";
import { esriImageUrl, fmtCoord } from "@/lib/geo";
import { POSTER_SIZES, posterSize } from "@/lib/gelato";
import type { Order } from "@/lib/orders";

interface Stage {
  key: string;
  at: number; // seconds elapsed when this stage begins
  label: string;
  detail: (partner: string) => string;
}

const STAGES: Stage[] = [
  { key: "confirmed", at: 0, label: "Tasking order confirmed", detail: (p) => `Payment settled · order booked on ${p}.` },
  { key: "uplink", at: 3, label: "Command uplinked", detail: () => "Collection request sent to the constellation scheduler." },
  { key: "slew", at: 8, label: "Satellite slewing to target", detail: () => "Spacecraft rotating to point its sensor at your coordinates." },
  { key: "acquire", at: 14, label: "Acquiring imagery", detail: () => "Sensor open · scanning the target area." },
  { key: "downlink", at: 22, label: "Downlinking to ground station", detail: () => "Raw capture streaming to the nearest teleport." },
  { key: "process", at: 27, label: "Processing & orthorectifying", detail: () => "Georeferencing, colour-balancing, cloud screening." },
  { key: "delivered", at: 31, label: "Capture delivered", detail: () => "Your shot from space is ready." },
];

const TOTAL = 33;

export default function OrderClient({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const sp = useSearchParams();
  const isDemo = id === "demo";
  const [posterSizeId, setPosterSizeId] = useState("16");
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterErr, setPosterErr] = useState<string | null>(null);
  const [posterStatus, setPosterStatus] = useState<{
    sizeId: string;
    label: string;
    gelatoId: string | null;
  } | null>(null);

  async function orderPoster() {
    if (!order) return;
    setPosterBusy(true);
    setPosterErr(null);
    try {
      const res = await fetch(`/api/poster/checkout?from=${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sizeId: posterSizeId,
          lat: order.location.lat,
          lng: order.location.lng,
          label: order.label,
          target: order.target,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.url) throw new Error(d.error || "Checkout failed.");
      window.location.href = d.url;
    } catch (e) {
      setPosterErr((e as Error).message);
      setPosterBusy(false);
    }
  }

  // demo pass: synthesize a paid order from query params, no Stripe, no charge
  useEffect(() => {
    if (!isDemo) return;
    const lat = parseFloat(sp.get("lat") ?? "48.8584");
    const lng = parseFloat(sp.get("lng") ?? "2.2945");
    const tierId = TIERS.some((t) => t.id === sp.get("tier"))
      ? (sp.get("tier") as string)
      : "priority";
    const sensorParam = sp.get("sensor");
    setOrder({
      id: "demo",
      tierId,
      location: { lat, lng },
      label: sp.get("label") || "Demo target",
      target: sp.get("target") || "this location",
      sensor: sensorParam === "sar" || sensorParam === "optical" ? sensorParam : undefined,
      resolution: sp.get("res") || undefined,
      attemptAt: sp.get("attemptAt") || undefined,
      sat: sp.get("sat") || undefined,
      posterSizeId: sp.get("poster") || undefined,
      paid: true,
      amount: 0,
      currency: "USD",
      createdAt: 0,
    });
    setLoading(false);
  }, [isDemo, sp]);

  // fetch order (poll briefly in case the webhook lags)
  useEffect(() => {
    if (isDemo) return;
    let tries = 0;
    let stop = false;
    async function load() {
      try {
        const r = await fetch(`/api/order/${id}`);
        const d = await r.json();
        if (stop) return;
        if (d.poster) setPosterStatus(d.poster);
        if (d.order) {
          setOrder(d.order);
          setLoading(false);
          // keep polling until paid, or until a bundled poster is placed
          const posterPending = d.order.posterSizeId && !d.poster?.gelatoId;
          if ((!d.order.paid || posterPending) && tries < 8) {
            tries++;
            setTimeout(load, 1800);
          }
        } else {
          setErr(d.error || "Order not found.");
          setLoading(false);
        }
      } catch (e) {
        if (!stop) {
          setErr((e as Error).message);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      stop = true;
    };
  }, [id, isDemo]);

  // acquisition clock (starts once paid)
  useEffect(() => {
    if (!order?.paid) return;
    startRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      const s = (performance.now() - (startRef.current ?? 0)) / 1000;
      setElapsed(Math.min(TOTAL, s));
      if (s < TOTAL) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [order?.paid]);

  const tier = order ? getTier(order.tierId) : null;
  const partner = tier ? getPartner(tier.partnerId) : null;
  const done = elapsed >= STAGES[STAGES.length - 1].at;
  const currentStageIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++) if (elapsed >= STAGES[i].at) idx = i;
    return idx;
  }, [elapsed]);

  const deliveredUrl = order ? esriImageUrl(order.location, 170, 1024) : "";
  // capture spec honours the customer's chosen parameters, falling back to tier
  const effSensor = order?.sensor ?? partner?.sensor ?? "optical";
  const effResolution = order?.resolution ?? tier?.resolution ?? "0.3 m";
  // highlight the ACTUAL tasked satellite (from the selected pass window) when
  // known, else a representative one for the sensor
  const highlight =
    order?.sat ||
    (effSensor === "sar"
      ? partner?.id === "umbra"
        ? "UMBRA"
        : "CAPELLA"
      : "SKYSAT");
  const globeGroup = effSensor === "sar" ? "sar" : "planet";

  if (loading)
    return <Centered>◴ Retrieving order telemetry…</Centered>;
  if (err || !order)
    return (
      <Centered>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "var(--red)", marginBottom: 10 }}>
            {err || "Order not found."}
          </div>
          <Link href="/" className="btn ghost">
            ← Back to console
          </Link>
        </div>
      </Centered>
    );

  if (!order.paid)
    return (
      <Centered>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <span className="kicker">Order {shortId(order.id)}</span>
          <h2 style={{ margin: "12px 0", fontSize: 26 }}>Payment not completed</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            This tasking order hasn&apos;t been paid yet. Head back to the console
            to complete checkout and dispatch the capture.
          </p>
          <Link href="/#task" className="btn">
            Return to console
          </Link>
        </div>
      </Centered>
    );

  return (
    <div className="op">
      {/* globe */}
      <div className="op-globe">
        <GlobeClient
          group={globeGroup}
          limit={110}
          height="100%"
          target={order.location}
          highlightName={highlight}
          focusTarget
          focusDistance={done ? 168 : 205}
          autoRotate={false}
        />
      </div>

      {/* header */}
      <div className="op-top">
        <Link href="/" className="brand">
          <span className="sat-dot" />
          SHOT&nbsp;FROM&nbsp;SPACE
        </Link>
        <div className="row" style={{ gap: 8 }}>
          {isDemo && <span className="chip sar">◑ DEMO PASS</span>}
          <span className="chip on">
            ● {done ? "CAPTURE DELIVERED" : "ACQUISITION LIVE"}
          </span>
        </div>
      </div>

      {/* mission panel */}
      <div className="op-panel panel">
        <div style={{ padding: "15px 16px 12px" }}>
          <span className="label">Mission {shortId(order.id)}</span>
          <div className="mono" style={{ fontSize: 12, marginTop: 8, color: "var(--ink)" }}>
            {order.target ? `“${order.target}”` : "Target"} · {order.label}
          </div>
          <div className="mono faint" style={{ fontSize: 11, marginTop: 3 }}>
            {fmtCoord(order.location)}
          </div>
          <div className="row wrap-gap" style={{ gap: 6, marginTop: 10 }}>
            <span className={`chip ${effSensor === "sar" ? "sar" : ""}`}>
              {effResolution} {effSensor}
            </span>
            <span className="chip">{partner?.name}</span>
            <span className="chip">
              {isDemo ? "no charge" : `$${(order.amount / 100).toFixed(0)} paid`}
            </span>
          </div>
          {order.sat && (
            <div className="mono" style={{ fontSize: 11, marginTop: 9, color: "var(--green)" }}>
              🛰 tasked satellite · {order.sat}
            </div>
          )}
          {order.attemptAt && (
            <div className="mono faint" style={{ fontSize: 10.5, marginTop: 8 }}>
              ⧗ attempt window from{" "}
              {new Date(order.attemptAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>

        <hr className="hair" />

        {/* progress */}
        <div style={{ padding: "12px 16px" }}>
          <div className="op-progress">
            <div
              className="op-progress-fill"
              style={{ width: `${(elapsed / TOTAL) * 100}%` }}
            />
          </div>
          <div className="row spread" style={{ marginTop: 6 }}>
            <span className="mono faint" style={{ fontSize: 10 }}>
              {done ? "COMPLETE" : STAGES[currentStageIdx].label.toUpperCase()}
            </span>
            <span className="mono faint tnum" style={{ fontSize: 10 }}>
              {Math.round((elapsed / TOTAL) * 100)}%
            </span>
          </div>
        </div>

        <hr className="hair" />

        {/* log */}
        <div className="op-log">
          {STAGES.filter((_, i) => i <= currentStageIdx).map((s, i) => (
            <div key={s.key} className="op-logrow">
              <span className={`op-tick ${i === currentStageIdx && !done ? "live" : "ok"}`} />
              <div>
                <div className="mono op-log-t">{s.label}</div>
                <div className="mono faint op-log-d">
                  {s.detail(partner?.name ?? "the constellation")}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* delivered image */}
      {done && (
        <div className="op-deliver panel">
          <div className="row spread" style={{ padding: "12px 14px" }}>
            <span className="label">Delivered capture</span>
            <span className="chip on">◉ {effResolution} {effSensor}</span>
          </div>
          <div className="op-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={deliveredUrl} alt="Delivered satellite capture of the target" />
            <div className="op-scan" />
            <div className="op-image-foot mono">
              <span>{fmtCoord(order.location)}</span>
              <span className="faint">{partner?.name}</span>
            </div>
          </div>
          <div className="row" style={{ gap: 8, padding: 12 }}>
            <a className="btn" href={deliveredUrl} target="_blank" rel="noreferrer" style={{ flex: 1, justifyContent: "center" }}>
              ⤓ Download full frame
            </a>
            <Link href="/#task" className="btn ghost" style={{ justifyContent: "center" }}>
              Task another
            </Link>
          </div>

          {/* order a physical poster (Gelato print-on-demand) */}
          <hr className="hair" />
          {order.posterSizeId ? (
            <div style={{ padding: "12px 14px 14px" }}>
              <div className="row spread" style={{ marginBottom: 6 }}>
                <span className="label">🖼 Poster included</span>
                <span className="faint mono" style={{ fontSize: 9 }}>
                  by Gelato
                </span>
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--green)" }}>
                ✓ {posterStatus?.label || `${order.posterSizeId}"`} print ·{" "}
                {posterStatus?.gelatoId
                  ? `queued (${String(posterStatus.gelatoId).slice(0, 8)}…)`
                  : isDemo
                  ? "demo — not submitted"
                  : "submitting to print network…"}
              </div>
              <div className="faint mono" style={{ fontSize: 10, marginTop: 6 }}>
                Shipping to the address you entered at checkout.
              </div>
            </div>
          ) : (
          <div style={{ padding: "12px 14px 14px" }}>
            <div className="row spread" style={{ marginBottom: 10 }}>
              <span className="label">🖼 Print it as a poster</span>
              <span className="faint mono" style={{ fontSize: 9 }}>
                by Gelato
              </span>
            </div>
            <div className="poster-sizes">
              {POSTER_SIZES.map((s) => (
                <button
                  key={s.id}
                  className={`poster-size ${posterSizeId === s.id ? "on" : ""}`}
                  onClick={() => setPosterSizeId(s.id)}
                >
                  <span className="ps-label mono">{s.label}</span>
                  <span className="ps-dim mono faint">{s.dim}</span>
                  <span className="ps-price mono">${s.price}</span>
                </button>
              ))}
            </div>
            <button
              className="btn"
              style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
              onClick={orderPoster}
              disabled={posterBusy}
            >
              {posterBusy
                ? "Opening checkout…"
                : `◈ Order ${posterSize(posterSizeId).label} poster · $${posterSize(posterSizeId).price}`}
            </button>
            {posterErr && <div className="err mono" style={{ fontSize: 11, marginTop: 8, color: "var(--red)", textAlign: "center" }}>{posterErr}</div>}
            <div className="faint mono" style={{ fontSize: 9.5, marginTop: 8, textAlign: "center" }}>
              Museum-grade matte · printed &amp; shipped worldwide
            </div>
          </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: css }} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "var(--mono)",
        color: "var(--muted)",
        fontSize: 13,
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </div>
  );
}

function shortId(id: string) {
  return "SFS-" + id.slice(-6).toUpperCase();
}

const css = `
.op{ position:fixed; inset:0; overflow:hidden; }
.op-globe{ position:absolute; inset:0; }
.op-top{ position:absolute; z-index:10; top:0; left:0; right:0; height:56px; display:flex; align-items:center; justify-content:space-between;
  padding:0 18px; background:linear-gradient(180deg, rgba(5,7,13,.82), transparent); }
.op-panel{ position:absolute; z-index:10; top:70px; left:18px; width:330px; max-width:calc(100vw - 36px);
  background:rgba(10,14,23,.74); backdrop-filter:blur(11px); }
.op-progress{ height:5px; border-radius:4px; background:rgba(255,255,255,.08); overflow:hidden; }
.op-progress-fill{ height:100%; background:linear-gradient(90deg, var(--cobalt), var(--green)); transition:width .2s linear; }
.op-log{ max-height:34vh; overflow-y:auto; padding:8px 0; }
.op-logrow{ display:flex; gap:10px; padding:7px 16px; align-items:flex-start; }
.op-tick{ width:8px; height:8px; border-radius:50%; margin-top:4px; flex:none; }
.op-tick.ok{ background:var(--green); box-shadow:0 0 6px var(--green); }
.op-tick.live{ background:var(--cobalt); box-shadow:0 0 8px var(--cobalt); animation:pulse 1.1s infinite; }
.op-log-t{ font-size:11.5px; color:var(--ink); }
.op-log-d{ font-size:10px; margin-top:1px; }
.op-deliver{ position:absolute; z-index:10; top:70px; right:18px; width:340px; max-width:calc(100vw - 36px);
  background:rgba(10,14,23,.8); backdrop-filter:blur(11px); animation:rise .5s ease; }
@keyframes rise{ from{ opacity:0; transform:translateY(14px);} to{ opacity:1; transform:none;} }
.op-image{ position:relative; aspect-ratio:1/1; overflow:hidden; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.op-image img{ width:100%; height:100%; object-fit:cover; display:block; }
.op-scan{ position:absolute; left:0; right:0; top:0; height:40%; pointer-events:none;
  background:linear-gradient(180deg, rgba(52,209,122,.28), transparent); animation:scan 2.6s ease-in-out 1; }
@keyframes scan{ 0%{ transform:translateY(-40%);} 100%{ transform:translateY(250%);} }
.op-image-foot{ position:absolute; left:0; right:0; bottom:0; display:flex; justify-content:space-between; padding:7px 10px; font-size:10px;
  background:linear-gradient(transparent, rgba(5,7,13,.85)); letter-spacing:.05em; }
.poster-sizes{ display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
.poster-size{ display:flex; flex-direction:column; align-items:center; gap:2px; padding:9px 4px; cursor:pointer;
  background:var(--void); border:1px solid var(--line-2); border-radius:9px; color:var(--ink); transition:all .12s; }
.poster-size:hover{ border-color:var(--muted); }
.poster-size.on{ border-color:var(--cobalt); background:var(--cobalt-soft); }
.ps-label{ font-size:11px; font-weight:700; }
.ps-dim{ font-size:8.5px; }
.ps-price{ font-size:11px; color:#a7bcff; margin-top:2px; }
@media (max-width:820px){
  .op-panel{ top:auto; bottom:12px; left:12px; right:12px; width:auto; max-height:42vh; overflow-y:auto; }
  .op-deliver{ top:64px; left:12px; right:12px; width:auto; max-height:none; overflow-y:auto; }
  .op-log{ max-height:20vh; }
}
`;
