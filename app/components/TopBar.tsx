import Link from "next/link";

export default function TopBar() {
  return (
    <header className="topbar">
      <div className="wrap row spread" style={{ width: "100%" }}>
        <Link href="/" className="brand">
          <span className="sat-dot" />
          SHOT&nbsp;FROM&nbsp;SPACE
        </Link>
        <nav className="topnav">
          <Link href="/mission-control" className="hide-sm">
            Mission Control
          </Link>
          <Link href="/#partners" className="hide-sm">
            Partners
          </Link>
          <Link href="/#task" className="cta">
            Task a satellite
          </Link>
        </nav>
      </div>
    </header>
  );
}
