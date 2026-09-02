import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { emailRegex } from "../utils/emailValidation.js";

/**
 * Redacta la parte local de un email para logging, dejando solo el dominio (ej. "usuario@mail.com" -> "***@mail.com").
 */
function redactEmail(email: string): string {
  const atIndex = email.indexOf("@");
  return atIndex === -1 ? "***" : `***${email.slice(atIndex)}`;
}

let transporter: Transporter | undefined;

/**
 * Crea (una sola vez) y devuelve el transporter de Nodemailer configurado con Gmail SMTP,
 * validando las variables de entorno requeridas.
 * @returns El transporter de Nodemailer listo para usar.
 */
function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();

  if (!user) {
    throw new Error("La variable de entorno EMAIL_USER no está configurada.");
  }
  if (!emailRegex.test(user)) {
    throw new Error("La variable de entorno EMAIL_USER no tiene un formato de email válido.");
  }
  if (!pass) {
    throw new Error("La variable de entorno EMAIL_PASS no está configurada.");
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

export interface EmailConfirmacionParams {
  destinatario: string;
  asunto: string;
  cuerpoHtml: string;
}

/**
 * Envía un email transaccional vía Nodemailer utilizando el transporte SMTP de Gmail.
 * @param params - Destinatario, asunto y cuerpo HTML del email.
 * @returns El messageId devuelto por el servidor SMTP.
 */
export async function enviarEmailConfirmacion({
  destinatario,
  asunto,
  cuerpoHtml,
}: EmailConfirmacionParams): Promise<string> {
  const destinatarioNormalizado = destinatario.trim();

  if (!emailRegex.test(destinatarioNormalizado)) {
    throw new Error("El email del destinatario provisto no tiene un formato válido.");
  }
  if (!asunto.trim()) {
    throw new Error("El asunto del email no puede estar vacío.");
  }
  if (!cuerpoHtml.trim()) {
    throw new Error("El cuerpo del email no puede estar vacío.");
  }

  const mailTransporter = getTransporter();
  const senderUser = process.env.EMAIL_USER?.trim();

  try {
    const info = await mailTransporter.sendMail({
      from: `"Valora Wallet" <${senderUser}>`,
      to: destinatarioNormalizado,
      subject: asunto,
      html: cuerpoHtml,
    });

    const messageId = info.messageId || "sent";

    if (process.env.NODE_ENV !== "production") {
      console.log("Email de confirmación enviado", {
        destinatario: redactEmail(destinatarioNormalizado),
        messageId,
      });
    }

    return messageId;
  } catch (error) {
    console.error("Fallo al enviar email de confirmación vía Nodemailer", {
      destinatario: redactEmail(destinatarioNormalizado),
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    });
    throw error;
  }
}
