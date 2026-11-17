import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import mongoose from "mongoose";
import { AppError } from "./errors";
import { connectDB } from "./db";

export function json<T>(data: T, init?: number | ResponseInit) {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, {
    ...responseInit,
    headers: { "Cache-Control": "no-store", ...(responseInit?.headers ?? {}) },
  });
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  if (err instanceof ZodError) {
    return json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: err.issues[0]?.message ?? "Invalid input.",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      422,
    );
  }
  if (err instanceof mongoose.Error.CastError) {
    return json({ error: { code: "NOT_FOUND", message: "Resource not found." } }, 404);
  }
  console.error("[api] unhandled error", err);
  return json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }, 500);
}

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler with DB connection and structured error handling. */
export function handler<P = Record<string, string>>(
  fn: (req: NextRequest, ctx: { params: P }) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      await connectDB();
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await fn(req, { params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    const existing = obj[key];
    if (existing === undefined) obj[key] = value;
    else obj[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  });
  return schema.parse(obj);
}

export function isValidObjectId(id: string) {
  return mongoose.isValidObjectId(id) && /^[a-f\d]{24}$/i.test(id);
}

export function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
