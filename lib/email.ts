import { Resend } from "resend";
import { RESEND_EMAIL_FROM } from "@/lib/env";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
  idempotencyKey: string;
};

type EmailVerificationEmail = {
  to: string;
  verificationUrl: string;
  idempotencyKey: string;
};

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};

async function sendTransactionalEmail({ to, subject, text, html, idempotencyKey }: TransactionalEmail) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Resend email delivery is not configured");
  if (from !== RESEND_EMAIL_FROM) throw new Error(`EMAIL_FROM must be ${RESEND_EMAIL_FROM}`);

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
    html,
    headers: { "X-Entity-Ref-ID": idempotencyKey },
  }, { idempotencyKey });

  if (error) throw new Error(`Resend rejected email: ${error.message}`);
}

export async function sendPasswordResetEmail({ to, resetUrl, idempotencyKey }: PasswordResetEmail) {
  try {
    await sendTransactionalEmail({
      to,
      subject: "Reset your BeeSmart password",
      text: `Use this link to reset your BeeSmart password. It expires in one hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#202020"><h1 style="font-size:24px">Reset your BeeSmart password</h1><p>Use the button below to choose a new password. This link expires in one hour.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#f4c542;color:#202020;font-weight:700;text-decoration:none">Reset password</a></p><p style="font-size:13px;color:#666">If you did not request this, you can ignore this email.</p></div>`,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Resend rejected email:")) {
      throw new Error(error.message.replace("Resend rejected email:", "Resend rejected password reset email:"));
    }
    throw error;
  }
}

export async function sendEmailVerificationEmail({ to, verificationUrl, idempotencyKey }: EmailVerificationEmail) {
  try {
    await sendTransactionalEmail({
      to,
      subject: "Verify your BeeSmart email",
      text: `Verify your BeeSmart email address using this link. It expires in 24 hours:\n\n${verificationUrl}\n\nIf you did not create this account, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#202020"><h1 style="font-size:24px">Verify your BeeSmart email</h1><p>Confirm your email address to finish creating your account. This link expires in 24 hours.</p><p><a href="${verificationUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#f4c542;color:#202020;font-weight:700;text-decoration:none">Verify email</a></p><p style="font-size:13px;color:#666">If you did not create this account, you can ignore this email.</p></div>`,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Resend rejected email:")) {
      throw new Error(error.message.replace("Resend rejected email:", "Resend rejected verification email:"));
    }
    throw error;
  }
}
