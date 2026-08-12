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

      // 3. Crear Historial de Transacciones Financieras (Cumpliendo reglas Fintech)
      // Generamos un historial coherente con los tipos permitidos (DEPOSIT, BUY, SELL, EXCHANGE)
      await pool.query(`
        INSERT INTO transactions (wallet_id, transaction_type, source_currency, target_currency, source_amount, target_amount, exchange_rate, resulting_balance, created_at)
        VALUES 
          -- Depósito inicial en ARS
          ($1, 'DEPOSIT', NULL, 'ARS', NULL, 200000.00, 1.0, 200000.00, NOW() - INTERVAL '3 days'),
          
          -- Compra de USD con ARS (BUY)
          ($1, 'BUY', 'ARS', 'USD', 50000.00, 50.00, 1000.00, 50.00, NOW() - INTERVAL '2 days'),
          
          -- Intercambio de USD a EUR (EXCHANGE)
          ($1, 'EXCHANGE', 'USD', 'EUR', 10.00, 9.20, 0.92, 9.20, NOW() - INTERVAL '1 day')
      `, [walletId]);

      console.log(`💰 Billetera, saldos e historial financiero creados para ${user.email}`);
    }

    console.log("🚀 Seed finalizado con éxito.");
  } catch (error) {
    console.error("❌ Error ejecutando seed:", error);
  } finally {
    await pool.end();
  }
}

seed();
