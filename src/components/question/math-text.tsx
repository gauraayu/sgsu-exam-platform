"use client";

import katex from "katex";
import { Fragment, useMemo } from "react";
import { cn } from "@/lib/utils";

type Segment = { type: "text"; value: string } | { type: "math"; value: string; display: boolean };

/** Splits text into plain and LaTeX segments: $$…$$, \[…\], $…$ and \(…\). Escaped \$ is literal. */
export function splitMath(input: string): Segment[] {
  const out: Segment[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|(?<!\\)\$((?:\\\$|[^$])+?)\$|\\\(([\s\S]+?)\\\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    if (m.index > last) out.push({ type: "text", value: input.slice(last, m.index) });
    const display = m[1] !== undefined || m[2] !== undefined;
    out.push({ type: "math", value: (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim(), display });
    last = m.index + m[0].length;
  }
  if (last < input.length) out.push({ type: "text", value: input.slice(last) });
  return out.map((s) => (s.type === "text" ? { ...s, value: s.value.replace(/\\\$/g, "$") } : s));
}

function renderMath(tex: string, display: boolean) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", trust: false, output: "htmlAndMathml" });
  } catch {
    return null;
  }
}

/** Renders text with LaTeX formulas. Plain text is rendered as React text nodes (never as HTML). */
export function MathText({ text, className, as: Tag = "span" }: { text: string; className?: string; as?: "span" | "div" | "p" }) {
  const segments = useMemo(() => splitMath(text ?? ""), [text]);
  return (
    <Tag className={cn("question-text", className)}>
      {segments.map((s, i) => {
        if (s.type === "text") return <Fragment key={i}>{s.value}</Fragment>;
        const html = renderMath(s.value, s.display);
        return html ? <span key={i} dangerouslySetInnerHTML={{ __html: html }} /> : <code key={i}>{s.value}</code>;
      })}
    </Tag>
  );
}

/** Shortens text for previews without cutting a $…$ formula in half. */
export function previewText(text: string, max = 140) {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  let cut = flat.slice(0, max);
  const dollars = (cut.match(/(?<!\\)\$/g) ?? []).length;
  if (dollars % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("$"));
  return `${cut.trimEnd()}…`;
}
