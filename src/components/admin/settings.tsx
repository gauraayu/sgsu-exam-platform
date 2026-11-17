"use client";

import { useState } from "react";
import { CheckCircle2, Database, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/client-api";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/states";
import { ChangePasswordForm } from "@/components/student/profile-form";

interface System {
  database: { connected: boolean; name: string; host: string };
  appUrl: string;
  approvedImportHosts: string[];
  smtpConfigured: boolean;
  cronConfigured: boolean;
  questionImages: number;
  nodeVersion: string;
  recentAudit: { id: string; action: string; targetType: string; targetId: string; createdAt: string; actorId?: { fullName: string } }[];
}

function Status({ ok, label }: { ok: boolean; label: string }) {
  return <span className="flex items-center gap-1.5">{ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-muted-foreground" />}{label}</span>;
}

export function AdminSettings() {
  const sys = useApi<System>("/api/admin/system");
  const admins = useApi<{ admins: { id: string; fullName: string; email: string; createdAt: string; lastLoginAt: string | null }[] }>("/api/admin/users");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function addAdmin() {
    setSaving(true);
    setErr(null);
    try {
      await api("/api/admin/users", { method: "POST", json: form });
      toast.success("Administrator added.");
      setOpen(false);
      setForm({ fullName: "", email: "", password: "" });
      await admins.reload(true);
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }
  const s = sys.data;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><Database className="size-4" /> System status</CardTitle><CardDescription>Configuration is read from environment variables and never shown in full.</CardDescription></div></CardHeader>
        <CardContent>
          {!s ? <Skeleton className="h-24" /> : (
            <dl className="grid gap-4 text-[14.5px] sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-xs text-muted-foreground">MongoDB</dt><dd className="font-medium"><Status ok={s.database.connected} label={s.database.connected ? `Connected · ${s.database.name}` : "Not reachable"} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Public URL</dt><dd className="font-mono text-xs">{s.appUrl}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Question images available</dt><dd className="font-medium">{s.questionImages}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Runtime</dt><dd className="font-medium">Node {s.nodeVersion}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Password reset email</dt><dd className="font-medium"><Status ok={s.smtpConfigured} label={s.smtpConfigured ? "SMTP configured" : "Not configured — use admin reset links"} /></dd></div>
              <div><dt className="text-xs text-muted-foreground">Scheduled finalisation</dt><dd className="font-medium"><Status ok={s.cronConfigured} label={s.cronConfigured ? "CRON_SECRET set" : "Not configured (lazy finalisation only)"} /></dd></div>
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Approved API import hosts</dt><dd className="font-mono text-xs">{s.approvedImportHosts.join(", ") || "None"}</dd></div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Administrators</CardTitle><CardDescription>People with full access to the examination cell tools.</CardDescription></div><Button size="sm" onClick={() => setOpen(true)}><UserPlus /> Add administrator</Button></CardHeader>
        {!admins.data ? <Skeleton className="m-5 h-20" /> : (
          <Table><THead><TR><TH>Name</TH><TH>Email</TH><TH>Added</TH><TH>Last sign-in</TH></TR></THead>
            <TBody>{admins.data.admins.map((a) => <TR key={a.id}><TD className="font-medium">{a.fullName}</TD><TD>{a.email}</TD><TD className="text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</TD><TD className="text-xs text-muted-foreground">{formatDateTime(a.lastLoginAt)}</TD></TR>)}</TBody></Table>
        )}
      </Card>

      <ChangePasswordForm />

      <Card>
        <CardHeader><div><CardTitle>Recent audit log</CardTitle><CardDescription>Administrative actions recorded in MongoDB</CardDescription></div></CardHeader>
        {!s ? <Skeleton className="m-5 h-20" /> : !s.recentAudit.length ? <p className="px-5 py-6 text-sm text-muted-foreground">No actions recorded yet.</p> : (
          <Table><THead><TR><TH>When</TH><TH>Who</TH><TH>Action</TH><TH>Target</TH></TR></THead>
            <TBody>{s.recentAudit.map((a) => <TR key={a.id}><TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</TD><TD>{a.actorId?.fullName ?? "—"}</TD><TD className="font-mono text-xs">{a.action}</TD><TD className="font-mono text-xs text-muted-foreground">{a.targetType} {a.targetId}</TD></TR>)}</TBody></Table>
        )}
        <CardFooter className="justify-start text-xs text-muted-foreground">Showing the 20 most recent entries.</CardFooter>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add administrator</DialogTitle><DialogDescription>The new administrator can sign in immediately with this password.</DialogDescription></DialogHeader>
          <DialogBody className="space-y-3">
            {err && <Alert variant="danger">{err}</Alert>}
            <Field label="Full name" htmlFor="a-name"><Input id="a-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label="Email" htmlFor="a-email"><Input id="a-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Temporary password" htmlFor="a-pw" hint="8+ characters with a letter and a number"><Input id="a-pw" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          </DialogBody>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={addAdmin}>Add administrator</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
