export type WorkspaceBoardRole = "superadmin" | "admin" | "member";

export function canMembershipAccessBoard(
  role: WorkspaceBoardRole | null,
  hasBoardGrant: boolean,
) {
  return role !== null && (role !== "member" || hasBoardGrant);
}
