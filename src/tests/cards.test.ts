import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { query } from "../database/db.js";

describe("Pruebas del Módulo de Tarjetas (Cards)", () => {
  let token: string;
  let createdCardId: string;

  const testUser = {
    email: "cards_tester_unique@valora.com",
    password: "PasswordSegura123!",
    firstName: "Franco",
    lastName: "Armani",
    dateOfBirth: "16/10/1986",
    phone: "+54 9 11 7788-9900",
    country: "AR",
    du: "39876512",
  };

  beforeAll(async () => {
    await query("DELETE FROM users WHERE email = $1 OR phone = $2", [testUser.email, testUser.phone]);
    const res = await request(app).post("/auth/register").send(testUser);
    if (!res.body.data?.token) {
      console.error("REGISTER ERROR:", res.status, res.body);
    }
    token = res.body.data.token;
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email = $1", [testUser.email]);
  });

  it("GET /cards - Debería listar las tarjetas del usuario autenticado", async () => {
    const res = await request(app)
      .get("/cards")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.cards)).toBe(true);
  });

  it("POST /cards - Debería crear una nueva tarjeta virtual correctamente", async () => {
    const res = await request(app)
      .post("/cards")
      .set("Authorization", `Bearer ${token}`)
      .send({
        label: "Tarjeta Suscripciones",
        brand: "VALORA BLACK",
        cardType: "VIRTUAL",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.card).toBeDefined();
    expect(res.body.data.card.label).toBe("Tarjeta Suscripciones");
    expect(res.body.data.card.brand).toBe("VALORA BLACK");
    expect(res.body.data.card.cardType).toBe("VIRTUAL");
    expect(res.body.data.card.holderName).toBe("FRANCO ARMANI");
    expect(res.body.data.card.isFrozen).toBe(false);

    createdCardId = res.body.data.card.id;
  });

  it("GET /cards/:id/details - Debería devolver los datos completos desocultos para el titular", async () => {
    const res = await request(app)
      .get(`/cards/${createdCardId}/details`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.card.id).toBe(createdCardId);
    expect(res.body.data.card.cardNumber).not.toContain("••••");
    expect(res.body.data.card.cvv).not.toBe("•••");
  });

  it("PATCH /cards/:id/freeze - Debería congelar la tarjeta", async () => {
    const res = await request(app)
      .patch(`/cards/${createdCardId}/freeze`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.card.isFrozen).toBe(true);
  });

  it("PATCH /cards/:id/freeze - Debería reactivar (descongelar) la tarjeta", async () => {
    const res = await request(app)
      .patch(`/cards/${createdCardId}/freeze`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.card.isFrozen).toBe(false);
  });

  it("POST /cards - Debería rechazar marcas no válidas con error de validación", async () => {
    const res = await request(app)
      .post("/cards")
      .set("Authorization", `Bearer ${token}`)
      .send({
        label: "Inválida",
        brand: "MARCA_INEXISTENTE",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("DELETE /cards/:id - Debería eliminar la tarjeta correctamente", async () => {
    const res = await request(app)
      .delete(`/cards/${createdCardId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app)
      .get(`/cards/${createdCardId}/details`)
      .set("Authorization", `Bearer ${token}`);

    expect(checkRes.status).toBe(404);
  });
});
