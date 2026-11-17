"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client-api";
import { DIFFICULTY_VALUES, SUBJECTS } from "@/lib/constants";
import type { QuestionEditable } from "@/lib/validation/questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Alert } from "@/components/ui/states";
import { QuestionPreview } from "./question-preview";

type FormValues = Omit<QuestionEditable, "questionImages" | "solutionImages" | "correctOption" | "numericalTolerance"> & {
  questionImagesText: string;
  solutionImagesText: string;
  correctOption: string;
  numericalTolerance: string;
};

const toList = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

export function QuestionEditor({ initial, id }: { initial?: Partial<QuestionEditable>; id?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    defaultValues: {
      subject: initial?.subject ?? "Physics",
      chapter: initial?.chapter ?? "",
      topic: initial?.topic ?? "",
      subtopic: initial?.subtopic ?? "",
      academicLevel: initial?.academicLevel ?? "",
      difficulty: initial?.difficulty ?? "Medium",
      questionType: initial?.questionType ?? "single_correct",
      questionText: initial?.questionText ?? "",
      options: [0, 1, 2, 3].map((i) => initial?.options?.[i] ?? ""),
      correctOption: initial?.correctOption ? String(initial.correctOption) : "",
      numericalAnswer: initial?.numericalAnswer ?? "",
      numericalTolerance: String(initial?.numericalTolerance ?? 0),
      explanation: initial?.explanation ?? "",
      questionImagesText: (initial?.questionImages ?? []).join("\n"),
      solutionImagesText: (initial?.solutionImages ?? []).join("\n"),
      originalQuestionId: initial?.originalQuestionId ?? "",
      originalSource: initial?.originalSource ?? "",
      sourceLicense: initial?.sourceLicense ?? "",
    },
  });
  const v = useWatch({ control: form.control });
  const type = v.questionType;

  const onSubmit = form.handleSubmit(async (f) => {
    setError(null);
    const data: QuestionEditable = {
      subject: f.subject,
      chapter: f.chapter,
      topic: f.topic,
      subtopic: f.subtopic,
      academicLevel: f.academicLevel,
      difficulty: f.difficulty,
      questionType: f.questionType,
      questionText: f.questionText,
      options: f.questionType === "single_correct" ? f.options : [],
      correctOption: f.questionType === "single_correct" && f.correctOption ? Number(f.correctOption) : null,
      numericalAnswer: f.questionType === "numerical" ? f.numericalAnswer || null : null,
      numericalTolerance: Number(f.numericalTolerance) || 0,
      explanation: f.explanation,
      questionImages: toList(f.questionImagesText),
      solutionImages: toList(f.solutionImagesText),
      originalQuestionId: f.originalQuestionId,
      originalSource: f.originalSource,
      sourceLicense: f.sourceLicense,
    };
    try {
      if (id) {
        await api(`/api/admin/questions/${id}`, { method: "PATCH", json: { action: "update", data } });
        toast.success("Question saved.");
      } else {
        await api("/api/admin/questions", { method: "POST", json: data });
        toast.success("Question created and added to the bank.");
      }
      router.push("/admin/questions");
      router.refresh();
    } catch (e) {
      setError((e as ApiError).message);
    }
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]" noValidate>
      <Card>
        <CardHeader><div><CardTitle>Question details</CardTitle><CardDescription>Use $…$ for inline LaTeX and $$…$$ for display formulas. Use [IMAGE] to place a diagram inside the text.</CardDescription></div></CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Subject" htmlFor="subject"><Select id="subject" {...form.register("subject")}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Difficulty" htmlFor="difficulty"><Select id="difficulty" {...form.register("difficulty")}>{DIFFICULTY_VALUES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Question type" htmlFor="questionType"><Select id="questionType" {...form.register("questionType")}><option value="single_correct">Single correct MCQ</option><option value="numerical">Numerical</option></Select></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Chapter" htmlFor="chapter"><Input id="chapter" {...form.register("chapter")} /></Field>
            <Field label="Topic" htmlFor="topic"><Input id="topic" {...form.register("topic")} /></Field>
            <Field label="Subtopic" htmlFor="subtopic"><Input id="subtopic" {...form.register("subtopic")} /></Field>
          </div>
          <Field label="Question text" htmlFor="questionText" required><Textarea id="questionText" rows={5} className="font-mono text-[14.5px]" {...form.register("questionText", { required: true })} /></Field>
          {type === "single_correct" ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Field key={i} label={`Option ${"ABCD"[i]}`} htmlFor={`opt-${i}`}><Input id={`opt-${i}`} className="font-mono text-[14.5px]" {...form.register(`options.${i}` as const)} /></Field>
              ))}
              <Field label="Correct option" htmlFor="correctOption">
                <Select id="correctOption" {...form.register("correctOption")}><option value="">Not set</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{"ABCD"[n - 1]}</option>)}</Select>
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Numerical answer" htmlFor="numericalAnswer"><Input id="numericalAnswer" inputMode="decimal" {...form.register("numericalAnswer")} /></Field>
              <Field label="Tolerance (±)" htmlFor="numericalTolerance" hint="0 for exact match"><Input id="numericalTolerance" inputMode="decimal" {...form.register("numericalTolerance")} /></Field>
            </div>
          )}
          <Field label="Explanation / solution" htmlFor="explanation"><Textarea id="explanation" rows={4} className="font-mono text-[14.5px]" {...form.register("explanation")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Question images" htmlFor="qimg" hint="One path per line, e.g. /questions/physics/images/image5.png"><Textarea id="qimg" rows={2} className="font-mono text-xs" {...form.register("questionImagesText")} /></Field>
            <Field label="Solution images" htmlFor="simg"><Textarea id="simg" rows={2} className="font-mono text-xs" {...form.register("solutionImagesText")} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Original question ID" htmlFor="oqid"><Input id="oqid" {...form.register("originalQuestionId")} /></Field>
            <Field label="Original source" htmlFor="osrc"><Input id="osrc" {...form.register("originalSource")} /></Field>
            <Field label="License / attribution" htmlFor="lic"><Input id="lic" {...form.register("sourceLicense")} /></Field>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" loading={form.formState.isSubmitting}>{id ? "Save changes" : "Create question"}</Button>
        </CardFooter>
      </Card>
      <div className="xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader><CardTitle>Live preview</CardTitle></CardHeader>
          <CardContent>
            {v.questionText ? (
              <QuestionPreview
                questionText={v.questionText ?? ""}
                questionImages={toList(v.questionImagesText ?? "")}
                options={(v.options ?? []).map((o) => o ?? "")}
                questionType={v.questionType ?? "single_correct"}
                correctOption={v.correctOption ? Number(v.correctOption) : null}
                numericalAnswer={v.numericalAnswer ?? null}
                explanation={v.explanation}
                solutionImages={toList(v.solutionImagesText ?? "")}
              />
            ) : <p className="text-sm text-muted-foreground">Start typing the question to see how students will see it.</p>}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
