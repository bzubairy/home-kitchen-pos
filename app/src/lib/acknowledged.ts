// Website orders this phone has already seen, so the in-app alarm stops for them.
// Per device only; if storage is unavailable it falls back to memory.

const KEY = 'kitchen.acknowledgedOrders'
const EVENT = 'kitchen:acknowledged'
let memory: string[] = []

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
  } catch {
    return memory
  }
}

export function isAcknowledged(id: string) {
  return read().includes(id)
}

export function acknowledgeOrders(ids: string[]) {
  const next = [...new Set([...ids, ...read()])].slice(0, 200)
  memory = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Memory copy is enough for this session.
  }
  window.dispatchEvent(new Event(EVENT))
}

export function onAcknowledged(listener: () => void) {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
