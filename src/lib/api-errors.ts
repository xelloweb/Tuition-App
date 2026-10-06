import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * Error codes returned to the browser. The UI maps these to friendly messages;
 * raw database / runtime errors are never sent to the client.
 */
export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_JSON"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DUPLICATE"
  | "RELATED_RECORD_MISSING"
  | "CONFLICT"
  | "HAS_HISTORY"
  | "SERVER_BUSY"
  | "INTERNAL";

export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors?: FieldErrors;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options: { fieldErrors?: FieldErrors; details?: Record<string, unknown> } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.details = options.details;
  }
}

export const validationError = (message: string, fieldErrors?: FieldErrors) =>
  new ApiError(400, "VALIDATION_FAILED", message, { fieldErrors });

export const forbiddenError = (
  message = "You do not have permission to perform this action."
) => new ApiError(403, "FORBIDDEN", message);

export const notFoundError = (message: string) => new ApiError(404, "NOT_FOUND", message);

export const conflictError = (message: string, details?: Record<string, unknown>) =>
  new ApiError(409, "CONFLICT", message, { details });

export const relatedRecordError = (message: string, fieldErrors?: FieldErrors) =>
  new ApiError(409, "RELATED_RECORD_MISSING", message, { fieldErrors });

/** Fields that are allowed to appear in a duplicate-value message. */
const DUPLICATE_FIELD_LABELS: Record<string, string> = {
  email: "email address",
  studentCode: "student ID",
  packageNumber: "package number",
  invoiceNumber: "invoice number",
  paymentNumber: "payment number",
  runNumber: "payout run number",
  name: "name",
  code: "code",
};

export function uniqueTargetIncludes(err: unknown, field: string): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  return JSON.stringify(err.meta?.target ?? "").includes(field);
}

function isSqliteBusy(err: unknown): boolean {
  const message = err instanceof Error ? err.message : "";
  return /database is locked|SQLITE_BUSY|Socket timeout/i.test(message);
}

/** Translates known Prisma failures into safe, user-facing errors. */
export function mapPrismaError(err: unknown): ApiError | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = JSON.stringify(err.meta?.target ?? "");
        const field = Object.keys(DUPLICATE_FIELD_LABELS).find((f) => target.includes(f));
        const label = field ? DUPLICATE_FIELD_LABELS[field] : "value";
        return new ApiError(409, "DUPLICATE", `Another record already uses this ${label}.`, {
          fieldErrors: field ? { [field]: `This ${label} is already in use.` } : undefined,
        });
      }
      case "P2003":
        return new ApiError(
          409,
          "RELATED_RECORD_MISSING",
          "A linked record (for example a subject, trainer or package) no longer exists. Refresh the page and try again."
        );
      case "P2025":
        return new ApiError(
          404,
          "NOT_FOUND",
          "This record no longer exists. Refresh the page and try again."
        );
      case "P2034":
        return new ApiError(
          503,
          "SERVER_BUSY",
          "Another change was being saved at the same time. Nothing was saved — please try again."
        );
    }
  }
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return new ApiError(
      503,
      "SERVER_BUSY",
      "The database is temporarily unavailable. Nothing was saved — please try again shortly."
    );
  }
  if (isSqliteBusy(err)) {
    return new ApiError(
      503,
      "SERVER_BUSY",
      "The system is busy saving another change. Nothing was saved — please try again."
    );
  }
  return null;
}

function newErrorReference(): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ERR-${time}-${random}`;
}

/**
 * Logs without request bodies or Prisma invocation dumps (which contain personal data).
 */
function logSanitized(reference: string | null, context: string, err: unknown) {
  const prefix = reference ? `[${reference}] ${context}` : context;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`${prefix}: Prisma ${err.code}`, JSON.stringify(err.meta ?? {}));
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(`${prefix}: Prisma validation error (invocation details withheld)`);
  } else if (err instanceof Error) {
    console.error(`${prefix}: ${err.name}: ${err.message.split("\n")[0].slice(0, 300)}`);
    if (err.stack) console.error(err.stack.split("\n").slice(1, 6).join("\n"));
  } else {
    console.error(`${prefix}: non-Error thrown`);
  }
}

export function errorResponse(err: unknown, context: string): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        ...(err.fieldErrors ? { fieldErrors: err.fieldErrors } : {}),
        ...(err.details ? { details: err.details } : {}),
      },
      { status: err.status }
    );
  }

  const mapped = mapPrismaError(err);
  if (mapped) {
    logSanitized(null, context, err);
    return errorResponse(mapped, context);
  }

  const reference = newErrorReference();
  logSanitized(reference, context, err);
  return NextResponse.json(
    {
      error: `Something went wrong on our side and nothing was saved. Please try again. If it keeps happening, share reference ${reference} with support.`,
      code: "INTERNAL",
      reference,
    },
    { status: 500 }
  );
}

/** Wraps a route handler so every failure becomes a sanitized JSON error response. */
export function withErrorHandling<Ctx>(
  context: string,
  handler: (req: Request, ctx: Ctx) => Promise<Response>
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err, context);
    }
  };
}

/** Reads a JSON object body, rejecting malformed or non-object payloads. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(
      400,
      "INVALID_JSON",
      "The request could not be read. Refresh the page and try again."
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "INVALID_JSON", "The request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}
