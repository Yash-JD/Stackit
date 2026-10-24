import { prisma } from "db/client";

export const hasRole = async (
  userId: string,
  orgId: string,
  role: "admin" | "member",
) => {
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      orgId,
      isDeleted: false,
      organization: { isDeleted: false },
    },
    select: { role: true },
  });

  if (!membership) return false;
  if (role === "member") return true;
  return membership.role === "admin" || membership.role === "superadmin";
};

export async function hasBoardAccess(userId: string, boardId: string) {
  const board = await prisma.boards.findFirst({
    where: {
      id: boardId,
      isDeleted: false,
      organization: { isDeleted: false },
    },
    select: { orgId: true },
  });
  if (!board) return false;

  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      orgId: board.orgId,
      isDeleted: false,
      organization: { isDeleted: false },
    },
    select: { role: true },
  });
  if (!membership) return false;
  if (membership.role !== "member") return true;

  const boardMembership = await prisma.boardMembership.findFirst({
    where: {
      userId,
      boardId,
      isDeleted: false,
    },
    select: { id: true },
  });

  return Boolean(boardMembership);
}
