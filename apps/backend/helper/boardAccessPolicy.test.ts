import { describe, expect, it } from "bun:test";
import { canMembershipAccessBoard } from "./boardAccessPolicy";

describe("canMembershipAccessBoard", () => {
  it("allows admins and superadmins without explicit board grants", () => {
    expect(canMembershipAccessBoard("admin", false)).toBe(true);
    expect(canMembershipAccessBoard("superadmin", false)).toBe(true);
  });

  it("requires a board grant for regular members", () => {
    expect(canMembershipAccessBoard("member", false)).toBe(false);
    expect(canMembershipAccessBoard("member", true)).toBe(true);
  });

  it("denies users without an active workspace role", () => {
    expect(canMembershipAccessBoard(null, true)).toBe(false);
  });
});
