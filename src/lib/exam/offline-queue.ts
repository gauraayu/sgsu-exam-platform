/**
 * Short-lived local queue of answer changes the server has not acknowledged yet.
 *
 * Stored in localStorage (not IndexedDB) on purpose: writes are synchronous, so a change made
 * a moment before the tab is closed or the battery dies is on disk before the page goes away,
 * and it survives closing and reopening the browser. Only the minimum is kept: attempt id,
 * question id, the selected answer, the client mutation sequence, a timestamp and the sync
 * status. No questions, answer keys or exam configuration are ever stored.
 *
 * Every record names the student who owns it. A record belonging to another account is
 * discarded, never replayed, so switching accounts on a shared computer cannot mix answers.
 */

export interface QueuedAnswer {
  examQuestionId: string;
  selectedOption?: number | null;
  numericalValue?: string | null;
  markedForReview?: boolean;
  visited?: boolean;
  seq: number;
  updatedAt: number;
  syncStatus: "pending" | "sending";
}

export interface QueuedEvent {
  clientEventId: string;
  eventType: string;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AttemptStore {
  v: 1;
  owner: string;
  attemptId: string;
  /** Highest mutation sequence issued on this device. */
  seq: number;
  pending: Record<string, QueuedAnswer>;
  events: QueuedEvent[];
  /** Last question the student was on (navigation restore). */
  index: number;
  /** Set when the student pressed Submit but the server could not be reached. */
  submitPending: null | { reason: "submitted" | "time"; requestedAt: number };
  touchedAt: number;
}

const PREFIX = "sgsu-attempt:";
const MAX_AGE_MS = 7 * 86_400_000;

const key = (attemptId: string) => `${PREFIX}${attemptId}`;

function ls(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = `${PREFIX}probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null; // private mode, disabled storage or quota exhausted
  }
}

export function storageAvailable() {
  return ls() !== null;
}

export function emptyStore(attemptId: string, owner: string): AttemptStore {
  return { v: 1, owner, attemptId, seq: 0, pending: {}, events: [], index: 0, submitPending: null, touchedAt: Date.now() };
}

/** Loads this student's queue for the attempt. Foreign, corrupt or expired records are dropped. */
export function loadStore(attemptId: string, owner: string): AttemptStore {
  const s = ls();
  if (!s) return emptyStore(attemptId, owner);
  try {
    const raw = s.getItem(key(attemptId));
    if (!raw) return emptyStore(attemptId, owner);
    const v = JSON.parse(raw) as AttemptStore;
    if (v?.v !== 1 || v.owner !== owner || v.attemptId !== attemptId || Date.now() - (v.touchedAt ?? 0) > MAX_AGE_MS) {
      s.removeItem(key(attemptId));
      return emptyStore(attemptId, owner);
    }
    // Anything that was "sending" when the page went away is unconfirmed: send it again.
    for (const p of Object.values(v.pending ?? {})) p.syncStatus = "pending";
    return { ...emptyStore(attemptId, owner), ...v, pending: v.pending ?? {}, events: v.events ?? [] };
  } catch {
    return emptyStore(attemptId, owner);
  }
}

/** Returns false when the browser refused the write (quota, disabled storage). */
export function saveStore(store: AttemptStore): boolean {
  const s = ls();
  if (!s) return false;
  try {
    store.touchedAt = Date.now();
    s.setItem(key(store.attemptId), JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function clearStore(attemptId: string) {
  try {
    ls()?.removeItem(key(attemptId));
  } catch {
    /* ignore */
  }
}

/** Removes every attempt queue on this browser (sign-out). */
export function clearAllAttemptStores() {
  const s = ls();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** Drops queues for attempts last touched more than a week ago. */
export function sweepExpired() {
  const s = ls();
  if (!s) return;
  try {
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      try {
        const v = JSON.parse(s.getItem(k) ?? "null") as AttemptStore | null;
        if (!v || Date.now() - (v.touchedAt ?? 0) > MAX_AGE_MS) s.removeItem(k);
      } catch {
        s.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Next mutation sequence. Time-based so two tabs on the same attempt still produce increasing
 * values, never lower than anything issued here before or already stored on the server.
 */
export function nextSeq(store: AttemptStore, floor = 0) {
  store.seq = Math.max(store.seq + 1, floor + 1, Date.now());
  return store.seq;
}
