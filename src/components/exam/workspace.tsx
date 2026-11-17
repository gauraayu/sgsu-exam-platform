"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bookmark, Camera, CameraOff, ChevronLeft, ChevronRight, Clock3, CloudOff, Eraser, Grid3x3, Loader2, Maximize, Mic, ShieldAlert, Timer, Wifi } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/states";
import { LogoMark } from "@/components/layout/logo";
import { QuestionContent, OPTION_LETTERS } from "@/components/question/question-content";
import { MathText } from "@/components/question/math-text";
import { clearStore, loadStore, nextSeq, saveStore, sweepExpired, type AttemptStore, type QueuedAnswer } from "@/lib/exam/offline-queue";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface Q {
  id: string;
  number: number;
  subject: string;
  topic?: string;
  questionType: "single_correct" | "numerical";
  questionText: string;
  questionImages: string[];
  options: { id: number; text: string }[];
}
interface Ans {
  selectedOption: number | null;
  numericalValue: string | null;
  markedForReview: boolean;
  visited: boolean;
}
interface Security {
  fullscreen: boolean;
  tabSwitchWarnings: boolean;
  fullscreenExitWarnings: boolean;
  camera: boolean;
  microphone: boolean;
  soundMonitoring: boolean;
  soundThreshold: number;
  soundMinDurationMs: number;
  maxWarnings: number;
  terminateOnMaxWarnings: boolean;
}
interface ServerAns extends Ans {
  seq: number;
}
interface AttemptPayload {
  id: string;
  studentId: string;
  status: string;
  deadlineAt: string;
  serverNow: string;
  warningCount: number;
  exam: { id: string; title: string; totalQuestions: number; marking: { correct: number; incorrect: number }; showTopic: boolean; security: Security; autoFinalizeOnTimeout: boolean };
  questions: Q[];
  answers: Record<string, ServerAns>;
}
interface SyncResult {
  status: string;
  deadlineAt: string;
  serverNow: string;
  warningCount: number;
  answers: Record<string, ServerAns>;
  applied: string[];
  stale: Record<string, ServerAns>;
  rejected: string[];
  rejectedReason: string | null;
}
type SaveState = "saved" | "saving" | "pending" | "offline" | "error";
type ConnState = "online" | "lost" | "reconnecting";

const stripMeta = (q: QueuedAnswer): Partial<Ans> => {
  const out: Partial<Ans> = {};
  if (q.selectedOption !== undefined) out.selectedOption = q.selectedOption;
  if (q.numericalValue !== undefined) out.numericalValue = q.numericalValue;
  if (q.markedForReview !== undefined) out.markedForReview = q.markedForReview;
  if (q.visited !== undefined) out.visited = q.visited;
  return out;
};
const toWire = (q: QueuedAnswer) => ({ examQuestionId: q.examQuestionId, ...stripMeta(q), seq: q.seq });
type EventType = "fullscreen_exit" | "tab_hidden" | "fullscreen_unsupported" | "camera_denied" | "camera_interrupted" | "microphone_denied" | "microphone_interrupted" | "sound_level" | "network_offline" | "network_restored";

const EMPTY: Ans = { selectedOption: null, numericalValue: null, markedForReview: false, visited: false };
const isAnswered = (a?: Ans) => !!a && (a.selectedOption !== null || (a.numericalValue !== null && a.numericalValue !== ""));
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function statusOf(a?: Ans): "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked" {
  if (!a || !a.visited) return isAnswered(a) ? (a!.markedForReview ? "answered_marked" : "answered") : "not_visited";
  if (a.markedForReview) return isAnswered(a) ? "answered_marked" : "marked";
  return isAnswered(a) ? "answered" : "not_answered";
}
const PALETTE_STYLE: Record<ReturnType<typeof statusOf>, string> = {
  not_visited: "border-input bg-card text-muted-foreground",
  not_answered: "border-danger/40 bg-danger-soft text-danger",
  answered: "border-success/50 bg-success text-white dark:text-[#0d2416]",
  marked: "border-secondary bg-primary-soft text-primary-soft-foreground",
  answered_marked: "border-secondary bg-secondary text-white",
};
const LEGEND: [ReturnType<typeof statusOf>, string][] = [
  ["answered", "Answered"],
  ["not_answered", "Not answered"],
  ["not_visited", "Not visited"],
  ["marked", "Marked for review"],
  ["answered_marked", "Answered & marked"],
];

function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${String(h).padStart(2, "0")}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*  Workspace                                                                  */
/* -------------------------------------------------------------------------- */

