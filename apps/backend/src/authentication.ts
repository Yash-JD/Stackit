import express, { type Response, type Request } from "express";
import { SignupSchema, SigninSchema } from "../zod.ts";
import { prisma } from "db/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}

const router = express.Router();

router.post("/api/v1/signup", async (req: Request, res: Response) => {
  const { success, data } = SignupSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: data.email,
      isDeleted: false,
    },
  });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: "user already exists please signin",
    });
  }

  const hash = await bcrypt.hash(data.password, 10);

  await prisma.user.create({
    data: {
      email: data.email,
      password: hash,
      profilePhoto: data.profile,
      description: data.description,
    },
  });
  return res.status(200).json({
    success: true,
    msg: "SUCCESSFULLY_SIGNEDUP",
  });
});

router.post("/api/v1/signin", async (req: Request, res: Response) => {
  const { success, data } = SigninSchema.safeParse(req.body);
  if (!success) {
    return res.status(400).json({
      success: false,
      error: "INVALID_REQUEST",
    });
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: data.email,
      isDeleted: false,
    },
  });

  if (!existingUser) {
    return res.status(400).json({
      success: false,
      error: "USER_NOT_FOUND_PLEASE_SIGNUP",
    });
  }

  if (!existingUser.password) {
    return res.status(400).json({
      success: false,
      error: "SIGN_IN_WITH_GOOGLE_INSTEAD",
    });
  }

  const password = await bcrypt.compare(data.password, existingUser.password);
  if (!password) {
    return res.status(400).json({
      success: false,
      error: "INCORRECT_PASSWORD",
    });
  }
  const token = jwt.sign(
    {
      id: existingUser.id,
      email: existingUser.email,
    },
    JWT_SECRET,
  );

  return res.status(200).json({
    success: true,
    data: token,
    msg: "USER_SUCCESSFULLY_SIGNEDIN",
  });
});

export default router;
