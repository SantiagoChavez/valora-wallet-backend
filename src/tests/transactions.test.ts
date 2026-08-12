import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../app.js";
import { query } from "../database/db.js";
import { findBalanceByWalletAndCurrency } from "../models/balanceModel.js";

describe("Pruebas de integración de transacciones", () => {
  const testUser = {
    email: "transaction_test_santiago@valora.com",
    password: "PasswordSegura123!",
    firstName: "Santiago",
    lastName: "Chavez",
    dateOfBirth: "15/05/1995",
    phone: "+5491123456789",
    country: "AR",
    du: "33333333",
  };

  const testRecipient = {
    email: "recipient_test_santiago@valora.com",
    password: "PasswordSegura123!",
    firstName: "Maria",
    lastName: "Perez",
    dateOfBirth: "20/08/1990",
    phone: "+5491123456799",
    country: "AR",
    du: "55555555",
  };

  const originalFetch = global.fetch;
  let authToken: string;
  let walletId: string;
  let recipientWalletId: string;

  beforeAll(async () => {
    await query("DELETE FROM users WHERE email = $1 OR email = $2", [testUser.email, testRecipient.email]);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        amount: 1,
        base: "USD",
        date: "2024-01-01",
        rates: { EUR: 1.1, ARS: 1000 },
      }),
    }) as typeof fetch;

    const registerResponse = await request(app)
      .post("/auth/register")
      .send(testUser);

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.success).toBe(true);

    authToken = registerResponse.body.data.token;
    walletId = registerResponse.body.data.wallet.id;

    const recipientResponse = await request(app)
      .post("/auth/register")
      .send(testRecipient);
    
    expect(recipientResponse.status).toBe(201);
    expect(recipientResponse.body.success).toBe(true);
    
    recipientWalletId = recipientResponse.body.data.wallet.id;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await query("DELETE FROM users WHERE email = $1 OR email = $2", [testUser.email, testRecipient.email]);
  });

  it("debería registrar un depósito exitoso y actualizar el saldo del usuario", async () => {
    const response = await request(app)
      .post("/transactions/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ currency: "USD", amount: 100 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      transactionType: "DEPOSIT",
      walletId,
      resultingBalance: 100,
    });

    const balance = await findBalanceByWalletAndCurrency(walletId, "USD");
    expect(balance).not.toBeNull();
    expect(parseFloat(balance!.amount)).toBe(100);
  });

  it("debería rechazar un depósito con un monto inválido", async () => {
    const response = await request(app)
      .post("/transactions/deposit")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ currency: "USD", amount: 0 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "VALIDATION_ERROR",
      message: "El monto debe ser un número mayor a cero.",
    });
  });

  it("debería ejecutar un intercambio exitoso y actualizar ambos saldos", async () => {
    const response = await request(app)
      .post("/transactions/exchange")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ fromCurrency: "USD", toCurrency: "EUR", amount: 50 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      transactionType: "EXCHANGE",
      walletId,
      sourceCurrency: "USD",
      targetCurrency: "EUR",
    });

    const usdBalance = await findBalanceByWalletAndCurrency(walletId, "USD");
    const eurBalance = await findBalanceByWalletAndCurrency(walletId, "EUR");

    expect(usdBalance).not.toBeNull();
    expect(eurBalance).not.toBeNull();
    expect(parseFloat(usdBalance!.amount)).toBe(50);
    expect(parseFloat(eurBalance!.amount)).toBe(55);
  });

  it("debería rechazar un intercambio si el usuario no tiene fondos suficientes (Camino Infeliz)", async () => {
    // El usuario intenta intercambiar 100 USD, pero solo le quedan 50 USD de las pruebas anteriores
    const response = await request(app)
      .post("/transactions/exchange")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ fromCurrency: "USD", toCurrency: "ARS", amount: 100 });

    // Esperamos un error HTTP 400 manejado por el errorHandler centralizado
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: "INSUFFICIENT_FUNDS",
      message: "Saldo insuficiente para realizar la operación."
    });
  });

  describe("POST /transactions/quote", () => {
    it("debería retornar una cotización válida (Caso Feliz)", async () => {
      const response = await request(app)
        .post("/transactions/quote")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ fromCurrency: "USD", toCurrency: "ARS", amount: 100 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("exchangeRate");
      expect(response.body.data).toHaveProperty("targetAmount");
      // Según el mock definido en el beforeAll: ARS = 1000, USD = base (1)
      expect(response.body.data.exchangeRate).toBe(1000);
      expect(response.body.data.targetAmount).toBe(100000);
    });

    it("debería rechazar una cotización con una moneda no soportada (Caso Inválido)", async () => {
      const response = await request(app)
        .post("/transactions/quote")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ fromCurrency: "USD", toCurrency: "BRL", amount: 100 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: "UNSUPPORTED_CURRENCY",
        message: "Moneda no soportada para cotización."
      });
    });
  });

  describe("GET /transactions", () => {
    it("debería retornar la lista de transacciones del usuario autenticado", async () => {
      const response = await request(app)
        .get("/transactions")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.data[0]).toHaveProperty("transactionType");
      expect(response.body.data[0]).toHaveProperty("walletId", walletId);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        totalCount: expect.any(Number),
        totalPages: expect.any(Number)
      });
    });

    it("debería aplicar paginación correctamente mediante query params", async () => {
      const response = await request(app)
        .get("/transactions?limit=1&page=1")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 1,
        totalCount: 2,
        totalPages: 2
      });
    });

    it("debería rechazar la consulta si no se proporciona el token de autenticación", async () => {
      const response = await request(app)
        .get("/transactions");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: "UnauthorizedError",
        message: "Acceso no autorizado. Token no proporcionado."
      });
    });
  });

  describe("Transferencias P2P", () => {
    it("debería resolver correctamente un destinatario por email", async () => {
      const response = await request(app)
        .post("/transactions/transfer/resolve")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ identifier: testRecipient.email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        firstName: testRecipient.firstName,
        lastName: testRecipient.lastName,
        // El endpoint ahora enmascara el email (ej. re***@valora.com)
        email: "re***@valora.com",
      });
    });

    it("debería rechazar resolver un destinatario inexistente", async () => {
      const response = await request(app)
        .post("/transactions/transfer/resolve")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ identifier: "noexiste@valora.com" });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("USER_NOT_FOUND");
    });

    it("debería rechazar una auto-transferencia", async () => {
      const response = await request(app)
        .post("/transactions/transfer")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ currency: "USD", amount: 10, destination: testUser.email });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("SELF_TRANSFER");
    });

    it("debería rechazar una transferencia por saldo insuficiente", async () => {
      const response = await request(app)
        .post("/transactions/transfer")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ currency: "USD", amount: 999999, destination: testRecipient.email });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe("INSUFFICIENT_FUNDS");
    });

    it("debería ejecutar una transferencia exitosa", async () => {
      const senderBalanceBefore = await findBalanceByWalletAndCurrency(walletId, "USD");
      const recipientBalanceBefore = await findBalanceByWalletAndCurrency(recipientWalletId, "USD");

      const initialSenderBalance = senderBalanceBefore ? parseFloat(senderBalanceBefore.amount) : 0;
      const initialRecipientBalance = recipientBalanceBefore ? parseFloat(recipientBalanceBefore.amount) : 0;

      // Necesitamos depositar primero para asegurar que haya fondos (USD)
      await request(app)
        .post("/transactions/deposit")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ currency: "USD", amount: 50 });

      const response = await request(app)
        .post("/transactions/transfer")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ currency: "USD", amount: 20, destination: testRecipient.email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        transactionType: "TRANSFER_OUT",
        walletId,
        sourceCurrency: "USD",
        targetCurrency: "USD",
        counterpartyEmail: testRecipient.email
      });

      // Validar que los saldos se actualizaron
      const senderBalance = await findBalanceByWalletAndCurrency(walletId, "USD");
      const recipientBalance = await findBalanceByWalletAndCurrency(recipientWalletId, "USD");

      expect(parseFloat(senderBalance!.amount)).toBe(initialSenderBalance + 30);
      expect(parseFloat(recipientBalance!.amount)).toBe(initialRecipientBalance + 20);
    });
  });
});
