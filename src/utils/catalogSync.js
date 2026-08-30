const STALE_MS = 120_000;

const removedFrameIds = new Map();
const removedCategoryIds = new Map();

function prune(map) {
  const now = Date.now();
  for (const [id, ts] of map) {
    if (now - ts > STALE_MS) map.delete(id);
  }
}

export function markFrameRemoved(id) {
  if (id) removedFrameIds.set(id, Date.now());
}

export function markCategoryRemoved(id) {
  if (id) removedCategoryIds.set(id, Date.now());
}

export function clearCategoryRemoved(id) {
  if (id) removedCategoryIds.delete(id);
}

function newerStamp(a, b) {
  return (Number(a) || 0) >= (Number(b) || 0);
}

export function mergeCustomFrames(local = [], shared = []) {
  prune(removedFrameIds);
  const byId = new Map();

  for (const frame of local) {
    if (!frame?.id || removedFrameIds.has(frame.id)) continue;
    byId.set(frame.id, frame);
  }

  for (const frame of shared) {
    if (!frame?.id || removedFrameIds.has(frame.id)) continue;
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
  prune(removedCategoryIds);
  const byId = new Map();

  for (const cat of shared) {
    if (!cat?.id || removedCategoryIds.has(cat.id)) continue;
    byId.set(cat.id, cat);
  }
  for (const cat of local) {
    if (!cat?.id || removedCategoryIds.has(cat.id)) continue;
    if (!byId.has(cat.id)) byId.set(cat.id, cat);
  }

  return [...byId.values()];
}

export function mergeObjectMaps(local = {}, shared = {}) {
  return { ...(shared ?? {}), ...(local ?? {}) };
}
