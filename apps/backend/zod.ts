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

export const OrgSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