export function ExamWorkspace({ attemptId, studentName }: { attemptId: string; studentName: string }) {
  const router = useRouter();
  const [data, setData] = useState<AttemptPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Ans>>({});
  const [index, setIndex] = useState(0);
  const [subjectFilter, setSubjectFilter] = useState<string>("All");
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  /** "online" only after the server has answered an authenticated request. */
  const [conn, setConn] = useState<ConnState>("online");
  const [pendingCount, setPendingCount] = useState(0);
  const [storageOk, setStorageOk] = useState(true);
  const [submitPending, setSubmitPending] = useState<null | "submitted" | "time">(null);
  const [rejectedNotice, setRejectedNotice] = useState<string | null>(null);
  const [warnings, setWarnings] = useState(0);
  const [warningNotice, setWarningNotice] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState<null | { reason: "submitted" | "time" | "terminated" }>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [camState, setCamState] = useState<"off" | "active" | "denied" | "interrupted">("off");
  const [micState, setMicState] = useState<"off" | "active" | "denied" | "interrupted">("off");

  const offset = useRef(0);
  const [clockOffset, setClockOffset] = useState(0);
  const syncClock = useCallback((v: number) => {
    offset.current = v;
    setClockOffset(v);
  }, []);
  /** Local queue (persisted). `store.pending` holds every change the server has not acknowledged. */
  const store = useRef<AttemptStore | null>(null);
  /** Highest sequence the server holds per question, so stale local entries can be dropped. */
  const serverSeq = useRef<Map<string, number>>(new Map());
  const inFlight = useRef(false);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(2000);
  const connRef = useRef<ConnState>("online");
  const sendingEvents = useRef(false);
  const finishedRef = useRef(false);
  const submittingRef = useRef(false);
  const submitPendingRef = useRef<null | "submitted" | "time">(null);
  const deadlineRef = useRef(0);
  /** Set when the page is being refreshed or closed, so unload-time signals are not counted as violations. */
  const unloadingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreams = useRef<MediaStream[]>([]);
  const audioCtx = useRef<AudioContext | null>(null);

  const security = data?.exam.security;
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const persist = useCallback(() => {
    const st = store.current;
    if (!st) return;
    setStorageOk(saveStore(st));
    setPendingCount(Object.keys(st.pending).length);
  }, []);
  const setConnection = useCallback((c: ConnState) => {
    connRef.current = c;
    setConn(c);
  }, []);

  /** Server answers win unless this device holds a newer, unconfirmed change for that question. */
  const applyServerAnswers = useCallback((server: Record<string, ServerAns>) => {
    const st = store.current;
    for (const [k, v] of Object.entries(server)) {
      serverSeq.current.set(k, v.seq ?? 0);
      const local = st?.pending[k];
      if (local && local.seq <= (v.seq ?? 0)) delete st!.pending[k];
    }
    setAnswers((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(server)) {
        const local = st?.pending[k];
        next[k] = local ? { ...EMPTY, ...v, ...stripMeta(local) } : { selectedOption: v.selectedOption, numericalValue: v.numericalValue, markedForReview: v.markedForReview, visited: v.visited };
      }
      for (const [k, local] of Object.entries(st?.pending ?? {})) if (!server[k]) next[k] = { ...EMPTY, ...next[k], ...stripMeta(local) };
      return next;
    });
  }, []);

  /* ---------------- Finishing ---------------- */
  const finish = useCallback(
    (reason: "submitted" | "time" | "terminated") => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setFinished({ reason });
      clearStore(attemptId);
      mediaStreams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      void audioCtx.current?.close().catch(() => {});
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    },
    [attemptId],
  );
  const finishFromStatus = useCallback((status: string) => finish(status === "terminated" ? "terminated" : status === "auto_submitted" ? "time" : "submitted"), [finish]);

  /* ---------------- Reconnection ---------------- */
  // Declared before use; assigned below once its dependencies exist.
  const reconnectRef = useRef<() => Promise<boolean>>(async () => false);
  const scheduleReconnect = useCallback(() => {
    if (finishedRef.current || reconnectTimer.current) return;
    const delay = reconnectDelay.current;
    reconnectDelay.current = Math.min(30_000, delay * 2);
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      void reconnectRef.current();
    }, delay);
  }, []);
  const lostConnection = useCallback(() => {
    if (connRef.current === "online") setConnection("lost");
    setSaveState((s) => (s === "saved" && !Object.keys(store.current?.pending ?? {}).length ? "saved" : "offline"));
    scheduleReconnect();
  }, [scheduleReconnect, setConnection]);

  /* ---------------- Autosave ---------------- */
  const flush = useCallback(async (): Promise<boolean> => {
    const st = store.current;
    if (!st || inFlight.current || finishedRef.current) return false;
    const batch = Object.values(st.pending).filter((p) => p.syncStatus === "pending");
    if (!batch.length) {
      if (!Object.keys(st.pending).length) setSaveState("saved");
      return true;
    }
    if (connRef.current !== "online") {
      scheduleReconnect();
      return false;
    }
    inFlight.current = true;
    for (const p of batch) p.syncStatus = "sending";
    persist();
    setSaveState("saving");
    const sentAt = Date.now();
    try {
      const r = await api<{ savedAt: string; applied: string[]; stale: Record<string, ServerAns> }>(`/api/attempts/${attemptId}/answers`, {
        method: "PATCH",
        json: { answers: batch.map(toWire) },
      });
      syncClock(new Date(r.savedAt).getTime() - (sentAt + Date.now()) / 2);
      // Remove exactly what was sent; anything changed meanwhile has a newer seq and stays queued.
      for (const p of batch) if (st.pending[p.examQuestionId]?.seq === p.seq) delete st.pending[p.examQuestionId];
      for (const p of batch) serverSeq.current.set(p.examQuestionId, Math.max(serverSeq.current.get(p.examQuestionId) ?? 0, p.seq));
      if (Object.keys(r.stale ?? {}).length) applyServerAnswers(r.stale);
      persist();
      setLastSaved(new Date());
      reconnectDelay.current = 2000;
      setSaveState(Object.keys(st.pending).length ? "pending" : "saved");
      return true;
    } catch (e) {
      const err = e as ApiError;
      for (const p of batch) if (st.pending[p.examQuestionId]?.seq === p.seq) st.pending[p.examQuestionId].syncStatus = "pending";
      persist();
      if (err.code === "ATTEMPT_CLOSED") {
        // Ask the server what happened and which local changes it could not accept.
        void reconnectRef.current();
        return false;
      }
      if (err.status === 0) lostConnection();
      else setSaveState("error");
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [attemptId, applyServerAnswers, lostConnection, persist, scheduleReconnect, syncClock]);

  const scheduleFlush = useCallback(
    (ms = 700) => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => void flush(), ms);
    },
    [flush],
  );

  const doSubmitRef = useRef<(reason: "submitted" | "time") => Promise<void>>(async () => {});

  /**
   * Verifies the backend with an authenticated request, sends queued answers (the server keeps
   * whichever change is newest) and adopts the server's status, deadline, answers and warnings.
   */
  const reconnect = useCallback(async (): Promise<boolean> => {
    const st = store.current;
    if (!st || finishedRef.current) return false;
    while (inFlight.current) await new Promise((r) => setTimeout(r, 100));
    inFlight.current = true;
    if (connRef.current !== "online") setConnection("reconnecting");
    const batch = Object.values(st.pending);
    for (const p of batch) p.syncStatus = "sending";
    const sentAt = Date.now();
    try {
      const r = await api<SyncResult>(`/api/attempts/${attemptId}/sync`, { method: "POST", json: { answers: batch.map(toWire) } });
      syncClock(new Date(r.serverNow).getTime() - (sentAt + Date.now()) / 2);
      for (const p of batch) if (st.pending[p.examQuestionId]?.seq === p.seq && !r.rejected.includes(p.examQuestionId)) delete st.pending[p.examQuestionId];
      setWarnings(r.warningCount);
      setConnection("online");
      reconnectDelay.current = 2000;
      if (r.status !== "in_progress") {
        if (r.rejected.length) setRejectedNotice(`${r.rejected.length} answer change${r.rejected.length === 1 ? " was" : "s were"} made after the attempt ended and could not be accepted. ${r.rejectedReason ?? ""}`.trim());
        st.pending = {};
        persist();
        finishFromStatus(r.status);
        return true;
      }
      deadlineRef.current = new Date(r.deadlineAt).getTime();
      setData((d) => (d ? { ...d, deadlineAt: r.deadlineAt } : d));
      applyServerAnswers(r.answers);
      persist();
      setLastSaved(new Date());
      setSaveState(Object.keys(st.pending).length ? "pending" : "saved");
      if (submitPendingRef.current) void doSubmitRef.current(submitPendingRef.current);
      else if (Object.keys(st.pending).length) scheduleFlush(300);
      return true;
    } catch (e) {
      for (const p of batch) if (st.pending[p.examQuestionId]?.seq === p.seq) st.pending[p.examQuestionId].syncStatus = "pending";
      persist();
      if ((e as ApiError).status === 0) {
        setConnection("lost");
        scheduleReconnect();
      } else {
        setSaveState("error");
        scheduleReconnect();
      }
      return false;
    } finally {
      inFlight.current = false;
    }
  }, [attemptId, applyServerAnswers, finishFromStatus, persist, scheduleFlush, scheduleReconnect, setConnection, syncClock]);
  useEffect(() => {
    reconnectRef.current = reconnect;
  }, [reconnect]);

  /* ---------------- Loading (also the refresh / reopen path) ---------------- */
  const load = useCallback(async () => {
    try {
      sweepExpired();
      const d = await api<AttemptPayload>(`/api/attempts/${attemptId}`);
      const st = loadStore(attemptId, d.studentId);
      store.current = st;
      if (d.status !== "in_progress") {
        finishedRef.current = true;
        clearStore(attemptId);
        router.replace(`/student/results/${attemptId}`);
        return;
      }
      syncClock(new Date(d.serverNow).getTime() - Date.now());
      deadlineRef.current = new Date(d.deadlineAt).getTime();
      setWarnings(d.warningCount);
      setData(d);
      applyServerAnswers(d.answers);
      setIndex(Math.min(Math.max(0, st.index ?? 0), Math.max(0, d.questions.length - 1)));
      setIsFullscreen(!!document.fullscreenElement);
      if (st.submitPending) {
        submitPendingRef.current = st.submitPending.reason;
        setSubmitPending(st.submitPending.reason);
      }
      persist();
      // Unconfirmed changes from before the reload (or from a closed browser) are reconciled now.
      if (Object.keys(st.pending).length || st.submitPending) void reconnectRef.current();
    } catch (e) {
      setLoadError((e as ApiError).message);
    }
  }, [attemptId, router, syncClock, applyServerAnswers, persist]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const locked = () => finishedRef.current || submittingRef.current || !!submitPendingRef.current || (deadlineRef.current > 0 && Date.now() + offset.current >= deadlineRef.current);

  const update = useCallback(
    (qid: string, patch: Partial<Ans>, delay = 700) => {
      const st = store.current;
      if (!st) return;
      if (locked()) {
        toast.error(submitPendingRef.current ? "Your submission is pending. Answers can no longer be changed." : "Time is up. Answers can no longer be changed.");
        return;
      }
      setAnswers((prev) => ({ ...prev, [qid]: { ...EMPTY, ...prev[qid], ...patch, visited: true } }));
      const prev = st.pending[qid];
      st.pending[qid] = { ...(prev ?? {}), ...patch, visited: true, examQuestionId: qid, seq: nextSeq(st, serverSeq.current.get(qid) ?? 0), updatedAt: Date.now(), syncStatus: "pending" };
      persist();
      setSaveState(connRef.current === "online" ? "pending" : "offline");
      scheduleFlush(delay);
    },
    [persist, scheduleFlush],
  );

  // Heartbeat (keeps "last activity" fresh for monitoring) and retry of anything still queued.
  useEffect(() => {
    if (!data) return;
    const t = setInterval(() => {
      if (connRef.current !== "online") return void reconnectRef.current();
      if (Object.keys(store.current?.pending ?? {}).length) void flush();
      else
        void api<{ savedAt: string }>(`/api/attempts/${attemptId}/answers`, { method: "PATCH", json: { answers: [] } })
          .then((r) => syncClock(new Date(r.savedAt).getTime() - Date.now()))
          .catch((e: ApiError) => (e.code === "ATTEMPT_CLOSED" ? void reconnectRef.current() : e.status === 0 ? lostConnection() : undefined));
    }, 30_000);
    return () => clearInterval(t);
  }, [data, attemptId, flush, lostConnection, syncClock]);

  // Remember the current question so a reload returns to it.
  useEffect(() => {
    if (!store.current || !data) return;
    store.current.index = index;
    persist();
  }, [index, data, persist]);

  /* ---------------- Integrity events ---------------- */
  const sendEvents = useCallback(async () => {
    const st = store.current;
    if (!st || sendingEvents.current || finishedRef.current) return;
    sendingEvents.current = true;
    try {
      while (st.events.length && !finishedRef.current) {
        const ev = st.events[0];
        try {
          const r = await api<{ warningCount: number; maxWarnings: number; counted: boolean; finalized: boolean; status: string }>(`/api/attempts/${attemptId}/integrity-events`, { method: "POST", json: ev });
          st.events.shift();
          persist();
          setWarnings(r.warningCount);
          if (r.finalized || r.status === "terminated") {
            finish("terminated");
            break;
          }
          if (r.counted) {
            const remaining = r.maxWarnings - r.warningCount;
            setWarningNotice(
              `Warning ${r.warningCount} of ${r.maxWarnings}: ${ev.eventType === "tab_hidden" ? "you switched away from the exam window" : "you left fullscreen mode"}. ${
                remaining > 0 ? `${remaining} more warning${remaining === 1 ? "" : "s"} will submit your exam automatically.` : ""
              }`,
            );
          }
        } catch (e) {
          // Offline: keep the event and retry later. Its clientEventId makes the retry idempotent.
          if ((e as ApiError).status === 0) break;
          st.events.shift(); // drop events the server rejects
          persist();
        }
      }
    } finally {
      sendingEvents.current = false;
    }
  }, [attemptId, finish, persist]);

  const report = useCallback(
    (eventType: EventType, metadata?: Record<string, string | number | boolean | null>) => {
      const st = store.current;
      if (!st || finishedRef.current || submittingRef.current) return;
      st.events.push({ clientEventId: uid(), eventType, occurredAt: new Date().toISOString(), metadata });
      persist();
      void sendEvents();
    },
    [persist, sendEvents],
  );

  useEffect(() => {
    if (data && store.current?.events.length) void sendEvents();
  }, [data, sendEvents]);
  useEffect(() => {
    if (conn === "online" && store.current?.events.length) void sendEvents();
  }, [conn, sendEvents]);

  /* ---------------- Browser monitoring ---------------- */
  useEffect(() => {
    if (!security) return;
    const onFs = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs && security.fullscreen && !unloadingRef.current) report("fullscreen_exit");
    };
    const onVis = () => {
      if (document.visibilityState === "hidden" && security.tabSwitchWarnings && !unloadingRef.current) report("tab_hidden");
    };
    const onUnload = () => {
      unloadingRef.current = true;
    };
    const onPageShow = () => {
      unloadingRef.current = false;
    };
    // Network events are recorded for information only; they are never warnings.
    const onOffline = () => {
      report("network_offline");
      lostConnection();
    };
    const onOnline = () => {
      // The browser's "online" event does not prove the server is reachable: verify it.
      report("network_restored");
      reconnectDelay.current = 2000;
      void reconnectRef.current().then((ok) => ok && void sendEvents());
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("pageshow", onPageShow);
    if (security.fullscreen && !document.fullscreenEnabled) report("fullscreen_unsupported");
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [security, report, lostConnection, sendEvents]);

  // Warn before leaving with unsaved answers (they stay on this device either way).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(store.current?.pending ?? {}).length && !finishedRef.current) {
        e.preventDefault();
        // If the student cancels the navigation, resume normal monitoring.
        setTimeout(() => (unloadingRef.current = false), 1000);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /* ---------------- Camera & microphone (local only) ---------------- */
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      mediaStreams.current.push(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setCamState("active");
      s.getVideoTracks()[0]?.addEventListener("ended", () => {
        setCamState("interrupted");
        report("camera_interrupted");
      });
    } catch {
      setCamState("denied");
      report("camera_denied");
    }
  }, [report]);

  const startMic = useCallback(async () => {
    if (!security) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      mediaStreams.current.push(s);
      setMicState("active");
      s.getAudioTracks()[0]?.addEventListener("ended", () => {
        setMicState("interrupted");
        report("microphone_interrupted");
      });
      if (!security.soundMonitoring) return;
      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(s).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      let aboveSince: number | null = null;
      let peak = 0;
      let cooldownUntil = 0;
      const tick = setInterval(() => {
        if (finishedRef.current) return clearInterval(tick);
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        // Relative level 0–100 from dBFS (−60 dBFS → 0, 0 dBFS → 100). Not a calibrated decibel value.
        const level = Math.max(0, Math.min(100, ((20 * Math.log10(rms || 1e-8) + 60) / 60) * 100));
        const t = Date.now();
        if (level >= security.soundThreshold) {
          aboveSince ??= t;
          peak = Math.max(peak, level);
          if (t - aboveSince >= security.soundMinDurationMs && t > cooldownUntil) {
            report("sound_level", { relativeLevel: Math.round(peak), durationMs: t - aboveSince, threshold: security.soundThreshold });
            cooldownUntil = t + 30_000;
            aboveSince = null;
            peak = 0;
          }
        } else {
          aboveSince = null;
          peak = 0;
        }
      }, 200);
    } catch {
      setMicState("denied");
      report("microphone_denied");
    }
  }, [security, report]);

  useEffect(() => {
    if (!security) return;
    const t = setTimeout(() => {
      if (security.camera) void startCamera();
      if (security.microphone) void startMic();
    }, 0);
    const streams = mediaStreams.current;
    return () => {
      clearTimeout(t);
      streams.forEach((s) => s.getTracks().forEach((tr) => tr.stop()));
    };
  }, [security, startCamera, startMic]);

  /* ---------------- Timer ---------------- */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // During a disconnection the timer keeps using the last deadline the server confirmed.
  const remaining = data ? new Date(data.deadlineAt).getTime() - (now + clockOffset) : 0;

  /**
   * Submission is idempotent on the server. If the server cannot be reached, the request is kept
   * (also across reloads) and retried after reconnection; success is shown only once confirmed.
   */
  const doSubmit = useCallback(
    async (reason: "submitted" | "time") => {
      const st = store.current;
      if (!st || submittingRef.current || finishedRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      const markPending = () => {
        submitPendingRef.current = reason;
        setSubmitPending(reason);
        st.submitPending = { reason, requestedAt: Date.now() };
        persist();
        submittingRef.current = false;
        setSubmitting(false);
        setSubmitOpen(false);
        lostConnection();
      };
      // Send everything still queued first, so the submitted attempt includes it.
      if (Object.keys(st.pending).length) {
        while (inFlight.current) await new Promise((r) => setTimeout(r, 100));
        const ok = connRef.current === "online" ? await flush() : false;
        if (!ok && !finishedRef.current) {
          submittingRef.current = false;
          if (!(await reconnectRef.current()) || finishedRef.current) {
            if (!finishedRef.current) markPending();
            return;
          }
          submittingRef.current = true;
        }
      }
      if (finishedRef.current) return;
      try {
        await api(`/api/attempts/${attemptId}/submit`, { method: "POST" });
        submitPendingRef.current = null;
        finish(reason);
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 0) return markPending();
        if (err.code === "ATTEMPT_CLOSED") return finish(reason);
        toast.error(`${err.message} Your answers are saved — try submitting again.`);
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [attemptId, flush, finish, lostConnection, persist],
  );
  useEffect(() => {
    doSubmitRef.current = doSubmit;
  }, [doSubmit]);

  useEffect(() => {
    if (!data || remaining > 0 || finishedRef.current || submittingRef.current || submitPendingRef.current) return;
    const t = setTimeout(() => {
      if (data.exam.autoFinalizeOnTimeout) void doSubmit("time");
      else {
        void flush();
        finish("time");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [data, remaining, doSubmit, flush, finish]);

  /* ---------------- Navigation ---------------- */
  const questions = useMemo(() => data?.questions ?? [], [data]);
  const current = questions[index];

  const goTo = useCallback(
    (i: number) => {
      if (!questions.length) return;
      const ni = Math.max(0, Math.min(questions.length - 1, i));
      setIndex(ni);
      const q = questions[ni];
      const st = store.current;
      if (st && !answersRef.current[q.id]?.visited && !locked()) {
        st.pending[q.id] = { ...(st.pending[q.id] ?? {}), visited: true, examQuestionId: q.id, seq: nextSeq(st, serverSeq.current.get(q.id) ?? 0), updatedAt: Date.now(), syncStatus: "pending" };
        persist();
        scheduleFlush(1500);
      }
      setAnswers((prev) => (prev[q.id]?.visited ? prev : { ...prev, [q.id]: { ...EMPTY, ...prev[q.id], visited: true } }));
      setPaletteOpen(false);
    },
    [questions, scheduleFlush, persist],
  );

  // On load, open the question the student was last on (the first one for a new attempt) and mark it visited.
  const firstVisitDone = useRef(false);
  useEffect(() => {
    if (!questions.length || firstVisitDone.current) return;
    firstVisitDone.current = true;
    const t = setTimeout(() => goTo(store.current?.index ?? 0), 0);
    return () => clearTimeout(t);
  }, [questions, goTo]);

  const saveAndNext = () => {
    void flush();
    if (index < questions.length - 1) goTo(index + 1);
    else toast.success("This is the last question. Review your answers or submit the exam.");
  };

  // Keyboard shortcuts (ignored while typing in an input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || submitOpen || finished) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (current.questionType === "single_correct") {
        const pos = ["a", "b", "c", "d"].indexOf(key) >= 0 ? ["a", "b", "c", "d"].indexOf(key) : ["1", "2", "3", "4"].indexOf(key);
        if (pos >= 0 && current.options[pos]) {
          e.preventDefault();
          update(current.id, { selectedOption: current.options[pos].id });
          return;
        }
      }
      if (key === "n") goTo(index + 1);
      else if (key === "p") goTo(index - 1);
      else if (key === "m") update(current.id, { markedForReview: !answers[current.id]?.markedForReview }, 300);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, index, answers, goTo, update, submitOpen, finished]);

  /* ---------------- Derived ---------------- */
  const subjects = useMemo(() => [...new Set(questions.map((q) => q.subject))], [questions]);
  const counts = useMemo(() => {
    const c = { answered: 0, not_answered: 0, not_visited: 0, marked: 0, answered_marked: 0 };
    for (const q of questions) c[statusOf(answers[q.id])]++;
    return c;
  }, [questions, answers]);
  const answeredTotal = counts.answered + counts.answered_marked;

  /* ---------------- Render ---------------- */
  if (loadError) return <div className="grid min-h-dvh place-items-center"><ErrorState message={loadError} onRetry={() => { setLoadError(null); void load(); }} /></div>;
  if (finished) return <FinishedScreen reason={finished.reason} notice={rejectedNotice} onContinue={() => router.replace(`/student/results/${attemptId}`)} />;
  if (!data || !current)
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading your exam…</span>
      </div>
    );

  const a = answers[current.id] ?? EMPTY;
  const lowTime = remaining < 5 * 60_000;
  const needFullscreenGate = security!.fullscreen && !isFullscreen && typeof document !== "undefined" && !!document.fullscreenEnabled;

  const palette = (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[12.5px] text-muted-foreground">
          {LEGEND.map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cn("grid size-4 place-items-center rounded border text-[10.5px] font-semibold", PALETTE_STYLE[k])}>{counts[k]}</span>
              {label}
            </span>
          ))}
        </div>
      </div>
      {subjects.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b px-3 py-2" role="tablist" aria-label="Subjects">
          {["All", ...subjects].map((s) => (
            <button key={s} role="tab" aria-selected={subjectFilter === s} onClick={() => setSubjectFilter(s)} className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", subjectFilter === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-6">
          {questions.map((q, i) =>
            subjectFilter !== "All" && q.subject !== subjectFilter ? null : (
              <button
                key={q.id}
                onClick={() => goTo(i)}
                aria-label={`Question ${q.number}, ${statusOf(answers[q.id]).replace("_", " ")}`}
                aria-current={i === index ? "true" : undefined}
                className={cn("relative grid h-8 place-items-center rounded-md border text-xs font-semibold tabular-nums transition-shadow", PALETTE_STYLE[statusOf(answers[q.id])], i === index && "ring-2 ring-accent ring-offset-1 ring-offset-card")}
              >
                {q.number}
                {statusOf(answers[q.id]) === "answered_marked" && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-success ring-1 ring-card" />}
              </button>
            ),
          )}
        </div>
      </div>
      {security!.camera && (
        <div className="border-t p-3">
          <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
            <span className="flex items-center gap-1">{camState === "active" ? <Camera className="size-3" /> : <CameraOff className="size-3" />} Camera {camState === "active" ? "on (not recorded)" : camState}</span>
            {camState !== "active" && <button className="font-medium text-primary dark:text-primary-soft-foreground" onClick={() => void startCamera()}>Reconnect</button>}
          </div>
          <video ref={videoRef} autoPlay muted playsInline className="mt-2 aspect-video w-full rounded bg-black object-cover" aria-label="Your camera preview" />
        </div>
      )}
      {security!.microphone && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-1"><Mic className="size-3" /> Microphone {micState === "active" ? (security!.soundMonitoring ? "· sound level monitored locally" : "on") : micState}</span>
          {micState !== "active" && <button className="font-medium text-primary dark:text-primary-soft-foreground" onClick={() => void startMic()}>Reconnect</button>}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-3 sm:px-4">
        <LogoMark size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{data.exam.title}</p>
          <p className="truncate text-xs text-muted-foreground">{studentName}</p>
        </div>
        <SaveIndicator state={saveState} conn={conn} pending={pendingCount} lastSaved={lastSaved} />
        <div className="block text-xs text-muted-foreground max-md:hidden">
          <span className="font-semibold tabular-nums text-foreground">{answeredTotal}</span>/{questions.length} answered
        </div>
        {(security!.fullscreenExitWarnings || security!.tabSwitchWarnings) && (
          <Badge variant={warnings ? "warning" : "outline"} className="inline-flex max-sm:hidden" title="Warnings recorded">
            <ShieldAlert /> {warnings}/{security!.maxWarnings}
          </Badge>
        )}
        <div role="timer" aria-live="off" aria-label="Time remaining" className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm font-semibold tabular-nums", lowTime ? "border-danger/40 bg-danger-soft text-danger" : "bg-subtle")}>
          <Timer className="size-4" aria-hidden /> {formatClock(remaining)}
        </div>
        <Button variant="accent" size="sm" onClick={() => setSubmitOpen(true)} disabled={!!submitPending} title={submitPending ? "Submission pending: waiting for the connection" : undefined}>
          {submitPending ? "Pending…" : "Submit"}
        </Button>
      </header>

      {(conn !== "online" || submitPending) && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-warning-soft px-4 py-1.5 text-center text-xs text-warning" role="status" data-testid="connection-banner">
          {conn === "reconnecting" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
          {submitPending
            ? "Submission pending: your exam has not been submitted yet. It will be submitted as soon as the connection returns. Keep this page open."
            : "Connection interrupted. Your saved answers are safe. Unsaved responses will synchronize when the connection returns."}
          {pendingCount > 0 && <span className="font-medium">{pendingCount} unsaved change{pendingCount === 1 ? "" : "s"} kept on this device.</span>}
          {conn === "lost" && <button className="font-medium underline" onClick={() => void reconnectRef.current()}>Retry now</button>}
        </div>
      )}
      {!storageOk && (
        <div className="bg-danger-soft px-4 py-1.5 text-center text-xs text-danger" role="alert">
          This browser is not allowing the exam to keep unsaved answers on this device. Keep this tab open until the indicator shows Saved.
        </div>
      )}
      {(camState === "interrupted" || camState === "denied") && security!.camera && (
        <div className="flex items-center justify-center gap-2 bg-info-soft px-4 py-1.5 text-xs text-info" role="status">
          <CameraOff className="size-3.5" /> Your camera is not available. Reconnect it from the side panel; the interruption has been noted for the examination cell.
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Question area */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl px-4 py-5 sm:px-8 sm:py-7">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-[16.5px] font-semibold">Question {current.number}</span>
                <span className="text-xs text-muted-foreground">of {questions.length}</span>
                <Badge variant="primary">{current.subject}</Badge>
                {current.topic && <Badge variant="outline">{current.topic}</Badge>}
                <Badge variant="outline">{current.questionType === "numerical" ? "Numerical answer" : "Single correct"}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">
                  +{data.exam.marking.correct} / {data.exam.marking.incorrect ? `−${data.exam.marking.incorrect}` : "0"}
                </span>
              </div>

              <div className="rounded-lg border bg-card p-5 sm:p-6">
                <QuestionContent text={current.questionText} images={current.questionImages} />
              </div>

              <div className="mt-5">
                {current.questionType === "single_correct" ? (
                  <div role="radiogroup" aria-label={`Options for question ${current.number}`} className="space-y-2.5">
                    {current.options.map((o, i) => {
                      const selected = a.selectedOption === o.id;
                      return (
                        <button
                          key={o.id}
                          role="radio"
                          aria-checked={selected}
                          onClick={() => update(current.id, { selectedOption: o.id })}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                            selected ? "border-primary bg-primary-soft ring-1 ring-primary" : "hover:border-primary/40 hover:bg-muted/40",
                          )}
                        >
                          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold", selected ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{OPTION_LETTERS[i]}</span>
                          <MathText text={o.text} className="pt-0.5 text-[16.5px] leading-6" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="max-w-sm space-y-2">
                    <label htmlFor="numerical-answer" className="text-[14.5px] font-medium">Your answer</label>
                    <Input
                      id="numerical-answer"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Enter a number"
                      value={a.numericalValue ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^[-+]?\d*\.?\d*$/.test(v)) update(current.id, { numericalValue: v === "" ? null : v }, 900);
                      }}
                      className="h-11 font-mono text-base"
                    />
                    <p className="text-xs text-muted-foreground">Enter a numerical value (integer or decimal).</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="shrink-0 border-t bg-card px-3 py-2.5 sm:px-6">
            <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => update(current.id, { markedForReview: !a.markedForReview }, 300)} aria-pressed={a.markedForReview}>
                <Bookmark className={cn(a.markedForReview && "fill-current text-secondary")} /> {a.markedForReview ? "Unmark review" : "Mark for review"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => update(current.id, { selectedOption: null, numericalValue: null }, 300)} disabled={!isAnswered(a)}>
                <Eraser /> Clear response
              </Button>
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setPaletteOpen(true)}>
                <Grid3x3 /> Questions
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => goTo(index - 1)} disabled={index === 0}>
                  <ChevronLeft /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => goTo(index + 1)} disabled={index === questions.length - 1}>
                  Next <ChevronRight />
                </Button>
                <Button size="sm" onClick={saveAndNext}>
                  Save &amp; Next
                </Button>
              </div>
            </div>
            <p className="mx-auto mt-1.5 block max-w-4xl text-[12.5px] text-muted-foreground max-xl:hidden">Shortcuts: A–D select an option · N next · P previous · M mark for review</p>
          </div>
        </main>

        {/* Palette */}
        <aside className="block w-[300px] shrink-0 border-l bg-card max-lg:hidden" aria-label="Question palette">
          {palette}
        </aside>
      </div>

      {/* Mobile palette */}
      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent size="md" className="p-0">
          <DialogHeader className="border-b pb-3">
            <DialogTitle>Questions</DialogTitle>
            <DialogDescription>{answeredTotal} of {questions.length} answered</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh]">{palette}</div>
        </DialogContent>
      </Dialog>

      {/* Submit confirmation */}
      <Dialog open={submitOpen} onOpenChange={(o) => !submitting && setSubmitOpen(o)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Submit your exam?</DialogTitle>
            <DialogDescription>You cannot change your answers after submitting.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <dl className="grid grid-cols-2 gap-2 text-[14.5px]">
              {[
                ["Answered", answeredTotal, "text-success"],
                ["Not answered", counts.not_answered + counts.not_visited + counts.marked, "text-danger"],
                ["Marked for review", counts.marked + counts.answered_marked, "text-secondary"],
                ["Time remaining", formatClock(remaining), ""],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="rounded-md border bg-subtle p-2.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={cn("text-lg font-semibold tabular-nums", cls as string)}>{value}</dd>
                </div>
              ))}
            </dl>
            {saveState !== "saved" && <p className="mt-3 text-xs text-muted-foreground">Unsaved answers will be saved before submitting.</p>}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={submitting}>Return to exam</Button>
            <Button variant="accent" loading={submitting} onClick={() => void doSubmit("submitted")}>Submit exam</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning notice */}
      <Dialog open={!!warningNotice} onOpenChange={(o) => !o && setWarningNotice(null)}>
        <DialogContent size="sm" hideClose>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning"><AlertTriangle className="size-5" /> Exam rule warning</DialogTitle>
            <DialogDescription>{warningNotice}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={async () => {
                setWarningNotice(null);
                if (security!.fullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen().catch(() => {});
              }}
            >
              I understand — continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen gate */}
      {needFullscreenGate && !warningNotice && !submitOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-background/95 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="fs-title">
          <div className="max-w-md space-y-4 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary-soft text-primary dark:text-primary-soft-foreground"><Maximize className="size-6" /></div>
            <h2 id="fs-title" className="text-lg font-semibold">This exam must be taken in fullscreen</h2>
            <p className="text-sm text-muted-foreground">Your timer is still running and your answers are saved. Return to fullscreen to continue.</p>
            <Button size="lg" onClick={() => void document.documentElement.requestFullscreen().catch(() => toast.error("Your browser blocked fullscreen. Try again."))}>
              <Maximize /> Return to fullscreen
            </Button>
          </div>
        </div>
      )}

      {submitting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm" role="status">
          <span className="flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 animate-spin" /> Submitting your exam…</span>
        </div>
      )}
    </div>
  );
}

