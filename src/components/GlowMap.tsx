import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ponytail: one shared glowing-dot map for both network views
// (Behörde → Sentinels, Sentinel → Einrichtungen). Leaflet + OSM are
// already in the bundle + CSP — no new dep, no GeoJSON needed.

export type GlowPoint = {
  key: string;
  name: string;
  detail?: string;
  href?: string;
  linkLabel?: string;
  lat: number;
  lng: number;
  tone?: "primary" | "success" | "info";
};

const TONE_VAR = { primary: "--primary", success: "--success", info: "--info" } as const;

const dotIcon = (tone: GlowPoint["tone"] = "primary") =>
  L.divIcon({
    // Empty className kills leaflet's default white square marker box.
    className: "",
    html: `<span class="glowdot" style="--gd:hsl(var(${TONE_VAR[tone]}))"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const GLOW_CSS = `
.glowdot{position:relative;display:block;width:12px;height:12px;margin:3px;background:var(--gd);border-radius:9999px;box-shadow:0 0 0 2px hsl(var(--background)),0 0 14px 3px var(--gd)}
.glowdot::after{content:"";position:absolute;inset:-8px;border-radius:9999px;border:1px solid var(--gd);animation:glowping 2.2s ease-out infinite}
@keyframes glowping{0%{transform:scale(.45);opacity:.9}100%{transform:scale(1.2);opacity:0}}
@media (prefers-reduced-motion:reduce){.glowdot::after{animation:none}}
html.dark .glowmap .leaflet-tile-pane{filter:grayscale(.85) brightness(.92) contrast(1.05)}
`;

export const GlowMap = ({ points, height = "h-96" }: { points: GlowPoint[]; height?: string }) => {
  if (points.length === 0) return null;
  const single = points.length === 1;
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
  return (
    <div className={`glowmap w-full overflow-hidden border border-border ${height}`}>
      <style>{GLOW_CSS}</style>
      {single ? (
        <MapContainer center={[points[0].lat, points[0].lng]} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[points[0].lat, points[0].lng]} icon={dotIcon(points[0].tone)}>
            <Popup>
              <strong>{points[0].name}</strong>
              {points[0].detail && <><br />{points[0].detail}</>}
              {points[0].href && <><br /><Link to={points[0].href}>{points[0].linkLabel ?? "Profil"}</Link></>}
            </Popup>
          </Marker>
        </MapContainer>
      ) : (
        <MapContainer bounds={bounds} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((p) => (
            <Marker key={p.key} position={[p.lat, p.lng]} icon={dotIcon(p.tone)}>
              <Popup>
                <strong>{p.name}</strong>
                {p.detail && <><br />{p.detail}</>}
                {p.href && <><br /><Link to={p.href}>{p.linkLabel ?? "Profil"}</Link></>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
};
