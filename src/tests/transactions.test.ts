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
    dateOfBirth: "15/05/1995",
    phone: "+54 9 351 123-4567",
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
