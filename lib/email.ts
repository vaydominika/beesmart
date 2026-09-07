import { Resend } from "resend";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
  idempotencyKey: string;
};

export async function sendPasswordResetEmail({ to, resetUrl, idempotencyKey }: PasswordResetEmail) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Resend email delivery is not configured");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: "Reset your BeeSmart password",
    text: `Use this link to reset your BeeSmart password. It expires in one hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#202020"><h1 style="font-size:24px">Reset your BeeSmart password</h1><p>Use the button below to choose a new password. This link expires in one hour.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#f4c542;color:#202020;font-weight:700;text-decoration:none">Reset password</a></p><p style="font-size:13px;color:#666">If you did not request this, you can ignore this email.</p></div>`,
    headers: { "X-Entity-Ref-ID": idempotencyKey },
  }, { idempotencyKey });

  if (error) throw new Error(`Resend rejected password reset email: ${error.message}`);
}
