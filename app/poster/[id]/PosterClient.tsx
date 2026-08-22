"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "../../components/TopBar";
import { fmtCoord } from "@/lib/geo";

interface PosterOrder {
  id: string;
  paid: boolean;
  size: { id: string; label: string; dim: string; price: number } | null;
  label: string;
  target: string;
  location: { lat: number; lng: number };
  previewUrl: string;
  amount: number;
  shipping: any;
  gelato: { id: string; status: string } | null;
  error?: string;
}

export default function PosterClient({ id }: { id: string }) {
  const [data, setData] = useState<PosterOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let tries = 0;
    async function load() {
      try {
        const r = await fetch(`/api/poster/${id}`);
        const d = await r.json();
        if (stop) return;
        if (r.ok) {
          setData(d);
          // keep polling until the Gelato order id appears (or a few tries)
          if (d.paid && !d.gelato && tries < 5) {
            tries++;
            setTimeout(load, 2000);
          }
        } else setErr(d.error || "Not found.");
      } catch (e) {
        if (!stop) setErr((e as Error).message);
      }
    }
    load();
    return () => {
      stop = true;
    };
  }, [id]);

  if (err)
    return (
      <Shell>
        <div className="center">
          <div style={{ color: "var(--red)", marginBottom: 12 }}>{err}</div>
          <Link href="/" className="btn ghost">
            ← Back to console
          </Link>
        </div>
      </Shell>
    );

  if (!data)
    return (
      <Shell>
        <div className="center mono muted">◴ confirming your order…</div>
      </Shell>
    );

  if (!data.paid)
    return (
      <Shell>
        <div className="center" style={{ maxWidth: 420 }}>
          <h2 style={{ fontSize: 26, marginBottom: 10 }}>Payment not completed</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            This poster order hasn&apos;t been paid yet.
          </p>
          <Link href="/" className="btn">
            Back to console
          </Link>
        </div>
      </Shell>
    );

  const addr = data.shipping?.address;
  return (
    <Shell>
      <div className="poster-wrap">
        <div className="poster-card panel">
          <div className="poster-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.previewUrl} alt="Poster preview" />
          </div>
        </div>
        <div className="poster-info">
          <span className="chip on">● ORDER CONFIRMED</span>
          <h1 style={{ fontSize: "clamp(28px,4vw,40px)", margin: "14px 0 6px" }}>
            Your poster is on its way.
          </h1>
          <p className="muted" style={{ marginBottom: 20 }}>
            A {data.size?.label} ({data.size?.dim}) museum-grade matte print of{" "}
            {data.target ? `“${data.target}”` : "your capture"} — printed and
            shipped by Gelato from the facility nearest you.
          </p>

          <div className="poster-rows mono">
            <Row k="Order" v={`SFS-${data.id.slice(-6).toUpperCase()}`} />
            <Row k="Poster" v={`${data.size?.label} · ${data.size?.dim}`} />
            <Row k="Target" v={fmtCoord(data.location)} />
            <Row
              k="Print status"
              v={
                data.gelato
                  ? `${data.gelato.status} · ${String(data.gelato.id).slice(0, 8)}…`
                  : "submitting to print network…"
              }
            />
            {addr && (
              <Row
                k="Ship to"
                v={`${data.shipping?.name ?? ""}, ${addr.city ?? ""} ${addr.country ?? ""}`}
              />
            )}
            <Row k="Paid" v={`$${(data.amount / 100).toFixed(2)}`} />
          </div>

          <div className="row wrap-gap" style={{ gap: 10, marginTop: 22 }}>
            <Link href="/#task" className="btn">
              Task another satellite
            </Link>
            <Link href="/mission-control" className="btn ghost">
              Mission control
            </Link>
          </div>
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .poster-wrap{ max-width:980px; margin:40px auto; padding:0 24px; display:grid; grid-template-columns:1fr 1fr; gap:36px; align-items:center; }
        @media (max-width:820px){ .poster-wrap{ grid-template-columns:1fr; } }
        .poster-card{ padding:22px; background:
          radial-gradient(500px 300px at 80% -10%, rgba(58,107,255,.14), transparent 60%), linear-gradient(180deg,var(--panel),var(--deck)); }
        .poster-preview{ aspect-ratio:1/1; border-radius:8px; overflow:hidden; box-shadow:0 30px 60px -20px rgba(0,0,0,.7); border:1px solid var(--line-2); }
        .poster-preview img{ width:100%; height:100%; object-fit:cover; display:block; }
        .poster-rows{ display:flex; flex-direction:column; gap:0; border-top:1px solid var(--line); }
        .prow{ display:flex; justify-content:space-between; gap:16px; padding:10px 0; border-bottom:1px solid var(--line); font-size:12px; }
        .prow .pk{ color:var(--muted); letter-spacing:.06em; text-transform:uppercase; font-size:10px; }
        .prow .pv{ color:var(--ink); text-align:right; }
        .center{ min-height:60vh; display:grid; place-items:center; text-align:center; padding:24px; }
      `,
        }}
      />
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="prow">
      <span className="pk">{k}</span>
      <span className="pv">{v}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      {children}
    </>
  );
}
