// A random ID for this browser, sent with API calls so limits can be applied
// per device as well as per IP. It identifies nothing about the person.
const KEY = "bh-device";

export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
}

export const apiHeaders = (extra: Record<string, string> = {}) => ({ "x-device-id": deviceId(), ...extra });
