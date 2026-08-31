const DELETED_CATS_KEY = "cerceve-deleted-category-ids";
const DELETED_FRAMES_KEY = "cerceve-deleted-frame-ids";

function readIdList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeIdList(key, ids) {
  localStorage.setItem(key, JSON.stringify([...new Set(ids.filter(Boolean))]));
}

function rememberId(key, id) {
  if (!id) return;
  const ids = readIdList(key);
  if (!ids.includes(id)) {
    ids.push(id);
    writeIdList(key, ids);
  }
}

function forgetId(key, id) {
  if (!id) return;
  writeIdList(
    key,
    readIdList(key).filter((item) => item !== id)
  );
}

export function markFrameRemoved(id) {
  rememberId(DELETED_FRAMES_KEY, id);
}

export function markCategoryRemoved(id) {
  rememberId(DELETED_CATS_KEY, id);
}

export function clearCategoryRemoved(id) {
  forgetId(DELETED_CATS_KEY, id);
}

export function loadDeletedCategoryIds() {
  return readIdList(DELETED_CATS_KEY);
}

export function loadDeletedFrameIds() {
  return readIdList(DELETED_FRAMES_KEY);
}

export function rememberDeletedCategoryIds(ids = []) {
  writeIdList(DELETED_CATS_KEY, [...readIdList(DELETED_CATS_KEY), ...ids]);
  return loadDeletedCategoryIds();
}

export function rememberDeletedFrameIds(ids = []) {
  writeIdList(DELETED_FRAMES_KEY, [...readIdList(DELETED_FRAMES_KEY), ...ids]);
  return loadDeletedFrameIds();
}

function newerStamp(a, b) {
  return (Number(a) || 0) >= (Number(b) || 0);
}

export function mergeCustomFrames(local = [], shared = []) {
  const removed = new Set(loadDeletedFrameIds());
  const byId = new Map();

  for (const frame of local) {
    if (!frame?.id || removed.has(frame.id)) continue;
    byId.set(frame.id, frame);
  }

  for (const frame of shared) {
    if (!frame?.id || removed.has(frame.id)) continue;
    const current = byId.get(frame.id);
    const incoming = { ...frame, custom: true };
    if (!current) {
      byId.set(frame.id, incoming);
      continue;
    }
    if (newerStamp(current.updatedAt, incoming.updatedAt)) {
      if (!current.image && incoming.image) {
        byId.set(frame.id, { ...current, image: incoming.image });
      }
      continue;
    }
    byId.set(frame.id, {
      ...current,
      ...incoming,
      image: incoming.image || current.image,
    });
  }

  return [...byId.values()];
}

export function mergeCategories(local = [], shared = []) {
  const deleted = new Set(loadDeletedCategoryIds());
  const byId = new Map();

  for (const cat of shared) {
    if (!cat?.id || deleted.has(cat.id)) continue;
    byId.set(cat.id, cat);
  }
  for (const cat of local) {
    if (!cat?.id || deleted.has(cat.id)) continue;
    if (!byId.has(cat.id)) byId.set(cat.id, cat);
  }

  return [...byId.values()];
}

export function mergeIdLists(local = [], shared = []) {
  return [...new Set([...(local ?? []), ...(shared ?? [])].filter(Boolean))];
}

export function mergeObjectMaps(local = {}, shared = {}) {
  return { ...(shared ?? {}), ...(local ?? {}) };
}
