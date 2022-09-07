import nodemailer, { SendMailOptions } from "nodemailer";

const transporter = nodemailer.createTransport(process.env.SMTP_CREDENTIAL);

export function sendEmail(options: SendMailOptions) {
  return transporter.sendMail(options);
}
