import { describe, expect, it } from "vitest";
import { detectFormat, parseCsv, parseJsonDocument, parseJsonl } from "@/lib/dataset/parse-files";
import { safeNextPath } from "@/lib/validation/auth";

describe("JSONL parsing", () => {
  it("handles blank lines and malformed records without throwing", () => {
    const out = parseJsonl('{"a":1}\n\n{bad json}\n["array"]\n{"a":2}\n');
    expect(out.rows.map((r) => r.data.a)).toEqual([1, 2]);
    expect(out.errors.map((e) => e.line)).toEqual([3, 4]);
    expect(out.blankLines).toBe(1);
  });
});

describe("JSON + CSV parsing", () => {
  it("accepts arrays and wrapped arrays, including HF datasets-server rows", () => {
    expect(parseJsonDocument('[{"q":1}]').rows).toHaveLength(1);
    expect(parseJsonDocument('{"rows":[{"row_idx":0,"row":{"q":1}}]}').rows[0].data).toEqual({ q: 1 });
    expect(parseJsonDocument('{"x":1}').errors).toHaveLength(1);
    expect(parseJsonDocument("not json").errors).toHaveLength(1);
  });
  it("parses CSV with quoted multi-line fields", () => {
    const out = parseCsv('question_text,option_a,answer\n"Line 1\nLine 2",5,A\n');
    expect(out.columns).toEqual(["question_text", "option_a", "answer"]);
    expect(out.rows[0].data.question_text).toBe("Line 1\nLine 2");
  });
  it("detects formats by extension", () => {
    expect(detectFormat("a.CSV")).toBe("csv");
    expect(detectFormat("a.ndjson")).toBe("jsonl");
    expect(detectFormat("a.xlsx")).toBeNull();
  });
});

describe("post-login redirect safety", () => {
  it("only allows same-origin relative paths", () => {
    expect(safeNextPath("/exam/sgsu-pcm-a7k29")).toBe("/exam/sgsu-pcm-a7k29");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/api/admin/questions")).toBe("/");
  });
});
