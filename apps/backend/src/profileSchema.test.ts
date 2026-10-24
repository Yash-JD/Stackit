import { describe, expect, it } from "bun:test";
import { UpdateProfileSchema } from "../zod";

describe("UpdateProfileSchema", () => {
  it("accepts a profile photo URL and description without changing email", () => {
    const result = UpdateProfileSchema.safeParse({
      name: "Taylor Example",
      profilePhoto: "https://example.com/avatar.png",
      description: "Design lead",
      email: "changed@example.com",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Taylor Example",
        profilePhoto: "https://example.com/avatar.png",
        description: "Design lead",
      });
    }
  });

  it("allows clearing the profile photo", () => {
    expect(
      UpdateProfileSchema.safeParse({
        name: "Taylor",
        profilePhoto: "",
        description: "Working on Stackit",
      }).success,
    ).toBe(true);
  });

  it("rejects non-web photo URLs and descriptions over the limit", () => {
    expect(
      UpdateProfileSchema.safeParse({
        name: "Taylor",
        profilePhoto: "javascript:alert(1)",
        description: "Profile",
      }).success,
    ).toBe(false);
    expect(
      UpdateProfileSchema.safeParse({
        name: "Taylor",
        profilePhoto: "",
        description: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
