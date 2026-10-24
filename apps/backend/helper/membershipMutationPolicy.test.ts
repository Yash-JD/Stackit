import { describe, expect, it } from "bun:test";
import { getMembershipMutationBlockReason } from "./membershipMutationPolicy";

describe("getMembershipMutationBlockReason", () => {
  it("blocks users from changing or removing their own membership", () => {
    expect(getMembershipMutationBlockReason("user-1", "user-1", "admin")).toBe(
      "SELF",
    );
  });

  it("continues to protect the workspace superadmin", () => {
    expect(
      getMembershipMutationBlockReason("admin-1", "superadmin-1", "superadmin"),
    ).toBe("SUPERADMIN");
  });

  it("allows administrators to manage another non-superadmin member", () => {
    expect(
      getMembershipMutationBlockReason("admin-1", "member-1", "member"),
    ).toBeNull();
  });
});
