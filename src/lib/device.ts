/**
 * The device cookie: a random id, set on a visitor's first request (src/proxy.ts) and used only to count the
 * per-device limits, so judges sharing one network each get their own allowance. No personal data, no tracking.
 */
export const DEVICE_COOKIE = "ghostq_device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isDeviceId(value: string | undefined | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value));
}
