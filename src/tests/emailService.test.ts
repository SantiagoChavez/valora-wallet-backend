import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn().mockImplementation(() => ({
    sendMail,
  }));
  return { sendMailMock: sendMail, createTransportMock: createTransport };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

const REQUIRED_ENV_VARS = {
  EMAIL_USER: "remitente@gmail.com",
  EMAIL_PASS: "abcd efgh ijkl mnop",
} as const;
const TRACKED_ENV_VARS = Object.keys(REQUIRED_ENV_VARS);

describe("emailService", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    sendMailMock.mockReset();
    createTransportMock.mockClear();

    for (const key of TRACKED_ENV_VARS) {
      originalEnv[key] = process.env[key];
    }
    for (const [key, value] of Object.entries(REQUIRED_ENV_VARS)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const key of TRACKED_ENV_VARS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("envía el email y devuelve el messageId cuando los datos son válidos", async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: "msg-12345" });
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    const messageId = await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(messageId).toBe("msg-12345");
    expect(createTransportMock).toHaveBeenCalledWith({
      service: "gmail",
      auth: {
        user: "remitente@gmail.com",
        pass: "abcd efgh ijkl mnop",
      },
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledWith({
      from: '"Valora Wallet" <remitente@gmail.com>',
      to: "usuario@mail.com",
      subject: "Confirmación",
      html: "<p>Listo</p>",
    });
  });

  it("rechaza si el email del destinatario tiene formato inválido", async () => {
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "no-es-un-email",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("formato válido");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rechaza si el asunto está vacío", async () => {
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "   ",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("asunto");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rechaza si el cuerpo del email está vacío", async () => {
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "   ",
      }),
    ).rejects.toThrow("cuerpo");
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("propaga el error cuando Nodemailer falla al enviar", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("SMTP no disponible"));
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("SMTP no disponible");
  });

  it("devuelve 'sent' como fallback si sendMail no retorna messageId", async () => {
    sendMailMock.mockResolvedValueOnce({});
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    const messageId = await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(messageId).toBe("sent");
  });

  it("rechaza si falta la variable de entorno EMAIL_USER", async () => {
    delete process.env.EMAIL_USER;
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("EMAIL_USER");
  });

  it("rechaza si EMAIL_USER tiene un formato inválido", async () => {
    process.env.EMAIL_USER = "invalido";
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("formato de email válido");
  });

  it("rechaza si falta la variable de entorno EMAIL_PASS", async () => {
    delete process.env.EMAIL_PASS;
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("EMAIL_PASS");
  });
});
