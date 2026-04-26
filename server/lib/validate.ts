import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logger } from "./logger";
import { ApiError } from "./errors";

function parseOrThrow(schema: ZodSchema, value: unknown, path: string) {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      logger.warn(
        { path, error: validationError.message },
        "Validation failed",
      );
      throw new ApiError({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "Request validation failed",
        details: validationError.message,
      });
    }
    throw error;
  }
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = parseOrThrow(schema, req.body, req.path);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = parseOrThrow(schema, req.params, req.path) as Request["params"];
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = parseOrThrow(schema, req.query, req.path) as Request["query"];
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const validateRequest = validateBody;
