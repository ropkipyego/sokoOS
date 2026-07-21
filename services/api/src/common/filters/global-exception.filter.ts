import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AppError } from "@sokoos/shared";
import { ZodError } from "zod";

export type ErrorDetail = {
  path?: string;
  message: string;
  code?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId =
      request.requestId ??
      (request.headers["x-request-id"] as string | undefined) ??
      crypto.randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL";
    let message = "An unexpected error occurred";
    let details: ErrorDetail[] | undefined;

    if (exception instanceof AppError) {
      status = exception.status;
      code = mapAppErrorCode(exception.code);
      message = exception.message;
      details = normalizeDetails(exception.details);
    } else if (exception instanceof ZodError) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = "VALIDATION_FAILED";
      message = "Validation failed";
      details = exception.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
        code = httpStatusToCode(status);
      } else if (typeof body === "object" && body !== null) {
        const obj = body as Record<string, unknown>;
        message =
          (typeof obj.message === "string"
            ? obj.message
            : Array.isArray(obj.message)
              ? obj.message.join("; ")
              : exception.message) || exception.message;
        code =
          typeof obj.code === "string"
            ? obj.code
            : httpStatusToCode(status);
        details = normalizeDetails(obj.details ?? obj.message);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message =
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : exception.message;
    } else {
      this.logger.error("Unknown exception", String(exception));
    }

    response.status(status).json({
      error: {
        code,
        message,
        requestId,
        details,
      },
    });
  }
}

function mapAppErrorCode(code: string): string {
  switch (code) {
    case "VALIDATION":
      return "VALIDATION_FAILED";
    case "TENANT_MISMATCH":
      return "FORBIDDEN";
    default:
      return code;
  }
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return "VALIDATION_FAILED";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "VALIDATION_FAILED";
    case 429:
      return "RATE_LIMITED";
    case 503:
      return "UNAVAILABLE";
    default:
      return status >= 500 ? "INTERNAL" : "ERROR";
  }
}

function normalizeDetails(raw: unknown): ErrorDetail[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (Array.isArray(raw)) {
    return raw.map((item) => {
      if (typeof item === "string") return { message: item };
      if (typeof item === "object" && item !== null) {
        const o = item as Record<string, unknown>;
        return {
          path: typeof o.path === "string" ? o.path : undefined,
          message:
            typeof o.message === "string" ? o.message : JSON.stringify(item),
          code: typeof o.code === "string" ? o.code : undefined,
        };
      }
      return { message: String(item) };
    });
  }
  if (typeof raw === "string") return [{ message: raw }];
  return [{ message: JSON.stringify(raw) }];
}
