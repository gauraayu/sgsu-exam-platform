import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";

/** Sends an email when SMTP is configured. Returns false (and logs) when it is not. */
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const smtp = env.smtp();
  if (!smtp) {
    console.info(`[mail] SMTP not configured — email to ${to} not sent. Subject: ${subject}\n${text}`);
    return false;
  }
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
  });
  await transport.sendMail({ from: smtp.from, to, subject, text });
  return true;
}
