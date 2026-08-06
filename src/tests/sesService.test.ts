import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESClient } from "@aws-sdk/client-ses";

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
    vi.mocked(SESClient).mockClear();

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
    expect(sendMock).toHaveBeenCalledWith({
      Source: "remitente@mail.com",
      Destination: { ToAddresses: ["usuario@mail.com"] },
      Message: {
        Subject: { Data: "Confirmación", Charset: "UTF-8" },
        Body: { Html: { Data: "<p>Listo</p>", Charset: "UTF-8" } },
      },
    });
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

  it("rechaza si el cuerpo del email está vacío", async () => {
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "   ",
      }),
    ).rejects.toThrow("cuerpo");
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

  it("rechaza si SES responde sin MessageId", async () => {
    sendMock.mockResolvedValueOnce({});
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("MessageId");
  });

  it("pasa credenciales explícitas al cliente SES cuando están seteadas por env vars", async () => {
    sendMock.mockResolvedValueOnce({ MessageId: "abc-123" });
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(SESClient).toHaveBeenCalledWith({
      region: "us-east-1",
      credentials: {
        accessKeyId: "test-access-key-id",
        secretAccessKey: "test-secret-access-key",
      },
    });
  });

  it("deja que el SDK resuelva credenciales por su cuenta si no hay access key/secret en env", async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    sendMock.mockResolvedValueOnce({ MessageId: "abc-123" });
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(SESClient).toHaveBeenCalledWith({ region: "us-east-1" });
  });

  it("rechaza si solo una de las dos credenciales AWS está seteada", async () => {
    delete process.env.AWS_SECRET_ACCESS_KEY;
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("incluye el session token en las credenciales cuando está seteado junto con access key/secret", async () => {
    process.env.AWS_SESSION_TOKEN = "test-session-token";
    sendMock.mockResolvedValueOnce({ MessageId: "abc-123" });
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(SESClient).toHaveBeenCalledWith({
      region: "us-east-1",
      credentials: {
        accessKeyId: "test-access-key-id",
        secretAccessKey: "test-secret-access-key",
        sessionToken: "test-session-token",
      },
    });

    delete process.env.AWS_SESSION_TOKEN;
  });

  it("rechaza si AWS_SESSION_TOKEN está seteado sin access key/secret", async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    process.env.AWS_SESSION_TOKEN = "test-session-token";
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("AWS_SESSION_TOKEN");
    expect(sendMock).not.toHaveBeenCalled();

    delete process.env.AWS_SESSION_TOKEN;
  });

  it("rechaza si falta la variable de entorno AWS_SES_REGION", async () => {
    delete process.env.AWS_SES_REGION;
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("AWS_SES_REGION");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rechaza si falta la variable de entorno AWS_SES_SENDER_EMAIL", async () => {
    delete process.env.AWS_SES_SENDER_EMAIL;
    const { enviarEmailConfirmacion } = await import("../services/sesService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("AWS_SES_SENDER_EMAIL");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
