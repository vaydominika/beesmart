import { Resend } from "resend";
import { createTranslator } from "next-intl";
import en from "@/messages/en.json";
import hu from "@/messages/hu.json";
import type { Locale } from "@/i18n/config";
import { RESEND_EMAIL_FROM } from "@/lib/env";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
  idempotencyKey: string;
  locale?: Locale;
};

type EmailVerificationEmail = {
  to: string;
  verificationUrl: string;
  idempotencyKey: string;
  locale?: Locale;
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

export async function sendPasswordResetEmail({ to, resetUrl, idempotencyKey, locale = "en" }: PasswordResetEmail) {
  const t = createTranslator({ locale, messages: locale === "hu" ? hu : en, namespace: "Email" });
  try {
    await sendTransactionalEmail({
      to,
      subject: t("passwordSubject"),
      text: t("passwordText", { url: resetUrl }),
      html: emailHtml(locale, t("passwordSubject"), t("passwordInstructions"), t("passwordButton"), t("passwordIgnore"), resetUrl),
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Resend rejected email:")) {
      throw new Error(error.message.replace("Resend rejected email:", "Resend rejected password reset email:"));
    }
    throw error;
  }
}

export async function sendEmailVerificationEmail({ to, verificationUrl, idempotencyKey, locale = "en" }: EmailVerificationEmail) {
  const t = createTranslator({ locale, messages: locale === "hu" ? hu : en, namespace: "Email" });
  try {
    await sendTransactionalEmail({
      to,
      subject: t("verificationSubject"),
      text: t("verificationText", { url: verificationUrl }),
      html: emailHtml(locale, t("verificationSubject"), t("verificationInstructions"), t("verificationButton"), t("verificationIgnore"), verificationUrl),
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Resend rejected email:")) {
      throw new Error(error.message.replace("Resend rejected email:", "Resend rejected verification email:"));
    }
    throw error;
  }
}

function emailHtml(locale: Locale, subject: string, instructions: string, button: string, ignore: string, url: string) {
  return `<div lang="${locale}" style="font-family:Arial,sans-serif;line-height:1.6;color:#202020"><h1 style="font-size:24px">${subject}</h1><p>${instructions}</p><p><a href="${url}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#f4c542;color:#202020;font-weight:700;text-decoration:none">${button}</a></p><p style="font-size:13px;color:#666">${ignore}</p></div>`;
}
