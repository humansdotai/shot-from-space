"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/geo";

interface Props {
  value: LatLng;
  onChange: (p: LatLng) => void;
  height?: number;
}

// A real draggable satellite map. The target is ALWAYS the map centre — drag
// the map to put your roof under the crosshair; coordinates update live.
export default function LocatorMap({ value, onChange, height = 300 }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const lastEmitted = useRef<string>("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let map: any;
    let disposed = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !elRef.current) return;

      map = L.map(elRef.current, {
        center: [value.lat, value.lng],
        zoom: 18,
        zoomControl: false,
        attributionControl: false,
        maxZoom: 20,
      });
      mapRef.current = map;

      L.tileLayer(
        "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, maxNativeZoom: 19 }
      ).addTo(map);
      // road/label reference overlay
      L.tileLayer(
        "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 20, maxNativeZoom: 19, opacity: 0.9 }
      ).addTo(map);

      const emit = () => {
        const c = map.getCenter();
        const key = `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
        lastEmitted.current = key;
        onChangeRef.current({ lat: c.lat, lng: c.lng });
      };
      map.on("moveend", emit);
      // ensure tiles lay out correctly once mounted
      setTimeout(() => map.invalidateSize(), 60);
    })();

    return () => {
      disposed = true;
      if (map) map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // external changes (search, geolocation, manual entry) recentre the map,
  // but ignore echoes of our own drag emissions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const key = `${value.lat.toFixed(6)},${value.lng.toFixed(6)}`;
    if (key === lastEmitted.current) return;
    map.setView([value.lat, value.lng], map.getZoom() < 15 ? 17 : map.getZoom(), {
      animate: true,
    });
  }, [value.lat, value.lng]);

  return (
    <div className="locator" style={{ height }}>
      <div ref={elRef} className="locator-map" />
      <div className="locator-cross" aria-hidden>
        <span className="lc-v" />
        <span className="lc-h" />
        <span className="lc-ring" />
      </div>
      <div className="locator-zoom">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="zoom out"
        >
          −
        </button>
      </div>
      <div className="locator-hint mono">drag map · crosshair = target</div>

      <style>{css}</style>
    </div>
  );
}

const css = `
.locator{ position:relative; margin-top:12px; border-radius:12px; overflow:hidden; border:1px solid var(--line-2); background:#0a0e17; }
.locator-map{ position:absolute; inset:0; }
.leaflet-container{ background:#0a0e17; font-family:var(--mono); }
.locator-cross{ position:absolute; inset:0; pointer-events:none; z-index:500; }
.lc-v{ position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(52,209,122,.65); transform:translateX(-.5px); }
.lc-h{ position:absolute; top:50%; left:0; right:0; height:1px; background:rgba(52,209,122,.65); transform:translateY(-.5px); }
.lc-ring{ position:absolute; left:50%; top:50%; width:42px; height:42px; margin:-21px 0 0 -21px; border:1.5px solid var(--green); border-radius:50%; box-shadow:0 0 0 1px rgba(0,0,0,.4), 0 0 16px rgba(52,209,122,.55); animation:lcping 2.4s ease-out infinite; }
@keyframes lcping{ 0%{transform:scale(.7);opacity:1} 70%{transform:scale(1.2);opacity:.3} 100%{transform:scale(.7);opacity:1} }
.locator-zoom{ position:absolute; top:8px; right:8px; z-index:600; display:flex; flex-direction:column; gap:4px; }
.locator-zoom button{ width:28px; height:28px; border:1px solid var(--line-2); background:rgba(10,14,23,.82); color:var(--ink); border-radius:7px; cursor:pointer; font-size:16px; line-height:1; }
.locator-zoom button:hover{ background:var(--cobalt); border-color:var(--cobalt); }
.locator-hint{ position:absolute; left:8px; bottom:8px; z-index:600; font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink);
  background:rgba(5,7,13,.6); padding:3px 7px; border-radius:6px; pointer-events:none; }
`;
