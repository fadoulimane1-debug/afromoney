/**
 * Synchronisation cloud (MongoDB via API Railway).
 * Définir sur Vercel : VITE_MONGODB_API_URL=https://afromoney-production.up.railway.app/api
 */
export function getCloudApiBase(): string | null {
  const url = (import.meta.env.VITE_MONGODB_API_URL as string | undefined)?.trim();
  if (!url) return null;
  return url.replace(/\/$/, '');
}

export function isCloudSyncEnabled(): boolean {
  return getCloudApiBase() != null;
}
