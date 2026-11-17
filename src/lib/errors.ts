export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INSUFFICIENT_QUESTIONS"
  | "EXAM_NOT_AVAILABLE"
  | "ATTEMPT_CLOSED"
  | "PAYLOAD_TOO_LARGE"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INSUFFICIENT_QUESTIONS: 422,
  EXAM_NOT_AVAILABLE: 403,
  ATTEMPT_CLOSED: 409,
  PAYLOAD_TOO_LARGE: 413,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found.`);
export const forbidden = (msg = "You do not have permission to perform this action.") => new AppError("FORBIDDEN", msg);
export const badRequest = (msg: string, details?: unknown) => new AppError("BAD_REQUEST", msg, details);
export const conflict = (msg: string, details?: unknown) => new AppError("CONFLICT", msg, details);