/** "Saved" appears only after the server acknowledged the write. */
function SaveIndicator({ state, conn, pending, lastSaved }: { state: SaveState; conn: ConnState; pending: number; lastSaved: Date | null }) {
  const key = conn === "reconnecting" ? "reconnecting" : conn === "lost" ? "lost" : state === "pending" || (state === "offline" && pending) ? "unsaved" : state === "offline" ? "lost" : state;
  const map = {
    saved: { icon: Wifi, text: lastSaved ? `Saved ${lastSaved.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : "Saved", cls: "text-success", spin: false },
    unsaved: { icon: Clock3, text: "Unsaved changes", cls: "text-muted-foreground", spin: false },
    saving: { icon: Loader2, text: "Saving…", cls: "text-muted-foreground", spin: true },
    lost: { icon: CloudOff, text: pending ? `Connection lost · ${pending} unsaved` : "Connection lost", cls: "text-warning", spin: false },
    reconnecting: { icon: Loader2, text: "Reconnecting…", cls: "text-warning", spin: true },
    error: { icon: AlertTriangle, text: "Not saved — retrying", cls: "text-danger", spin: false },
  }[key];
  const Icon = map.icon;
  return (
    <span className={cn("flex items-center gap-1.5 text-xs", map.cls)} role="status" aria-live="polite" data-testid="save-status">
      <Icon className={cn("size-3.5", map.spin && "animate-spin")} aria-hidden /> <span className="max-sm:hidden">{map.text}</span>
    </span>
  );
}

function FinishedScreen({ reason, onContinue, notice }: { reason: "submitted" | "time" | "terminated"; onContinue: () => void; notice?: string | null }) {
  const content = {
    submitted: { title: "Your exam has been submitted", text: "Your answers have been recorded and evaluated. Results are shown according to the release settings of this exam." },
    time: { title: "Time is up", text: "Your saved answers have been submitted automatically." },
    terminated: { title: "Your exam was submitted automatically", text: "The maximum number of exam-rule warnings was reached. Your answers saved up to this point have been submitted. The examination cell can review the recorded events." },
  }[reason];
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="max-w-md space-y-4 text-center">
        <LogoMark size={40} className="mx-auto" />
        <h1 className="text-xl font-semibold">{content.title}</h1>
        <p className="text-sm text-muted-foreground">{content.text}</p>
        {notice && <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning" role="alert">{notice}</p>}
        <Button size="lg" onClick={onContinue}>View result</Button>
      </div>
    </div>
  );
}
