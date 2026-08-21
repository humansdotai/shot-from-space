"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type LocatorMapType from "./LocatorMap";

const LocatorMap = dynamic(() => import("./LocatorMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 300,
        marginTop: 12,
        borderRadius: 12,
        border: "1px solid var(--line-2)",
        background: "#0a0e17",
        display: "grid",
        placeItems: "center",
        color: "var(--faint)",
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: "0.14em",
      }}
    >
      ◴ LOADING MAP…
    </div>
  ),
});

export default function LocatorMapClient(
  props: ComponentProps<typeof LocatorMapType>
) {
  return <LocatorMap {...props} />;
}
