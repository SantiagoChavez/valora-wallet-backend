import request from "supertest";
import { describe, expect, it, vi, beforeAll, afterAll, afterEach } from "vitest";
import { query } from "../database/db.js";

// Pilar 4: Importamos los módulos de forma limpia. 
// Vitest automáticamente inyectará los mocks sobre estos imports gracias a las llamadas de abajo.
import { getFinancialAdvice } from "../services/geminiService.js";
import { deleteChatHistoryByUserId } from "../models/chatbotModel.js";

// Mockeamos el servicio de Gemini para evitar llamadas reales a la API
vi.mock("../services/geminiService.js", () => {
    return {
        getFinancialAdvice: vi.fn().mockResolvedValue("Mocked AI response")
    };
});

// Mockeamos el modelo de chatbot para aislar la persistencia del historial
vi.mock("../models/chatbotModel.js", () => {
    return {
        getChatHistoryByUserId: vi.fn().mockResolvedValue([]),
        saveChatMessage: vi.fn().mockResolvedValue({}),
        deleteChatHistoryByUserId: vi.fn().mockResolvedValue(undefined)
    };
});

describe("Pruebas de integración del Chatbot", () => {
    let app: typeof import("../app.js").app;
    let token = "";
    
    const testUser = {
        email: "chatbot_test@valora.com",
        password: "PasswordSegura123!",
        firstName: "Chatbot",
        lastName: "Test",
        dateOfBirth: "01/01/1990",
        phone: "+54 9 11 1111-2222",
        country: "AR",
        du: "55555555",
    };

    beforeAll(async () => {
        const appModule = await import("../app.js");
        app = appModule.app;

        // Limpieza precautoria
        await query("DELETE FROM users WHERE email = $1", [testUser.email]);

        const res = await request(app).post("/auth/register").send(testUser);
        token = res.body.data.token;
    });

    afterAll(async () => {
        // Pilar 2 y 4: Limpieza Defensiva Total (Previene Fallos por Foreign Keys Futuras).
        // Si el schema no tiene CASCADE, esto borrará limpiamente los dependientes primero.
        const userRes = await query("SELECT id FROM users WHERE email = $1", [testUser.email]);
        if (userRes.rows.length > 0) {
            const userId = userRes.rows[0].id;
            await query("DELETE FROM balances WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = $1)", [userId]);
            await query("DELETE FROM transactions WHERE wallet_id IN (SELECT id FROM wallets WHERE user_id = $1)", [userId]);
            await query("DELETE FROM chatbot_histories WHERE user_id = $1", [userId]);
            await query("DELETE FROM wallets WHERE user_id = $1", [userId]);
            await query("DELETE FROM users WHERE id = $1", [userId]);
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("POST /chatbot/message", () => {
        it("debería retornar 401 si no se envía el header de Authorization", async () => {
            const response = await request(app)
                .post("/chatbot/message")
                .send({ message: "Hola" });

            expect(response.status).toBe(401);
            expect(response.body).toEqual({
                success: false,
                error: "UnauthorizedError",
                message: "Acceso no autorizado. Token no proporcionado.",
            });
        });

        it("debería retornar 400 si falta el campo 'message' en el body", async () => {
            const response = await request(app)
                .post("/chatbot/message")
                .set("Authorization", `Bearer ${token}`)
                .send({});

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                success: false,
                error: "VALIDATION_ERROR",
                message: expect.any(String),
                issues: expect.any(Array),
            });
        });

        it("debería retornar 200 y la respuesta de la IA al enviar un mensaje válido", async () => {
            const message = "¿Cuánto saldo tengo?";
            const response = await request(app)
                .post("/chatbot/message")
                .set("Authorization", `Bearer ${token}`)
                .send({ message });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.reply).toBe("Mocked AI response");
            
            // Pilar 4: Uso seguro y fuertemente tipado de vi.mocked (sin 'as unknown as Mock')
            expect(vi.mocked(getFinancialAdvice)).toHaveBeenCalledTimes(1);
            expect(vi.mocked(getFinancialAdvice)).toHaveBeenCalledWith(
                expect.any(String), 
                message, 
                expect.objectContaining({ 
                    USD: expect.any(Number),
                    EUR: expect.any(Number),
                    ARS: expect.any(Number)
                }),
                expect.any(Object), 
                expect.any(Object) 
            );
        });
    });

    describe("POST /chatbot/reset", () => {
        it("debería limpiar el historial correctamente", async () => {
            const response = await request(app)
                .post("/chatbot/reset")
                .set("Authorization", `Bearer ${token}`)
                .send();

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe("Historial de chat borrado exitosamente.");
            
            expect(vi.mocked(deleteChatHistoryByUserId)).toHaveBeenCalledTimes(1);
        });
    });
});
