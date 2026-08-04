import "dotenv/config";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("La variable de entorno DATABASE_URL no está configurada.");
}

const isProduction = process.env.NODE_ENV === "production";
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isProduction ? { rejectUnauthorized } : false,
  allowExitOnIdle: true,
});

pool.on("error", (err) => console.error("Error inesperado en cliente inactivo del pool de PG:", err));

/**
 * Helper para ejecutar consultas seguras parametrizadas contra la base de datos.
 * @param text La sentencia SQL de la consulta.
 * @param params Los parámetros de la consulta.
 * @returns El resultado de la consulta.
 */
export const query = async (text: string, params?: unknown[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log de consulta en modo desarrollo si se requiere, formateado en español
    if (!isProduction) {
      console.log("Consulta ejecutada", {
        sql: text,
        duracion: `${duration}ms`,
        filas: res.rowCount,
      });
    }
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    console.error("Fallo en la ejecución de la consulta", {
      sql: text,
      duracion: `${duration}ms`,
      error,
    });
    throw error;
  }
};
