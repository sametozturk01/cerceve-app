const STORAGE_KEY = "cerceve-hidden-frame-ids";
const STACK_KEY = "cerceve-hidden-frame-stack";

function readIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
}

function readStack() {
  try {
    const raw = localStorage.getItem(STACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack) {
  localStorage.setItem(STACK_KEY, JSON.stringify(stack));
}

export function loadHiddenFrameIds() {
  return new Set(readIds());
}

export function hideFrameId(id) {
  const ids = readIds();
  if (!ids.includes(id)) ids.push(id);
  writeIds(ids);

  const stack = readStack();
  stack.push(id);
  writeStack(stack);

  return new Set(ids);
}

export function unhideFrameId(id) {
  const ids = readIds().filter((x) => x !== id);
  writeIds(ids);
  writeStack(readStack().filter((x) => x !== id));
  return new Set(ids);
}

export function peekLastHiddenFrameId() {
  const stack = readStack();
  if (stack.length) return stack[stack.length - 1];
  const ids = readIds();
  return ids.length ? ids[ids.length - 1] : null;
}

export function restoreLastHiddenFrame() {
  const stack = readStack();
  const id = stack.length ? stack.pop() : readIds().at(-1);
  if (!id) return null;

  writeStack(stack);
  const ids = readIds().filter((x) => x !== id);
  writeIds(ids);
  return id;
}
