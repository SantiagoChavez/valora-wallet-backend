import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { query } from "../database/db.js";

const { enviarEmailConfirmacionMock } = vi.hoisted(() => ({
  enviarEmailConfirmacionMock: vi.fn(),
}));

vi.mock("../services/emailService.js", () => ({
  enviarEmailConfirmacion: enviarEmailConfirmacionMock,
}));

describe("Toggle de notificaciones por email", () => {
  let app: typeof import("../app.js").app;

  const testUser = {
    email: "email_notifications_test@valora.com",
    password: "PasswordSegura123!",
    firstName: "Notif",
    lastName: "Test",
    dateOfBirth: "01/01/1990",
    phone: "+5491123456700",
    country: "AR",
    du: "77777777",
  };

  let authToken: string;

  beforeAll(async () => {
    const appModule = await import("../app.js");
    app = appModule.app;

    await query("DELETE FROM users WHERE email = $1", [testUser.email]);

    enviarEmailConfirmacionMock.mockResolvedValue("mock-message-id");

    const registerResponse = await request(app).post("/auth/register").send(testUser);
    expect(registerResponse.status).toBe(201);
    authToken = registerResponse.body.data.token;
  });

  afterEach(() => {
    enviarEmailConfirmacionMock.mockClear();
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);
  });

  describe("PATCH /auth/me/notifications", () => {
    it("debería rechazar la petición sin token", async () => {
      const response = await request(app)
        .patch("/auth/me/notifications")
        .send({ enabled: false });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("debería rechazar un body sin el campo enabled o con un tipo inválido", async () => {
      const response = await request(app)
        .patch("/auth/me/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ enabled: "si" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    it("debería desactivar las notificaciones y reflejarlo en la respuesta", async () => {
      const response = await request(app)
        .patch("/auth/me/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ enabled: false });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.emailNotificationsEnabled).toBe(false);
    });

    it("debería reactivar las notificaciones", async () => {
      const response = await request(app)
        .patch("/auth/me/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ enabled: true });

      expect(response.status).toBe(200);
      expect(response.body.data.user.emailNotificationsEnabled).toBe(true);
    });
  });

  describe("Efecto real del toggle sobre el envío de emails", () => {
    it("NO debería llamar al servicio de email al confirmar un depósito si las notificaciones están desactivadas", async () => {
      await request(app)
        .patch("/auth/me/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ enabled: false });
      enviarEmailConfirmacionMock.mockClear();

      const response = await request(app)
        .post("/transactions/deposit")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ currency: "USD", amount: 10 });

      expect(response.status).toBe(200);

      // notifyUserAsync es fire-and-forget: se dispara después de responder el request.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(enviarEmailConfirmacionMock).not.toHaveBeenCalled();
    });

    it("SÍ debería llamar al servicio de email al confirmar un depósito si las notificaciones están activadas", async () => {
      await request(app)
        .patch("/auth/me/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ enabled: true });
      enviarEmailConfirmacionMock.mockClear();

      const response = await request(app)
        .post("/transactions/deposit")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ currency: "USD", amount: 10 });

      expect(response.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(enviarEmailConfirmacionMock).toHaveBeenCalledTimes(1);
    });
  });
});
