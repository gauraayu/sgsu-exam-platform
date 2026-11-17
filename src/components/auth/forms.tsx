"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, CheckCircle2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { api, ApiError } from "@/lib/client-api";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, safeNextPath, signupSchema, type LoginInput, type SignupInput } from "@/lib/validation/auth";
import { ACADEMIC_LEVELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Alert } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/** Inputs on the auth pages are a little taller for comfortable typing and tapping. */
const AUTH_INPUT = "h-11 text-[15px]";

function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn(AUTH_INPUT, "pr-11", className)} />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export function LoginForm({ next, expired }: { next?: string; expired?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const { user } = await api<{ user: { role: string } }>("/api/auth/login", { method: "POST", json: values });
      const fallback = user.role === "ADMIN" ? "/admin" : "/student";
      router.replace(safeNextPath(next, fallback));
      router.refresh();
    } catch (e) {
      setError((e as ApiError).message);
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-[26px] font-semibold tracking-tight">Sign in</h1>
        <p className="text-[15px] text-muted-foreground">Welcome back. Use the email and password you registered with.</p>
      </div>
      {expired && <Alert variant="warning">Your session has ended. Please sign in again to continue.</Alert>}
      {(next?.startsWith("/exam/") || next?.startsWith("/student/exams")) && <Alert variant="info">Sign in to continue to your examination. New here? Create an account first — you will come back here afterwards.</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com" className={AUTH_INPUT} aria-invalid={!!errors.email} {...form.register("email")} />
        </Field>
        {/* The reset link sits beside the label (not inside it) so the field's accessible name stays "Password". */}
        <div className="relative">
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register("password")} />
          </Field>
          <Link href="/forgot-password" className="absolute right-0 top-0 text-[13px] font-medium leading-none text-primary hover:underline dark:text-primary-soft-foreground">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
      <p className="text-center text-[14.5px] text-muted-foreground">
        New to the portal?{" "}
        <Link href={withNext("/signup", next)} className="font-medium text-primary hover:underline dark:text-primary-soft-foreground">
          Create a student account
        </Link>
      </p>
    </div>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", mobile: "", password: "", confirmPassword: "", institutionName: "", academicLevel: undefined as unknown as SignupInput["academicLevel"] },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api("/api/auth/signup", { method: "POST", json: values });
      toast.success("Your account has been created.");
      router.replace(safeNextPath(next, "/student"));
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "CONFLICT") form.setError("email", { message: err.message });
      else setError(err.message);
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-[26px] font-semibold tracking-tight">Create your student account</h1>
        <p className="text-[15px] text-muted-foreground">Register once and use the same account for every SGSU assessment.</p>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
          <Input id="fullName" autoComplete="name" placeholder="As on your school or college records" className={AUTH_INPUT} aria-invalid={!!errors.fullName} {...form.register("fullName")} />
        </Field>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email?.message} required>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className={AUTH_INPUT} aria-invalid={!!errors.email} {...form.register("email")} />
          </Field>
          <Field label="Mobile number" htmlFor="mobile" error={errors.mobile?.message} required>
            <Input id="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" className={AUTH_INPUT} aria-invalid={!!errors.mobile} {...form.register("mobile")} />
          </Field>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Academic level" htmlFor="academicLevel" error={errors.academicLevel?.message} required>
            <Select id="academicLevel" defaultValue="" className={AUTH_INPUT} aria-invalid={!!errors.academicLevel} {...form.register("academicLevel")}>
              <option value="" disabled>
                Select your level
              </option>
              {ACADEMIC_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="School / college" htmlFor="institutionName" error={errors.institutionName?.message} required>
            <Input id="institutionName" autoComplete="organization" placeholder="Name of your institution" className={AUTH_INPUT} aria-invalid={!!errors.institutionName} {...form.register("institutionName")} />
          </Field>
        </div>
        <div className="space-y-1.5">
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field label="Password" htmlFor="password" error={errors.password?.message} required>
              <PasswordInput id="password" autoComplete="new-password" aria-describedby="password-rule" aria-invalid={!!errors.password} {...form.register("password")} />
            </Field>
            <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
              <PasswordInput id="confirmPassword" autoComplete="new-password" aria-invalid={!!errors.confirmPassword} {...form.register("confirmPassword")} />
            </Field>
          </div>
          <p id="password-rule" className="text-xs text-muted-foreground">Use at least 8 characters, including a letter and a number.</p>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="text-center text-[14.5px] text-muted-foreground">
        Already registered?{" "}
        <Link href={withNext("/login", next)} className="font-medium text-primary hover:underline dark:text-primary-soft-foreground">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const [error, setError] = useState<string | null>(null);
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api("/api/auth/forgot-password", { method: "POST", json: values });
      setSent(true);
    } catch (e) {
      setError((e as ApiError).message);
    }
  });
  if (sent)
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <MailCheck className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">If an account exists for that address, we have sent a link to reset your password. The link expires in 60 minutes.</p>
        <p className="text-[14.5px] text-muted-foreground">Didn&apos;t receive it? Contact the SGSU examination cell — they can issue a reset link for you.</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-[24px] font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">Enter your registered email and we&apos;ll send you a reset link.</p>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus {...form.register("email")} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="text-center text-[14.5px]">
        <Link href="/login" className="font-medium text-primary hover:underline dark:text-primary-soft-foreground">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token, password: "", confirmPassword: "" } });
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await api("/api/auth/reset-password", { method: "POST", json: values });
      setDone(true);
    } catch (e) {
      setError((e as ApiError).message);
    }
  });
  if (!token) return <Alert variant="danger" title="Invalid reset link">Open the link from your email again, or request a new one.</Alert>;
  if (done)
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">Password updated</h1>
        <p className="text-sm text-muted-foreground">You have been signed out of all devices. Sign in with your new password.</p>
        <Button asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-[24px] font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">Use at least 8 characters with a letter and a number.</p>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="New password" htmlFor="password" error={form.formState.errors.password?.message}>
          <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        <Field label="Confirm new password" htmlFor="confirmPassword" error={form.formState.errors.confirmPassword?.message}>
          <PasswordInput id="confirmPassword" autoComplete="new-password" {...form.register("confirmPassword")} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={form.formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  );
}
