import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-ses", () => ({
  SESClient: vi.fn().mockImplementation(function () {
    return { send: sendMock };
  }),
  SendEmailCommand: vi.fn().mockImplementation(function (input) {
    return input;
  }),
}));

const REQUIRED_ENV_VARS = {
  AWS_SES_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "test-access-key-id",
  AWS_SECRET_ACCESS_KEY: "test-secret-access-key",
  AWS_SES_SENDER_EMAIL: "remitente@mail.com",
} as const;

describe("sesService", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();

    for (const [key, value] of Object.entries(REQUIRED_ENV_VARS)) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }
  });

  afterEach(() => {
    for (const key of Object.keys(REQUIRED_ENV_VARS)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("envía el email y devuelve el messageId cuando los datos son válidos", async () => {
    sendMock.mockResolvedValueOnce({ MessageId: "abc-123" });
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    const messageId = await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(messageId).toBe("abc-123");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("rechaza si el email del destinatario tiene formato inválido", async () => {
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

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
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "   ",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("asunto");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("propaga el error cuando SES falla al enviar", async () => {
    sendMock.mockRejectedValueOnce(new Error("SES no disponible"));
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("SES no disponible");
  });
});
