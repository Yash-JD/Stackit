import z from "zod";

export const SignupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  profile: z.string(),
  description: z.string(),
});

export const SigninSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
