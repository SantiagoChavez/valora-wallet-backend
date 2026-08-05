import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { query } from "../database/db";
import { findBalanceByWalletAndCurrency } from "../models/balanceModel";

describe("Pruebas de integración de transacciones", () => {
  const testUser = {
    email: "transaction_test_santiago@valora.com",
    password: "PasswordSegura123!",
    firstName: "Santiago",
    lastName: "Chavez",
  };

  const originalFetch = global.fetch;
  let authToken: string;
  let walletId: string;

  beforeAll(async () => {
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);

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

    authToken = registerResponse.body.token;
    walletId = registerResponse.body.walletId;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);
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
});

describe("Transaction Integration Tests", () => {
  const testUser = {
    email: "transaction_test_santiago@valora.com",
    password: "PasswordSegura123!",
    firstName: "Santiago",
    lastName: "Chavez",
  };

  const originalFetch = global.fetch;
  let authToken: string;
  let walletId: string;

  beforeAll(async () => {
    // Clean up database before running tests
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);

    // Mock fetch to simulate external exchange API without using network
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        amount: 1,
        base: "USD",
        date: "2024-01-01",
        rates: { EUR: 1.1, ARS: 1000 },
      }),
    }) as typeof fetch;

    // Register user to obtain auth token and wallet ID
    const registerResponse = await request(app)
      .post("/auth/register")
      .send(testUser);

    authToken = registerResponse.body.token;
    walletId = registerResponse.body.walletId;
  });

  afterAll(async () => {
    // Restore fetch and clean up database
    global.fetch = originalFetch;
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);
  });

  it("should register a successful deposit and update user balance", async () => {
    // User deposits 100 USD
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

  it("should execute a successful exchange and update both balances", async () => {
    // User exchanges 50 USD to EUR. Leaving them with 50 USD remaining.
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

  it("should reject an exchange if the user has insufficient funds (Unhappy Path)", async () => {
    // User attempts to exchange 100 USD, but only has 50 USD remaining from previous tests
    const response = await request(app)
      .post("/transactions/exchange")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ fromCurrency: "USD", toCurrency: "ARS", amount: 100 });

    // Expecting HTTP 500 handled by central errorHandler with Spanish message
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: "InternalServerError",
      message: "Saldo insuficiente para realizar la operación."
    });
  });
});