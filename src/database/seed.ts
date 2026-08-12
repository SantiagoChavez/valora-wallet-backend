import "dotenv/config";
import { pool } from "./db.js";

async function seed() {
  console.log("🌱 Iniciando seed de datos...");
  try {
    await pool.query(`DELETE FROM users WHERE email LIKE 'demo.%'`);

    // 1. Crear usuarios (contraseñas omitidas porque son cuentas demo para login OAuth/tests o pueden usar un hash genérico)
    // Usamos el hash de "Test1234!" generado genéricamente si se requiere, pero password_hash es opcional gracias a tu parche!
    const users = await pool.query(`
      INSERT INTO users (email, first_name, last_name, country)
      VALUES 
        ('demo.juan@valora.com', 'Juan', 'Pérez', 'AR'),
        ('demo.maria@valora.com', 'María', 'Gómez', 'CO'),
        ('demo.carlos@valora.com', 'Carlos', 'López', 'MX')
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, first_name;
    `);

    if (users.rowCount === 0) {
      console.log("⚠️ Los usuarios ya existen. Borra la base de datos si quieres re-crearlos.");
      return;
    }

    console.log(`✅ Creados ${users.rowCount} usuarios.`);

    // 2. Crear Wallets y Balances para cada usuario
    for (const user of users.rows) {
      // Crear Wallet
      const wallet = await pool.query(`
        INSERT INTO wallets (user_id, cvu, alias)
        VALUES ($1, $2, $3)
        RETURNING id;
      `, [
        user.id,
        `0000000000000000000${user.id.substring(0, 3)}`, // CVU falso
        `demo.${user.first_name.toLowerCase()}.valora` // Alias falso
      ]);
      const walletId = wallet.rows[0].id;

      // Crear Balances
      await pool.query(`
        INSERT INTO balances (wallet_id, currency_code, amount)
        VALUES 
          ($1, 'USD', 5000.00),
          ($1, 'ARS', 150000.00),
          ($1, 'EUR', 1000.00)
      `, [walletId]);

      console.log(`💰 Billetera y saldos creados para ${user.email}`);
    }

    console.log("🚀 Seed finalizado con éxito.");
  } catch (error) {
    console.error("❌ Error ejecutando seed:", error);
  } finally {
    await pool.end();
  }
}

seed();
