import { describe, expect, it } from "bun:test";
import { deliverInvitationEmail } from "./invitationDelivery";

describe("deliverInvitationEmail", () => {
  it("reports successful delivery without marking the invitation failed", async () => {
    let failedStatusUpdated = false;

    const emailSent = await deliverInvitationEmail(
      async () => {},
      async () => {
        failedStatusUpdated = true;
      },
    );

    expect(emailSent).toBe(true);
    expect(failedStatusUpdated).toBe(false);
  });

  it("marks the invitation failed when delivery rejects", async () => {
    let failedStatusUpdated = false;

    const emailSent = await deliverInvitationEmail(
      async () => {
        throw new Error("Email provider unavailable");
      },
      async () => {
        failedStatusUpdated = true;
      },
    );

    expect(emailSent).toBe(false);
    expect(failedStatusUpdated).toBe(true);
  });

  it("propagates errors while persisting the failed invitation status", async () => {
    const persistenceError = new Error("Unable to update invitation");

    await expect(
      deliverInvitationEmail(
        async () => {
          throw new Error("Email provider unavailable");
        },
        async () => {
          throw persistenceError;
        },
      ),
    ).rejects.toBe(persistenceError);
  });
});
