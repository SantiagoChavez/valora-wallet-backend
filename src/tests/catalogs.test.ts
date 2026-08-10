import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app";
import { query } from "../database/db";

describe("GET /catalogs/document-types", () => {
  it("devuelve el mapa completo de documentos por país", async () => {
    const response = await request(app).get("/catalogs/document-types");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Object.keys(response.body.data)).toHaveLength(19);
    expect(response.body.data.AR).toBe("DNI");
    expect(response.body.data.BR).toBe("CPF");
    expect(response.body.data.UY).toBe("CI");
  });
});

describe("POST /auth/register con validación genérica de documento", () => {
  const emails: string[] = [];

  afterAll(async () => {
    for (const email of emails) {
      await query("DELETE FROM users WHERE email = $1", [email]);
    }
  });

  it("permite registrar con un país fuera del set original (Brasil), antes no soportado", async () => {
    const email = `doc_test_br_${Date.now()}@valora.com`;
    emails.push(email);

    const response = await request(app).post("/auth/register").send({
      email,
      password: "PasswordSegura123!",
      firstName: "Joao",
      lastName: "Silva",
      dateOfBirth: "15/05/1995",
      phone: "+54 9 351 123-4567",
      country: "BR",
      du: "A1B2C3D4E5",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.country).toBe("BR");
    expect(response.body.data.user.du).toBe("A1B2C3D4E5");
  });

  it("rechaza un documento demasiado corto con el mensaje genérico (no el viejo formato específico por país)", async () => {
    const email = `doc_test_short_${Date.now()}@valora.com`;
    emails.push(email);

    const response = await request(app).post("/auth/register").send({
      email,
      password: "PasswordSegura123!",
      firstName: "Test",
      lastName: "Corto",
      dateOfBirth: "15/05/1995",
      phone: "+54 9 351 123-4567",
      country: "AR",
      du: "123",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("El DNI debe tener entre 5 y 15 caracteres alfanuméricos.");
  });

  it("rechaza un país que no está entre los 19 de LATAM", async () => {
    const response = await request(app).post("/auth/register").send({
      email: `doc_test_invalid_country_${Date.now()}@valora.com`,
      password: "PasswordSegura123!",
      firstName: "Test",
      lastName: "Invalido",
      dateOfBirth: "15/05/1995",
      phone: "+54 9 351 123-4567",
      country: "US",
      du: "12345678",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
  });
});
