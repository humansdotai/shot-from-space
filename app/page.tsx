import Link from "next/link";
import TopBar from "./components/TopBar";
import TaskConsole from "./components/TaskConsole";
import GlobeClient from "./components/GlobeClient";
import { PARTNERS } from "@/lib/catalog";

export default function Home() {
  return (
    <>
      <TopBar />

      {/* ── hero ── */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="kicker">Commercial Earth observation · on demand</span>
            <h1 className="display-xl" style={{ marginTop: 18 }}>
              Task a satellite
              <br />
              to photograph
              <br />
              <span style={{ color: "var(--cobalt)" }}>your house.</span>
            </h1>
            <p className="lede" style={{ marginTop: 22 }}>
              Drop a pin anywhere on Earth. We book the next pass on a live
              constellation, charge your card, and deliver a fresh capture of
              your rooftop from low orbit — tracked the whole way in a 3D mission
              control.
            </p>
            <div className="row wrap-gap" style={{ marginTop: 26, gap: 12 }}>
              <Link href="#task" className="btn">
                ◎ Task a satellite
              </Link>
              <Link href="/mission-control" className="btn ghost">
                ▤ Open mission control
              </Link>
            </div>
            <div className="row wrap-gap hero-stats">
              <Stat n={String(PARTNERS.length)} l="imagery partners" />
              <Stat n="0.25 m" l="best resolution" />
              <Stat n="LEO" l="live tracked" />
            </div>
          </div>

          <div className="hero-globe panel">
            <div className="globe-hud">
              <span className="chip on">● LIVE ORBIT FEED</span>
              <span className="faint mono" style={{ fontSize: 10 }}>
                CELESTRAK · SGP4
              </span>
            </div>
            <GlobeClient group="active" limit={120} height="100%" autoRotate />
            <div className="globe-foot mono faint">
              drag to orbit · scroll to zoom
            </div>
          </div>
        </div>
      </section>

      {/* ── task console ── */}
      <section id="task" className="wrap section">
        <SectionHead
          kicker="The console"
          title="Point. Pay. Photographed from space."
          sub="Search an address or drop a pin, choose a capture spec, and check out. Real charge, real tasking order."
        />
        <TaskConsole />
      </section>

      {/* ── how it works ── */}
      <section className="wrap section">
        <SectionHead kicker="How it works" title="Four steps to orbit" />
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={i} className="panel step">
              <div className="step-n mono">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="step-t">{s.t}</h3>
              <p className="muted" style={{ fontSize: 13.5 }}>
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── partners ── */}
      <section id="partners" className="wrap section">
        <SectionHead
          kicker="The fleet"
          title="Every constellation, one console"
          sub="We broker captures across the commercial EO market — optical, radar, day or night. Add a partner API key and orders route to them live; otherwise we run a faithful simulated pass."
        />
        <div className="partners">
          {PARTNERS.map((p) => (
            <a key={p.id} href={p.site} target="_blank" rel="noreferrer" className="panel partner">
              <div className="row spread">
                <span className="partner-name">{p.name}</span>
                <span className={`chip ${p.sensor === "sar" ? "sar" : ""}`}>
                  {p.sensor}
                </span>
              </div>
              <div className="partner-res mono">{p.resolution}</div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                {p.blurb}
              </p>
              <div className="partner-api mono">
                {p.api === "live"
                  ? "◉ self-serve API"
                  : p.api === "partner-account"
                  ? "◎ partner account"
                  : "○ simulated"}
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── manifesto (0humans style) ── */}
      <section className="wrap section">
        <div className="panel manifesto">
          <span className="kicker">Operated by machines</span>
          <h2 style={{ fontSize: "clamp(26px,4vw,44px)", marginTop: 14, maxWidth: "18ch" }}>
            A zero-human orbital imaging desk that never closes.
          </h2>
          <p className="lede" style={{ marginTop: 16 }}>
            No sales calls, no quote forms, no account managers. An autonomous
            agent watches the passes, prices the capture, takes the payment and
            dispatches the tasking order — the same way{" "}
            <a href="https://0humans.com" target="_blank" rel="noreferrer" style={{ color: "var(--cobalt)" }}>
              0humans
            </a>{" "}
            runs whole companies with nobody at the desk.
          </p>
        </div>
      </section>

      <footer className="wrap footer">
        <div className="row spread wrap-gap">
          <span className="mono faint" style={{ fontSize: 11 }}>
            SHOT FROM SPACE · a humans.ai lab experiment
          </span>
          <div className="row wrap-gap" style={{ gap: 16 }}>
            <Link href="/mission-control" className="mono faint" style={{ fontSize: 11 }}>
              MISSION CONTROL
            </Link>
            <a href="https://humans.ai" target="_blank" rel="noreferrer" className="mono faint" style={{ fontSize: 11 }}>
              HUMANS.AI
            </a>
          </div>
        </div>
      </footer>

      <PageStyles />
    </>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="stat">
      <div className="stat-n mono">{n}</div>
      <div className="stat-l label">{l}</div>
    </div>
  );
}

function SectionHead({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="section-head">
      <span className="kicker">{kicker}</span>
      <h2 style={{ fontSize: "clamp(26px,4vw,42px)", marginTop: 10 }}>{title}</h2>
      {sub && (
        <p className="lede" style={{ marginTop: 12 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

const STEPS = [
  { t: "Lock the target", d: "Search an address or click the satellite preview to drop a precise pin on your roof." },
  { t: "Choose a capture", d: "Optical or all-weather radar, 0.5 m to 0.25 m, standard or priority pass." },
  { t: "Pay securely", d: "Stripe checkout. The moment payment settles, the tasking order is dispatched to the partner." },
  { t: "Watch it happen", d: "A live 3D mission control tracks the satellite to your coordinates, then delivers the image." },
];

function PageStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
      .hero{ padding: 48px 0 20px; }
      .hero-grid{ display:grid; grid-template-columns: 1.15fr 1fr; gap: 40px; align-items:center; }
      @media (max-width: 960px){ .hero-grid{ grid-template-columns:1fr; } }
      .hero-globe{ position:relative; height: 460px; overflow:hidden; padding:0; }
      @media (max-width: 960px){ .hero-globe{ height: 380px; } }
      .globe-hud{ position:absolute; z-index:5; top:14px; left:14px; right:14px; display:flex; justify-content:space-between; align-items:center; pointer-events:none; }
      .globe-foot{ position:absolute; z-index:5; bottom:12px; left:0; right:0; text-align:center; font-size:10px; letter-spacing:.14em; text-transform:uppercase; pointer-events:none; }
      .hero-stats{ margin-top:30px; gap:34px; border-top:1px solid var(--line); padding-top:20px; }
      .stat-n{ font-size:24px; font-weight:700; }
      .stat-l{ margin-top:2px; }
      .section{ padding: 64px 24px; }
      .section-head{ max-width: 62ch; }
      .steps{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:28px; }
      @media (max-width: 860px){ .steps{ grid-template-columns:repeat(2,1fr); } }
      @media (max-width: 480px){ .steps{ grid-template-columns:1fr; } }
      .step{ padding:20px; }
      .step-n{ color:var(--cobalt); font-size:12px; font-weight:700; letter-spacing:.1em; }
      .step-t{ font-size:17px; margin:10px 0 6px; }
      .partners{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:28px; }
      @media (max-width: 980px){ .partners{ grid-template-columns:repeat(2,1fr); } }
      @media (max-width: 520px){ .partners{ grid-template-columns:1fr; } }
      .partner{ padding:16px; transition:transform .14s, border-color .14s; }
      .partner:hover{ transform:translateY(-2px); border-color:var(--line-2); }
      .partner-name{ font-family:var(--display); font-weight:600; font-size:14.5px; }
      .partner-res{ font-size:22px; font-weight:700; margin-top:10px; letter-spacing:-.01em; }
      .partner-api{ font-size:10px; letter-spacing:.06em; color:var(--muted); margin-top:12px; text-transform:uppercase; }
      .manifesto{ padding: clamp(28px, 5vw, 56px); background:
        radial-gradient(700px 300px at 85% -20%, rgba(58,107,255,.16), transparent 60%), linear-gradient(180deg, var(--panel), var(--deck)); }
      .footer{ padding: 30px 24px 60px; border-top:1px solid var(--line); margin-top:20px; }
    `,
      }}
    />
  );
}
