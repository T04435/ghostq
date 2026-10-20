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
