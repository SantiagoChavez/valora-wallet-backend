import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { query } from "../database/db";
import { findWalletByUserId } from "../models/walletModel";
import { findBalanceByWalletAndCurrency } from "../models/balanceModel";

vi.mock("google-auth-library", () => {
  return {
    OAuth2Client: class {
      verifyIdToken = vi.fn().mockImplementation(async ({ idToken }) => {
        if (idToken === "valid-token") {
          return {
            getPayload: () => ({ email: "google_test@valora.com", email_verified: true, given_name: "Google", family_name: "User" })
          };
        }
        if (idToken === "unverified-token") {
          return {
            getPayload: () => ({ email: "google_unverified@valora.com", email_verified: false, given_name: "Google", family_name: "User" })
          };
        }
        throw new Error("Invalid token");
      })
    }
  };
});

describe("Pruebas de integración del sistema de Autenticación", () => {
  const testUser = {
    email: "auth_test_santiago@valora.com",
    password: "PasswordSegura123!",
    firstName: "Santiago",
    lastName: "Chavez",
    dateOfBirth: "15/05/1995",
    phone: "+54 9 351 123-4567",
    country: "AR",
    du: "11111111",
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

      if (response.status !== 201) {
        console.error("Registro fallido con 400:", JSON.stringify(response.body, null, 2));
      }
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("token");
      expect(response.body.data).toHaveProperty("wallet");
      expect(response.body.data.user).toEqual({
        id: expect.any(String),
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        dateOfBirth: "15/05/1995",
        phone: "+5493511234567", // E.164 normalizado
        country: "AR",
        du: "11111111",
      });

      const { wallet, user } = response.body.data;
      const walletId = wallet.id;

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
          // faltan firstName, lastName, dateOfBirth, phone
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("VALIDATION_ERROR");
      expect(response.body.issues).toContain("El nombre es requerido.");
      expect(response.body.issues).toContain("El apellido es requerido.");
      expect(response.body.issues).toContain("La fecha de nacimiento es requerida.");
      expect(response.body.issues).toContain("El número de teléfono es requerido.");
      expect(response.body.issues).toContain("El documento único es requerido.");
    });

    it("debería fallar al registrar si el formato de email es inválido", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          ...testUser,
          email: "usuario-sin-arroba",
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

    it("debería fallar al registrar si el usuario es menor de 18 años", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          ...testUser,
          email: "menor_edad@valora.com",
          dateOfBirth: "15/05/2015", // Menor de edad
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Debes ser mayor de 18 años para registrarte.",
        issues: ["Debes ser mayor de 18 años para registrarte."],
      });
    });

    it("debería fallar al registrar si el formato de teléfono es inválido", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          ...testUser,
          email: "telefono_invalido@valora.com",
          phone: "12345", // Inválido
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: "VALIDATION_ERROR",
        message: "El número de teléfono provisto no es válido.",
        issues: ["El número de teléfono provisto no es válido."],
      });
    });

    it("debería fallar al registrar si la fecha de nacimiento tiene formato incorrecto", async () => {
      const response = await request(app)
        .post("/auth/register")
        .send({
          ...testUser,
          email: "fecha_invalida@valora.com",
          dateOfBirth: "1995-05-15", // Formato incorrecto ahora, debe ser DD/MM/YYYY!
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: "VALIDATION_ERROR",
        message: "La fecha de nacimiento debe tener el formato DD/MM/YYYY",
        issues: ["La fecha de nacimiento debe tener el formato DD/MM/YYYY"],
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
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("token");
      expect(response.body.data).toHaveProperty("wallet");
      expect(response.body.data.user).toEqual({
        id: expect.any(String),
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        dateOfBirth: "15/05/1995",
        phone: "+5493511234567",
        country: "AR",
        du: "11111111",
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
      validToken = loginResponse.body.data.token;
    });

    it("debería retornar el perfil del usuario autenticado con un token válido", async () => {
      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("wallet");
      expect(response.body.data).toHaveProperty("balances");
      expect(Array.isArray(response.body.data.balances)).toBe(true);
      expect(response.body.data.user).toEqual({
        id: expect.any(String),
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        dateOfBirth: "15/05/1995",
        phone: "+5493511234567",
        country: "AR",
        du: "11111111",
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

  describe("POST /auth/logout", () => {
    let validToken: string;

    beforeAll(async () => {
      const loginResponse = await request(app)
        .post("/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        });
      validToken = loginResponse.body.data.token;
    });

    it("debería retornar 200 OK y un mensaje de éxito si el usuario está autenticado", async () => {
      const response = await request(app)
        .post("/auth/logout")
        .set("Authorization", `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: "Sesión cerrada correctamente. Por favor, descarta el token en el cliente."
      });
    });

    it("debería rechazar el logout si no se provee un token de autenticación (401)", async () => {
      const response = await request(app).post("/auth/logout");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("UnauthorizedError");
    });
  });

  describe("POST /auth/google", () => {
    it("debería registrar y loguear un usuario con token de Google válido", async () => {
      const response = await request(app)
        .post("/auth/google")
        .send({ idToken: "valid-token" });
      if (response.status !== 200) {
        console.error("Google Login failed:", response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("token");
      expect(response.body.data.user.email).toBe("google_test@valora.com");
      expect(response.body.data.wallet).toHaveProperty("id");
      expect(response.body.data.wallet).toHaveProperty("cvu");
      expect(response.body.data.wallet).toHaveProperty("alias");
    });

    it("debería rechazar un login de Google con email no verificado", async () => {
      const response = await request(app)
        .post("/auth/google")
        .send({ idToken: "unverified-token" });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("email no verificado");
    });

    it("debería fallar si el token de Google es inválido o expirado", async () => {
      const response = await request(app)
        .post("/auth/google")
        .send({ idToken: "invalid-token" });

      expect(response.status).toBe(500); // verifyIdToken throws Error which goes to next(err) -> 500
    });
  });
});