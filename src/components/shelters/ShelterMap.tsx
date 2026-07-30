import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import type { Shelter } from "@/lib/types";

// Bundled marker assets (the unpkg CDN URLs were blocked by our own CSP).
const icon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function ShelterMap({ shelters }: { shelters: Shelter[] }) {
  const withPos = shelters.filter((s) => s.lat != null && s.lng != null);
  const center =
    withPos[0]?.lat != null && withPos[0]?.lng != null
      ? ([withPos[0].lat, withPos[0].lng] as [number, number])
      : ([51.1657, 10.4515] as [number, number]); // DE center fallback

  return (
    <div className="h-80 w-full overflow-hidden border border-border">
      <MapContainer center={center} zoom={6} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withPos.map((s) => (
          <Marker key={s.id} position={[s.lat as number, s.lng as number]} icon={icon}>
            <Popup>
              <strong>{s.name}</strong>
              <br />
              {s.region}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
