"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type GlobeType from "./Globe";

const Globe = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        color: "var(--faint)",
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: "0.16em",
      }}
    >
      ◴ ACQUIRING ORBITAL TELEMETRY…
    </div>
  ),
});

export default function GlobeClient(props: ComponentProps<typeof GlobeType>) {
  return <Globe {...props} />;
}
