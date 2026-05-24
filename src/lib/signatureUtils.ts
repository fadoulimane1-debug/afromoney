export type SignatureMode = 'tactile' | 'souris' | 'clavier';

export interface SignatureRecord {
  cert: 'AFROMONEY_SIG_V1';
  type: SignatureMode;
  nom: string;
  timestamp: string;
  hash: string;
  image?: string;
}

export const SIGNATURE_MODE_LABELS: Record<SignatureMode, string> = {
  tactile: 'Manuscrite (tactile)',
  souris: 'Manuscrite (souris)',
  clavier: 'Électronique',
};

export function encodeSignature(record: SignatureRecord): string {
  return JSON.stringify(record);
}

export function decodeSignature(s?: string | null): SignatureRecord | null {
  if (!s) return null;
  try {
    const p = JSON.parse(s);
    if (p?.cert !== 'AFROMONEY_SIG_V1') return null;
    return p as SignatureRecord;
  } catch {
    return null;
  }
}

export function isDrawnSignatureUrl(s?: string | null): boolean {
  return Boolean(s?.startsWith('data:image/'));
}

export function isValidSignatureValue(s?: string | null): boolean {
  return isDrawnSignatureUrl(s) || decodeSignature(s) !== null;
}

export async function sha256hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
