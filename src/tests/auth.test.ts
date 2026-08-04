import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { query } from "../database/db";
import { findWalletByUserId } from "../models/walletModel";
import { findBalanceByWalletAndCurrency } from "../models/balanceModel";

describe("Pruebas de integración del sistema de Autenticación", () => {
  const testUser = {
    email: "auth_test_santiago@valora.com",
    password: "PasswordSegura123!",
    firstName: "Santiago",
    lastName: "Chavez",
  };

  // Limpieza previa a la ejecución de pruebas
  beforeAll(async () => {
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);
  });

  // Limpieza posterior
  afterAll(async () => {
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);
  });

  describe("POST /auth/register", () => {
    it("debería registrar un nuevo usuario exitosamente con wallet y saldo inicial", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("walletId");
      expect(response.body.user).toEqual({
        id: expect.any(String),
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      });

      const { walletId, user } = response.body;

      // Verificar en la base de datos que se haya creado la wallet
      const dbWallet = await findWalletByUserId(user.id);
      expect(dbWallet).not.toBeNull();
      expect(dbWallet!.id).toBe(walletId);

      // Verificar en la base de datos que el saldo inicial de USD sea 0
      const dbBalance = await findBalanceByWalletAndCurrency(walletId, "USD");
      expect(dbBalance).not.toBeNull();
      expect(parseFloat(dbBalance!.amount)).toBe(0);
    });

    it("debería fallar al intentar registrar un usuario con un email duplicado", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send(testUser);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: "DuplicateEmailError",
        message: "El correo electrónico ya se encuentra registrado",
      });
    });

    it("debería fallar al registrar si faltan campos requeridos", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "otro_usuario@valora.com",
          password: "password",
          // faltan firstName y lastName
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: "VALIDATION_ERROR",
        message: "El nombre es requerido.",
        issues: [
          "El nombre es requerido.",
          "El apellido es requerido.",
        ],
      });
    });

    it("debería fallar al registrar si el formato de email es inválido", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          email: "usuario-sin-arroba",
          password: testUser.password,
          firstName: testUser.firstName,
          lastName: testUser.lastName,
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: "VALIDATION_ERROR",
        message: "El correo electrónico provisto no tiene un formato válido.",
        issues: [
          "El correo electrónico provisto no tiene un formato válido.",
        ],
      });
    });
  });

  describe("POST /auth/login", () => {
    it("debería iniciar sesión correctamente con credenciales válidas", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("walletId");
      expect(response.body.user).toEqual({
        id: expect.any(String),
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      });
    });

    it("debería rechazar el inicio de sesión con una contraseña incorrecta", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: "ClaveIncorrecta123",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: "UnauthorizedError",
        message: "Credenciales incorrectas.",
      });
    });

    it("debería rechazar el inicio de sesión para un correo electrónico inexistente", async () => {
      const response = await request(app)
        .post("/auth/login")
        .send({
          email: "inexistente@valora.com",
          password: "PasswordSegura123!",
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: "UnauthorizedError",
        message: "Credenciales incorrectas.",
      });
    });
  });

  describe("GET /auth/me", () => {
    let validToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        });
      validToken = loginResponse.body.token;
    });

    it("debería retornar el perfil del usuario autenticado con un token válido", async () => {
      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("walletId");
      expect(response.body).toHaveProperty("balances");
      expect(Array.isArray(response.body.balances)).toBe(true);
      expect(response.body.user).toEqual({
        id: expect.any(String),
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      });
    });

    it("debería rechazar la petición con 401 si no se proporciona el token", async () => {
      const response = await request(app).get("/auth/me");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: "UnauthorizedError",
        message: "Acceso no autorizado. Token no proporcionado.",
      });
    });

    it("debería rechazar la petición con 401 si el token no tiene el formato Bearer", async () => {
      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", `Basic ${validToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: "UnauthorizedError",
        message: "Formato de token inválido. Debe ser 'Bearer <token>'.",
      });
    });

    it("debería rechazar la petición con 401 si el token es inválido o modificado", async () => {
      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer token_invalido_12345`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: "UnauthorizedError",
        message: "Token inválido o expirado.",
      });
    });
  });
});