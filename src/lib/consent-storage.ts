export const CURRENT_CONSENT_POLICY_VERSION = "2.6" as const;
export const CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 180 days (Garante Cookie Guidelines 2021)

export type PersistedConsentChoice = "granted" | "denied";
export type ResolvedConsentStatus = PersistedConsentChoice | "pending";

export interface StoredConsentRecord {
  status: PersistedConsentChoice;
  policyVersion: string;
  updatedAt: string;
  expiresAt: number;
}

export function serializeConsentChoice(
  status: PersistedConsentChoice,
  nowMs: number = Date.now(),
  policyVersion: string = CURRENT_CONSENT_POLICY_VERSION
): string {
  const record: StoredConsentRecord = {
    status,
    policyVersion,
    updatedAt: new Date(nowMs).toISOString(),
    expiresAt: nowMs + CONSENT_TTL_MS,
  };
  return JSON.stringify(record);
}

export function readStoredConsentChoice(
  storage: Storage | undefined,
  key: string,
  nowMs: number = Date.now()
): ResolvedConsentStatus {
  if (!storage) return "pending";
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return "pending";
  }
  if (!raw) return "pending";

  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsentRecord> | null;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed.status === "granted" || parsed.status === "denied") &&
      parsed.policyVersion === CURRENT_CONSENT_POLICY_VERSION &&
      typeof parsed.expiresAt === "number" &&
      Number.isFinite(parsed.expiresAt) &&
      parsed.expiresAt > nowMs
    ) {
      return parsed.status;
    }
  } catch {
    // Legacy unversioned string ("granted"/"denied") or malformed JSON: invalidate.
  }

  try {
    storage.removeItem(key);
  } catch {
    // ignore storage removal failure
  }
  return "pending";
}
