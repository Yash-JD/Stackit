export async function deliverInvitationEmail(
  sendEmail: () => Promise<void>,
  markFailed: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await sendEmail();
    return true;
  } catch {
    await markFailed();
    return false;
  }
}
