export function getMembershipMutationBlockReason(
  actorId: string,
  targetUserId: string,
  targetRole: "superadmin" | "admin" | "member",
): "SUPERADMIN" | "SELF" | null {
  if (targetRole === "superadmin") return "SUPERADMIN";
  if (actorId === targetUserId) return "SELF";
  return null;
}
