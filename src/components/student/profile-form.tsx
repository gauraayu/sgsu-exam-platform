"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";
import { api, ApiError } from "@/lib/client-api";
import { ACADEMIC_LEVELS } from "@/lib/constants";
import { changePasswordSchema, profileUpdateSchema } from "@/lib/validation/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Profile = z.infer<typeof profileUpdateSchema>;

export function ProfileForm({ initial, email, studentId }: { initial: Profile; email: string; studentId: string | null }) {
  const form = useForm<Profile>({ resolver: zodResolver(profileUpdateSchema), defaultValues: initial });
  const { errors, isSubmitting, isDirty } = form.formState;
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api("/api/student/profile", { method: "PATCH", json: v });
      toast.success("Profile updated.");
      form.reset(v);
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  });
  return (
    <Card>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader><div><CardTitle>Personal details</CardTitle><CardDescription>Your email and student ID cannot be changed.</CardDescription></div></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Student ID"><Input value={studentId ?? "—"} disabled className="font-mono" /></Field>
          <Field label="Email"><Input value={email} disabled /></Field>
          <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}><Input id="fullName" {...form.register("fullName")} /></Field>
          <Field label="Mobile number" htmlFor="mobile" error={errors.mobile?.message}><Input id="mobile" {...form.register("mobile")} /></Field>
          <Field label="Academic level" htmlFor="academicLevel" error={errors.academicLevel?.message}>
            <Select id="academicLevel" {...form.register("academicLevel")}>{ACADEMIC_LEVELS.map((l) => <option key={l}>{l}</option>)}</Select>
          </Field>
          <Field label="School / college" htmlFor="institutionName" error={errors.institutionName?.message}><Input id="institutionName" {...form.register("institutionName")} /></Field>
        </CardContent>
        <CardFooter><Button type="submit" loading={isSubmitting} disabled={!isDirty}>Save changes</Button></CardFooter>
      </form>
    </Card>
  );
}

export function ChangePasswordForm() {
  const [key, setKey] = useState(0);
  const form = useForm<z.infer<typeof changePasswordSchema>>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", password: "", confirmPassword: "" } });
  const { errors, isSubmitting } = form.formState;
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await api("/api/auth/change-password", { method: "POST", json: v });
      toast.success("Password changed.");
      form.reset();
      setKey((k) => k + 1);
    } catch (e) {
      form.setError("currentPassword", { message: (e as ApiError).message });
    }
  });
  return (
    <Card key={key}>
      <form onSubmit={onSubmit} noValidate>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" htmlFor="currentPassword" error={errors.currentPassword?.message}><Input id="currentPassword" type="password" autoComplete="current-password" {...form.register("currentPassword")} /></Field>
          <Field label="New password" htmlFor="newPassword" error={errors.password?.message}><Input id="newPassword" type="password" autoComplete="new-password" {...form.register("password")} /></Field>
          <Field label="Confirm new password" htmlFor="confirmNew" error={errors.confirmPassword?.message}><Input id="confirmNew" type="password" autoComplete="new-password" {...form.register("confirmPassword")} /></Field>
        </CardContent>
        <CardFooter><Button type="submit" variant="outline" loading={isSubmitting}>Update password</Button></CardFooter>
      </form>
    </Card>
  );
}
