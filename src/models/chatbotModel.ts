import { pool } from "../database/db.js";

export interface ChatMessage {
    id: string;
    userId: string;
    role: "user" | "model";
    message: string;
    createdAt: Date;
}

/**
 * Obtiene el historial de chat de un usuario, limitando la carga a los últimos 50 mensajes 
 * para evitar saturación de memoria (OOM), ordenados cronológicamente (más antiguo a más nuevo).
 */
export async function getChatHistoryByUserId(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    // Usamos una CTE (WITH) para obtener los últimos N mensajes ordenados descendientemente (los más nuevos),
    // y luego los re-ordenamos ascendentemente para que la IA entienda el hilo lógico de la charla.
    const result = await pool.query(
        `WITH recent_messages AS (
            SELECT id, user_id as "userId", role, message, created_at as "createdAt"
            FROM chatbot_histories 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2
        )
        SELECT * FROM recent_messages ORDER BY "createdAt" ASC`,
        [userId, limit]
    );
    return result.rows;
}

/**
 * Guarda un nuevo mensaje en el historial del usuario.
 */
export async function saveChatMessage(userId: string, role: "user" | "model", message: string): Promise<ChatMessage> {
    const result = await pool.query(
        `INSERT INTO chatbot_histories (user_id, role, message) 
         VALUES ($1, $2, $3) 
         RETURNING id, user_id as "userId", role, message, created_at as "createdAt"`,
        [userId, role, message]
    );
    return result.rows[0];
}

/**
 * Borra todo el historial de chat de un usuario.
 */
export async function deleteChatHistoryByUserId(userId: string): Promise<void> {
    await pool.query(
        "DELETE FROM chatbot_histories WHERE user_id = $1",
        [userId]
    );
}
