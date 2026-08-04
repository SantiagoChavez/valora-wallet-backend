import "dotenv/config";
import fs from "fs";
import path from "path";
import { Client } from "pg";

async function deploy(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Error: La variable de entorno DATABASE_URL no está configurada.");
    process.exitCode = 1;
    return;
  }

  console.log("Iniciando conexión a la base de datos...");

  // Determinar si la conexión es local o remota (como Railway)
  const isLocal = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");

  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized }
  });

  try {
    await client.connect();
    console.log("Conexión establecida correctamente con PostgreSQL.");

    const schemaPath = path.join(__dirname, "schema.sql");
    console.log(`Leyendo archivo de esquema desde: ${schemaPath}`);
    const sql = fs.readFileSync(schemaPath, "utf8");

    console.log("Ejecutando consultas DDL en la base de datos...");
    await client.query(sql);

    console.log("¡Esquema de base de datos inicializado exitosamente!");
  } catch (error) {
    console.error("Error durante la ejecución del esquema:", error);
    process.exitCode = 1;
    return;
  } finally {
    await client.end();
    console.log("Conexión cerrada.");
  }
}

deploy();
