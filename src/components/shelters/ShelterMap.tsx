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

  // No coordinates at all → show a hint instead of a markerless Germany map
  // that looks broken. (Geocoding runs on shelter save via Photon.)
  if (withPos.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center border border-border text-center text-xs text-muted-foreground">
        Keine Koordinaten hinterlegt — Adresse in der Einrichtungsverwaltung speichern, um sie auf der Karte zu sehen.
      </div>
    );
  }

  // Fit the map to the markers: one shelter → local zoom, several → bounds.
  const single = withPos.length === 1;
  const pos: [number, number][] = withPos.map((s) => [s.lat as number, s.lng as number]);

  return (
    <div className="h-80 w-full overflow-hidden border border-border">
      {single ? (
        <MapContainer center={pos[0]} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={pos[0]} icon={icon}>
            <Popup>
              <strong>{withPos[0].name}</strong>
              <br />
              {withPos[0].region}
            </Popup>
          </Marker>
        </MapContainer>
      ) : (
        <MapContainer bounds={L.latLngBounds(pos)} className="h-full w-full" scrollWheelZoom={false}>
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
      )}
    </div>
  );
}
