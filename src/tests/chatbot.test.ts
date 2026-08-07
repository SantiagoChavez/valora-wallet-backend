import request from "supertest";
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { app } from "../app.js";
import { query } from "../database/db.js";

// Mockeamos el servicio de Gemini para evitar llamadas reales a la API durante los tests
vi.mock("../services/geminiService.js", () => {
    return {
        getFinancialAdvice: vi.fn().mockResolvedValue("Mocked AI response")
    };
});

describe("Pruebas de integración del Chatbot", () => {
    let token = "";
    const testUser = {
        email: "chatbot_test@valora.com",
        password: "PasswordSegura123!",
        firstName: "Chatbot",
        lastName: "Test",
        dateOfBirth: "01/01/1990",
        phone: "+54 9 351 111-2222",
    };

    beforeAll(async () => {
        // Limpiar usuario previo si existe para asegurar un entorno limpio
        await query("DELETE FROM users WHERE email = $1", [testUser.email]);
        
        // Registrar usuario y obtener token
        const res = await request(app).post("/auth/register").send(testUser);
        token = res.body.token;
    });

    afterAll(async () => {
        // Limpiar usuario creado durante las pruebas
        await query("DELETE FROM users WHERE email = $1", [testUser.email]);
    });

    describe("POST /chatbot/message", () => {
        it("debería retornar 401 si no se envía el header de Authorization", async () => {
            const response = await request(app)
                .post("/chatbot/message")
                .send({ message: "Hola" });
            
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        it("debería retornar 400 si falta el campo 'message' en el body", async () => {
            const response = await request(app)
                .post("/chatbot/message")
                .set("Authorization", `Bearer ${token}`)
                .send({});
            
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe("VALIDATION_ERROR");
        });

        it("debería retornar 200 y la respuesta de la IA al enviar un mensaje válido", async () => {
            const response = await request(app)
                .post("/chatbot/message")
                .set("Authorization", `Bearer ${token}`)
                .send({ message: "¿Cuánto saldo tengo?" });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.reply).toBe("Mocked AI response");
        });
    });
});
