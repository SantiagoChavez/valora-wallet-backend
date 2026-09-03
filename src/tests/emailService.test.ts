import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(function (this: any) {
      this.emails = {
        send: sendMock,
      };
    }),
  };
});

const REQUIRED_ENV_VARS = {
  RESEND_API_KEY: "re_test_key_12345",
} as const;
const TRACKED_ENV_VARS = Object.keys(REQUIRED_ENV_VARS);

describe("emailService", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();

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
    sendMock.mockResolvedValueOnce({ data: { id: "resend-msg-12345" }, error: null });
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    const messageId = await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(messageId).toBe("resend-msg-12345");
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      from: "Valora Wallet <onboarding@resend.dev>",
      to: ["usuario@mail.com"],
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
    expect(sendMock).not.toHaveBeenCalled();
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
    expect(sendMock).not.toHaveBeenCalled();
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
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("propaga el error cuando Resend responde con un error de API", async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: "API key inválida" } });
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("API key inválida");
  });

  it("devuelve 'sent' como fallback si Resend no retorna id de mensaje", async () => {
    sendMock.mockResolvedValueOnce({ data: {}, error: null });
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    const messageId = await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(messageId).toBe("sent");
  });

  it("rechaza si falta la variable de entorno RESEND_API_KEY", async () => {
    delete process.env.RESEND_API_KEY;
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("RESEND_API_KEY");
  });
});
