import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED_ENV_VARS = {
  BREVO_API_KEY: "xkeysib-test-api-key-12345",
  BREVO_SENDER_EMAIL: "chavezsantiago480@gmail.com",
  BREVO_SENDER_NAME: "Valora Wallet",
} as const;
const TRACKED_ENV_VARS = Object.keys(REQUIRED_ENV_VARS);

describe("emailService", () => {
  const originalEnv: Record<string, string | undefined> = {};
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const key of TRACKED_ENV_VARS) {
      originalEnv[key] = process.env[key];
    }
    for (const [key, value] of Object.entries(REQUIRED_ENV_VARS)) {
      process.env[key] = value;
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of TRACKED_ENV_VARS) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  it("envía el email y devuelve el messageId cuando los datos son válidos", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ messageId: "<20260904-msg-123@smtp-relay.mailin.fr>" }),
    });

    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    const messageId = await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación de transferencia",
      cuerpoHtml: "<p>Tu transferencia fue exitosa</p>",
    });

    expect(messageId).toBe("<20260904-msg-123@smtp-relay.mailin.fr>");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": "xkeysib-test-api-key-12345",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: "Valora Wallet", email: "chavezsantiago480@gmail.com" },
          to: [{ email: "usuario@mail.com" }],
          subject: "Confirmación de transferencia",
          htmlContent: "<p>Tu transferencia fue exitosa</p>",
        }),
      }),
    );
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
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propaga el error cuando Brevo responde con un error de API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "Sender email is not authorized" }),
    });

    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("Sender email is not authorized");
  });

  it("devuelve 'sent' como fallback si Brevo no retorna id de mensaje", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
    });

    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    const messageId = await enviarEmailConfirmacion({
      destinatario: "usuario@mail.com",
      asunto: "Confirmación",
      cuerpoHtml: "<p>Listo</p>",
    });

    expect(messageId).toBe("sent");
  });

  it("rechaza si falta la variable de entorno BREVO_API_KEY", async () => {
    delete process.env.BREVO_API_KEY;
    const { enviarEmailConfirmacion } = await import("../services/emailService.js");

    await expect(
      enviarEmailConfirmacion({
        destinatario: "usuario@mail.com",
        asunto: "Confirmación",
        cuerpoHtml: "<p>Listo</p>",
      }),
    ).rejects.toThrow("BREVO_API_KEY");
  });
});
