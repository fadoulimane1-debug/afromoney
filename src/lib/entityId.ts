/** Identifiant local stable côté client (hors render React — évite règles purity ESLint). */
export function newEntityId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
