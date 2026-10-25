import { prisma } from "db/client";
import { canMembershipAccessBoard } from "./boardAccessPolicy";

export const hasRole = async (
  userId: string,
  orgId: string,
  role: "superadmin" | "admin" | "member",
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
  if (role === "admin") return membership.role === "admin" || membership.role === "superadmin";
  if (role === "superadmin") return membership.role === "superadmin";
  return false;
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
  if (canMembershipAccessBoard(membership.role, false)) return true;

  const boardMembership = await prisma.boardMembership.findFirst({
    where: {
      userId,
      boardId,
      isDeleted: false,
    },
    select: { id: true },
  });

  return canMembershipAccessBoard(membership.role, Boolean(boardMembership));
}
