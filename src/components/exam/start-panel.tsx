"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, Maximize, Mic, Monitor, PlayCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/misc";
import { Alert } from "@/components/ui/states";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Check = "pending" | "ok" | "failed" | "checking";

interface Props {
  token: string;
  security: { fullscreen: boolean; camera: boolean; microphone: boolean };
  accommodation: { status: string; camera: boolean; microphone: boolean; fullscreen: boolean; adminNote?: string } | null;
  attempt: { id: string; status: string } | null;
}

function CheckRow({ icon: Icon, label, state, detail, action }: { icon: React.ElementType; label: string; state: Check; detail?: string; action?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-medium">{label}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      {action}
      <span aria-label={state} className="mt-0.5">
        {state === "ok" && <CheckCircle2 className="size-4 text-success" />}
        {state === "failed" && <XCircle className="size-4 text-danger" />}
        {state === "checking" && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        {state === "pending" && <span className="block size-4 rounded-full border-2 border-input" />}
      </span>
    </li>
  );
}

export function StartPanel({ token, security, accommodation, attempt }: Props) {
  const router = useRouter();
  const approved = accommodation?.status === "approved" ? accommodation : null;
  const needCamera = security.camera && !approved?.camera;
  const needMic = security.microphone && !approved?.microphone;
  const needFullscreen = security.fullscreen && !approved?.fullscreen;

  const [ack, setAck] = useState(false);
  const [starting, setStarting] = useState(false);
  const [screenOk, setScreenOk] = useState<Check>("checking");
  const [fsOk, setFsOk] = useState<Check>("checking");
  const [cam, setCam] = useState<Check>("pending");
  const [mic, setMic] = useState<Check>("pending");
  const [accOpen, setAccOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streams = useRef<MediaStream[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setScreenOk(window.innerWidth >= 1024 ? "ok" : "failed");
      setFsOk(document.fullscreenEnabled ? "ok" : "failed");
    }, 0);
    const current = streams.current;
    return () => {
      clearTimeout(t);
      current.forEach((s) => s.getTracks().forEach((tr) => tr.stop()));
    };
  }, []);

  async function testCamera() {
    setCam("checking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      streams.current.push(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setCam("ok");
    } catch {
      setCam("failed");
    }
  }
  async function testMic() {
    setMic("checking");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streams.current.push(s);
      setMic("ok");
    } catch {
      setMic("failed");
    }
  }

  const ready = ack && (!needCamera || cam === "ok") && (!needMic || mic === "ok") && (!needFullscreen || fsOk === "ok");

  async function start() {
    setStarting(true);
    // Fullscreen must be requested synchronously inside the click handler.
    if (needFullscreen && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      } catch {
        /* handled by the workspace, which will ask again */
      }
    }
    try {
      const r = await api<{ attemptId: string }>(`/api/exams/${token}/start`, { method: "POST", json: { acknowledged: true } });
      streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      router.push(`/attempt/${r.attemptId}`);
    } catch (e) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      toast.error((e as ApiError).message);
      setStarting(false);
      router.refresh();
    }
  }

  if (attempt && ["submitted", "auto_submitted", "terminated", "evaluating"].includes(attempt.status)) {
    return (
      <div className="space-y-3">
        <Alert variant="success" icon={CheckCircle2} title="You have completed this exam">
          Each student may attempt this exam once. Your submission has been recorded.
        </Alert>
        <Button asChild className="w-full">
          <Link href={`/student/results/${attempt.id}`}>View result</Link>
        </Button>
      </div>
    );
  }

  const resume = attempt?.status === "in_progress";

  return (
    <div className="space-y-4">
      {resume && (
        <Alert variant="info" title="Your attempt is in progress">
          Your saved answers and remaining time will be restored. The timer has continued while you were away.
        </Alert>
      )}
      <div>
        <p className="mb-1 text-[14.5px] font-semibold">System check</p>
        <ul className="divide-y rounded-md border px-3">
          <CheckRow icon={Monitor} label="Screen size" state={screenOk === "failed" ? "pending" : screenOk} detail={screenOk === "failed" ? "A laptop or desktop is recommended for this exam." : "Desktop-sized screen detected."} />
          {needFullscreen && <CheckRow icon={Maximize} label="Fullscreen mode" state={fsOk} detail={fsOk === "failed" ? "Your browser does not support fullscreen. Use a current version of Chrome, Edge or Firefox." : "The exam opens in fullscreen."} />}
          {needCamera && (
            <CheckRow icon={Camera} label="Camera access" state={cam} detail={cam === "failed" ? "Permission was denied or no camera was found." : "Required. Video is shown only to you and is not recorded."} action={cam !== "ok" && <Button size="xs" variant="outline" onClick={testCamera}>Allow camera</Button>} />
          )}
          {needMic && (
            <CheckRow icon={Mic} label="Microphone access" state={mic} detail={mic === "failed" ? "Permission was denied or no microphone was found." : "Required. Only the sound level is measured on your device; nothing is recorded."} action={mic !== "ok" && <Button size="xs" variant="outline" onClick={testMic}>Allow microphone</Button>} />
          )}
        </ul>
        <video ref={videoRef} autoPlay muted playsInline className={cn("mt-2 aspect-video w-40 rounded-md bg-black object-cover", cam !== "ok" && "hidden")} aria-label="Camera preview" />
      </div>

      {(security.camera || security.microphone || security.fullscreen) && (
        <div className="text-xs text-muted-foreground">
          {accommodation ? (
            <p>
              Accommodation request: <span className={cn("font-medium", accommodation.status === "approved" ? "text-success" : accommodation.status === "rejected" ? "text-danger" : "text-warning")}>{accommodation.status}</span>
              {accommodation.adminNote ? ` — ${accommodation.adminNote}` : ""}
            </p>
          ) : (
            <p>
              Unable to use a camera, microphone or fullscreen?{" "}
              <button type="button" className="font-medium text-primary underline-offset-2 hover:underline dark:text-primary-soft-foreground" onClick={() => setAccOpen(true)}>
                Request an accommodation
              </button>
            </p>
          )}
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border bg-subtle p-3 text-[14.5px]">
        <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" aria-label="I have read the instructions" />
        <span>I have read and understood the instructions. I will not switch tabs or leave the exam window during the test.</span>
      </label>

      <Button className="w-full" size="lg" disabled={!ready} loading={starting} onClick={start}>
        <PlayCircle /> {resume ? "Resume exam" : "Start Examination"}
      </Button>
      {!ready && !starting && <p className="text-center text-xs text-muted-foreground">Complete the checks above to {resume ? "resume" : "start"}.</p>}

      <AccommodationDialog token={token} open={accOpen} onOpenChange={setAccOpen} security={security} onDone={() => router.refresh()} />
    </div>
  );
}

function AccommodationDialog({ token, open, onOpenChange, security, onDone }: { token: string; open: boolean; onOpenChange: (o: boolean) => void; security: Props["security"]; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [sel, setSel] = useState({ camera: security.camera, microphone: security.microphone, fullscreen: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/exams/${token}/accommodation`, { method: "POST", json: { reason, ...sel } });
      toast.success("Your request has been sent to the examination cell.");
      onOpenChange(false);
      onDone();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an accommodation</DialogTitle>
          <DialogDescription>The examination cell will review your request. You can start the exam once it is approved.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="space-y-2 text-[14.5px]">
            {security.camera && (
              <label className="flex items-center gap-2"><Checkbox checked={sel.camera} onCheckedChange={(v) => setSel((s) => ({ ...s, camera: v === true }))} /> Exemption from the camera requirement</label>
            )}
            {security.microphone && (
              <label className="flex items-center gap-2"><Checkbox checked={sel.microphone} onCheckedChange={(v) => setSel((s) => ({ ...s, microphone: v === true }))} /> Exemption from the microphone requirement</label>
            )}
            {security.fullscreen && (
              <label className="flex items-center gap-2"><Checkbox checked={sel.fullscreen} onCheckedChange={(v) => setSel((s) => ({ ...s, fullscreen: v === true }))} /> Exemption from fullscreen mode (e.g. assistive technology)</label>
            )}
          </div>
          <Field label="Reason" htmlFor="acc-reason" hint="Describe your situation briefly (at least 10 characters).">
            <Textarea id="acc-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={reason.trim().length < 10}>Send request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
