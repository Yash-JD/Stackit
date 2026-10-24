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

export const MembershipSchema = z.object({
  email: z.email(),
  orgId: z.string(),
  boardIds: z.array(z.string()).min(1),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const UpdateMemberBoardsSchema = z.object({
  boardIds: z.array(z.string()),
});

export const BoardSchema = z.object({
  title: z.string().min(1),
  orgId: z.string(),
});

export const BoardUpdateSchema = z.object({
  title: z.string().min(1),
});

export const SectionSchema = z.object({
  title: z.string().min(1),
  boardId: z.string(),
});

export const SectionUpdateSchema = z.object({
  title: z.string().min(1),
});

export const IssueSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  label: z.enum(["Design", "Build", "Research"]).default("Build"),
  dueDate: z.iso.date().nullable().optional(),
});

export const UpdateIssueSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  label: z.enum(["Design", "Build", "Research"]).optional(),
  dueDate: z.iso.date().nullable().optional(),
});

export const MoveIssueSchema = z.object({
  position: z.number().int().min(0).optional(),
});

export const CommentsSchema = z.object({
  comment: z.string().trim().min(1).max(4000),
});
