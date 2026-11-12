export function postalCityQuery(address: string | null | undefined): string | null {
  const match = address?.match(/\b(\d{5})\s+([^,;\n·]+)/u);
  return match ? `${match[1]} ${match[2].trim()}, Deutschland` : null;
}

export function distanceKm(a: [number, number], b: [number, number]): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const [lat1, lng1] = a.map(radians);
  const [lat2, lng2] = b.map(radians);
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
