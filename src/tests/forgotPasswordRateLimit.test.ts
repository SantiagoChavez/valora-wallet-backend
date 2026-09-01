import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../app";

// Archivo separado a propósito: agota el rate limit del endpoint, así que no puede
// compartir ejecución con los tests funcionales de passwordReset.test.ts sin interferir.
vi.mock("../services/emailService.js", () => ({
  enviarEmailConfirmacion: vi.fn().mockResolvedValue("mock-message-id"),
}));

describe("Rate limiting de POST /auth/forgot-password", () => {
  it("bloquea con 429 después de superar el máximo de intentos por IP", async () => {
    const email = "rate.limit.test@valora.com";

    let lastResponse;
    for (let i = 0; i < 11; i++) {
      lastResponse = await request(app).post("/auth/forgot-password").send({ email });
    }

    expect(lastResponse!.status).toBe(429);
    expect(lastResponse!.body).toEqual({
      success: false,
      error: "TooManyRequestsError",
      message: "Demasiados intentos. Probá de nuevo más tarde.",
    });
  });
});
