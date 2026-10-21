const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Standard geohash encoding, to match a city to a Qloo heatmap cell. */
export function geohash(lat: number, lon: number, precision: number): string {
  const latRange = [-90, 90];
  const lonRange = [-180, 180];
  let even = true;
  let out = "";
  while (out.length < precision) {
    let ch = 0;
    for (let bit = 0; bit < 5; bit++) {
      const range = even ? lonRange : latRange;
      const value = even ? lon : lat;
      const mid = (range[0] + range[1]) / 2;
      if (value >= mid) {
        ch = ch * 2 + 1;
        range[0] = mid;
      } else {
        ch *= 2;
        range[1] = mid;
      }
      even = !even;
    }
    out += BASE32[ch];
  }
  return out;
}

/** The square a geohash covers: [south, west, north, east]. */
export function geohashBounds(hash: string): { south: number; west: number; north: number; east: number } {
  const lat = [-90, 90];
  const lon = [-180, 180];
  let even = true;
  for (const c of hash) {
    const n = BASE32.indexOf(c);
    if (n < 0) throw new Error(`Not a geohash: ${hash}`);
    for (let bit = 4; bit >= 0; bit--) {
      const range = even ? lon : lat;
      const mid = (range[0] + range[1]) / 2;
      if ((n >> bit) & 1) range[0] = mid;
      else range[1] = mid;
      even = !even;
    }
  }
  return { south: lat[0], west: lon[0], north: lat[1], east: lon[1] };
}

/** WKT polygon for a geohash square, for Qloo's filter.location. */
export function geohashPolygon(hash: string): string {
  const b = geohashBounds(hash);
  return `POLYGON((${b.west} ${b.south}, ${b.east} ${b.south}, ${b.east} ${b.north}, ${b.west} ${b.north}, ${b.west} ${b.south}))`;
}
