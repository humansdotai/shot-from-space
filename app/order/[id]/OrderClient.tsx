"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import GlobeClient from "../../components/GlobeClient";
import { tier as getTier, partner as getPartner, TIERS } from "@/lib/catalog";
import { esriImageUrl, fmtCoord } from "@/lib/geo";
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

  // demo pass: synthesize a paid order from query params, no Stripe, no charge
  useEffect(() => {
    if (!isDemo) return;
    const lat = parseFloat(sp.get("lat") ?? "48.8584");
    const lng = parseFloat(sp.get("lng") ?? "2.2945");
    const tierId = TIERS.some((t) => t.id === sp.get("tier"))
      ? (sp.get("tier") as string)
      : "priority";
    setOrder({
      id: "demo",
      tierId,
      location: { lat, lng },
      label: sp.get("label") || "Demo target",
      target: sp.get("target") || "this location",
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
        if (d.order) {
          setOrder(d.order);
          setLoading(false);
          if (!d.order.paid && tries < 6) {
            tries++;
            setTimeout(load, 1500);
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
  const highlight = partner
    ? partner.sensor === "sar"
      ? partner.id === "umbra"
        ? "UMBRA"
        : "CAPELLA"
      : "SKYSAT"
    : null;
  const globeGroup = partner?.sensor === "sar" ? "sar" : "planet";

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
          autoRotate={!done}
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
            <span className={`chip ${partner?.sensor === "sar" ? "sar" : ""}`}>
              {tier?.resolution} {tier?.sensor}
            </span>
            <span className="chip">{partner?.name}</span>
            <span className="chip">
              {isDemo ? "no charge" : `$${(order.amount / 100).toFixed(0)} paid`}
            </span>
          </div>
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
            <span className="chip on">◉ {partner?.resolution}</span>
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
        </div>
      )}

      <style>{css}</style>
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
@media (max-width:820px){
  .op-panel{ top:auto; bottom:12px; left:12px; right:12px; width:auto; max-height:42vh; overflow-y:auto; }
  .op-deliver{ top:64px; left:12px; right:12px; width:auto; }
  .op-log{ max-height:20vh; }
}
`;
