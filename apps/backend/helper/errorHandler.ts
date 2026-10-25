import type { Request, Response, NextFunction } from "express";
import { COMMON_ERRORS } from "./errors";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err);
  return res.status(500).json({
    success: false,
    error: COMMON_ERRORS.INTERNAL_SERVER_ERROR,
    code: "INTERNAL_SERVER_ERROR",
  });
};
