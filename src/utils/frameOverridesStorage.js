const STORAGE_KEY = "cerceve-frame-overrides";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadFrameOverrides() {
  return readAll();
}

export function saveFrameOverride(id, patch) {
  const all = readAll();
  all[id] = { ...(all[id] ?? {}), ...patch };
  writeAll(all);
  return all;
}
