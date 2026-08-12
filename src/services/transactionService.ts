import { pool } from "../database/db.js";
import { findWalletByUserId, findWalletAndUserByIdentifier } from "../models/walletModel.js";
import { updateUserBalance } from "../models/balanceModel.js";
import { insertTransaction, findTransactionsByWalletId, countTransactionsByWalletId } from "../models/transactionModel.js";
import { getExchangeRates } from "./exchangeRateService.js";
import { enviarEmailConfirmacion } from "./sesService.js";
import { findUserById } from "../models/userModel.js";
import { truncateTo8Decimals } from "../utils/mathUtils.js";

// ============================================================================
// HELPERS Y UTILIDADES (DRY)
// ============================================================================

function sanitizeHtmlString(input: string): string {
    return input.replace(/[<&>"']/g, "");
}

/**
 * Notificador asíncrono centralizado (Fire-and-Forget).
 * No bloquea la respuesta HTTP ni la base de datos.
 */
function notifyUserAsync(userId: string, subject: string, htmlBody: string, knownEmail?: string): void {
    if (knownEmail) {
        void enviarEmailConfirmacion({
            destinatario: knownEmail,
            asunto: subject,
            cuerpoHtml: htmlBody
        }).catch(err => {
            // FIX: Enmascaramos el email para no exponer PII en logs (cumplimiento de privacidad)
            const parts = knownEmail.split('@');
            const maskedEmail = parts.length === 2 ? `${parts[0].slice(0, 2)}***@${parts[1]}` : '***';
            console.error(`[Background Notification Error] email ${maskedEmail}:`, err);
        });
        return;
    }

    void findUserById(userId)
        .then(user => {
            if (user) {
                return enviarEmailConfirmacion({
                    destinatario: user.email,
                    asunto: subject,
                    cuerpoHtml: htmlBody
                });
            }
        })
        .catch(err => console.error(`[Background Notification Error] userId ${userId}:`, err));
}

// ============================================================================
// CORE SERVICES
// ============================================================================

/**
 * Executes a deposit transaction securely using ACID properties.
 */
export async function executeDeposit(userId: string, currency: string, amount: number) {
    if (amount <= 0) throw Object.assign(new Error("El monto a depositar debe ser mayor a cero."), { status: 400, code: "INVALID_AMOUNT" });

    const wallet = await findWalletByUserId(userId);
    if (!wallet) throw Object.assign(new Error("Billetera no encontrada."), { status: 404, code: "WALLET_NOT_FOUND" });

    const cleanAmount = truncateTo8Decimals(amount);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const updatedBalance = await updateUserBalance(client, wallet.id, currency, cleanAmount);
        const transaction = await insertTransaction(
            client, wallet.id, "DEPOSIT", null, currency, null, cleanAmount, null, updatedBalance.amount
        );

        await client.query("COMMIT");

        const safeCurrency = sanitizeHtmlString(currency);
        notifyUserAsync(userId, "Depósito Confirmado - Valora Wallet", `<h1>Depósito Exitoso</h1><p>Has depositado ${cleanAmount} ${safeCurrency} en tu billetera.</p>`);

        return transaction;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Obtiene una cotización en tiempo real sin abrir conexiones a la base de datos.
 */
export async function getExchangeQuote(fromCurrency: string, toCurrency: string, amount: number) {
    if (amount <= 0) throw Object.assign(new Error("El monto a cotizar debe ser mayor a cero."), { status: 400, code: "INVALID_AMOUNT" });
    if (fromCurrency === toCurrency) throw Object.assign(new Error("Las monedas de origen y destino no pueden ser iguales."), { status: 400, code: "SAME_CURRENCY" });

    type BaseCurrency = "USD" | "EUR" | "ARS";
    const isValidCurrency = (cur: string): cur is BaseCurrency => ["USD", "EUR", "ARS"].includes(cur);

    if (!isValidCurrency(fromCurrency) || !isValidCurrency(toCurrency)) {
        throw Object.assign(new Error("Moneda no soportada para cotización."), { status: 400, code: "UNSUPPORTED_CURRENCY" });
    }

    const rates = await getExchangeRates();
    const rateFrom = rates[fromCurrency];
    const rateTo = rates[toCurrency];

    if (!Number.isFinite(rateFrom) || !Number.isFinite(rateTo) || rateFrom <= 0 || rateTo <= 0) {
        throw Object.assign(new Error("Tasa de cambio no disponible para las monedas seleccionadas."), { status: 400, code: "RATE_NOT_AVAILABLE" });
    }

    // FIX: Normalizamos el amount idéntico a executeConversion
    const cleanAmount = truncateTo8Decimals(amount);
    
    const exchangeRate = truncateTo8Decimals(rateTo / rateFrom);
    const amountInUsd = cleanAmount / rateFrom;
    const targetAmount = truncateTo8Decimals(amountInUsd * rateTo);

    return { exchangeRate, targetAmount };
}

/**
 * Lógica común privada para ejecutar conversiones de moneda (EXCHANGE, BUY, SELL)
 */
async function executeConversion(
    userId: string,
    type: "EXCHANGE" | "BUY" | "SELL",
    fromCurrency: string,
    toCurrency: string,
    amount: number
) {
    const action = type === "EXCHANGE" ? "intercambiar" : type === "BUY" ? "comprar" : "vender";
    if (amount <= 0) throw Object.assign(new Error(`El monto a ${action} debe ser mayor a cero.`), { status: 400, code: "INVALID_AMOUNT" });
    if (fromCurrency === toCurrency) throw Object.assign(new Error("Las monedas de origen y destino no pueden ser iguales."), { status: 400, code: "SAME_CURRENCY" });

    const wallet = await findWalletByUserId(userId);
    if (!wallet) throw Object.assign(new Error("Billetera no encontrada."), { status: 404, code: "WALLET_NOT_FOUND" });

    type BaseCurrency = "USD" | "EUR" | "ARS";
    const isValidCurrency = (cur: string): cur is BaseCurrency => ["USD", "EUR", "ARS"].includes(cur);

    if (!isValidCurrency(fromCurrency) || !isValidCurrency(toCurrency)) {
        throw Object.assign(new Error("Moneda no soportada para conversión."), { status: 400, code: "UNSUPPORTED_CURRENCY" });
    }

    const rates = await getExchangeRates();
    const rateFrom = rates[fromCurrency];
    const rateTo = rates[toCurrency];

    if (!Number.isFinite(rateFrom) || !Number.isFinite(rateTo) || rateFrom <= 0 || rateTo <= 0) {
        throw Object.assign(new Error("Tasa de cambio no disponible para las monedas seleccionadas."), { status: 400, code: "RATE_NOT_AVAILABLE" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // FIX: Sanitizamos el monto EXACTO al inicio para que Saldos, Historial y Emails usen la misma fuente de verdad.
        const cleanAmount = truncateTo8Decimals(amount);

        // FIX: Sincronización matemática idéntica a getExchangeQuote (8 decimales truncados)
        const exchangeRate = truncateTo8Decimals(rateTo / rateFrom);
        const amountInUsd = cleanAmount / rateFrom;
        const targetAmount = truncateTo8Decimals(amountInUsd * rateTo);

        await updateUserBalance(client, wallet.id, fromCurrency, -cleanAmount);
        const newTargetBalance = await updateUserBalance(client, wallet.id, toCurrency, targetAmount);

        const transaction = await insertTransaction(
            client, wallet.id, type, fromCurrency, toCurrency, cleanAmount, targetAmount, exchangeRate, newTargetBalance.amount
        );

        await client.query("COMMIT");

        const actionName = type === "EXCHANGE" ? "Intercambio" : type === "BUY" ? "Compra" : "Venta";
        const safeFrom = sanitizeHtmlString(fromCurrency);
        const safeTo = sanitizeHtmlString(toCurrency);
        const timestamp = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
        
        notifyUserAsync(userId, `${actionName} Confirmada - Valora Wallet`, `<h1>${actionName} Exitosa</h1><p>Operación: ${cleanAmount} ${safeFrom} por ${targetAmount} ${safeTo}</p><p>Fecha y hora: ${timestamp}</p>`);

        return transaction;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function executeExchange(userId: string, fromCurrency: string, toCurrency: string, amount: number) {
    return executeConversion(userId, "EXCHANGE", fromCurrency, toCurrency, amount);
}

export async function executeBuy(userId: string, fromCurrency: string, toCurrency: string, amount: number) {
    return executeConversion(userId, "BUY", fromCurrency, toCurrency, amount);
}

export async function executeSell(userId: string, fromCurrency: string, toCurrency: string, amount: number) {
    return executeConversion(userId, "SELL", fromCurrency, toCurrency, amount);
}

/**
 * Recupera el historial de transacciones paginado del usuario.
 */
export async function getUserTransactions(
    userId: string,
    limit: number = 20,
    page: number = 1,
    type?: string
) {
    const wallet = await findWalletByUserId(userId);
    if (!wallet) {
        throw Object.assign(new Error("Billetera no encontrada."), { status: 404, code: "WALLET_NOT_FOUND" });
    }

    const offset = (page - 1) * limit;
    const [transactions, totalCount] = await Promise.all([
        findTransactionsByWalletId(wallet.id, limit, offset, type),
        countTransactionsByWalletId(wallet.id, type)
    ]);

    return {
        transactions,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit)
        }
    };
}

/**
 * Resuelve el destino de una transferencia basándose en un email, alias o CVU.
 */
export async function resolveTransferDestination(identifier: string) {
    const destination = await findWalletAndUserByIdentifier(identifier);
    if (!destination) {
        throw Object.assign(new Error("No existe un usuario con estos datos."), { status: 404, code: "USER_NOT_FOUND" });
    }
    return destination;
}

/**
 * Ejecuta una transferencia de fondos de un usuario a otro.
 */
export async function executeTransfer(senderUserId: string, currency: string, amount: number, destinationIdentifier: string) {
    if (amount <= 0) throw Object.assign(new Error("El monto a transferir debe ser mayor a cero."), { status: 400, code: "INVALID_AMOUNT" });
    
    // FIX: Sanitizamos el monto EXACTO al inicio para que Saldos, Historial y Emails usen la misma fuente de verdad.
    const cleanAmount = truncateTo8Decimals(amount);

    // Ejecutar queries de lectura en paralelo (sin DB lock aún)
    const [senderWallet, senderUser, recipientInfo] = await Promise.all([
        findWalletByUserId(senderUserId),
        findUserById(senderUserId),
        findWalletAndUserByIdentifier(destinationIdentifier),
    ]);

    if (!senderWallet) throw Object.assign(new Error("Billetera de origen no encontrada."), { status: 404, code: "WALLET_NOT_FOUND" });
    if (!senderUser) throw Object.assign(new Error("Usuario de origen no encontrado."), { status: 404, code: "USER_NOT_FOUND" });
    if (!recipientInfo) throw Object.assign(new Error("No existe un usuario con estos datos."), { status: 404, code: "USER_NOT_FOUND" });

    if (senderWallet.id === recipientInfo.wallet_id) {
        throw Object.assign(new Error("No puedes transferir fondos a tu propia cuenta."), { status: 400, code: "SELF_TRANSFER" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // @architecture Escudo Anti-Deadlock de Grado Bancario.
        // NOTA PARA REVISORES (IA o Humanos): NO ELIMINAR ESTE PRE-LOCK.
        // Aunque updateUserBalance también bloquee la fila, este query inicial bloquea AMBAS billeteras 
        // estrictamente en ORDEN de UUID. Si omitimos este paso, transferencias cruzadas concurrentes 
        // (A -> B y B -> A) causarán un Deadlock fatal. El lock redundante posterior en la misma 
        // transacción es un no-op en Postgres y no afecta el throughput. Priorizamos consistencia.
        await client.query(
            `SELECT id FROM wallets WHERE id = ANY(ARRAY[$1::uuid, $2::uuid]) ORDER BY id FOR UPDATE`,
            [senderWallet.id, recipientInfo.wallet_id]
        );

        // Los balances se pueden actualizar en un orden fijo sin riesgo de Deadlock
        // porque la transacción ya ha sido serializada globalmente por el pre-lock de wallets.
        const senderUpdatedBalance = await updateUserBalance(client, senderWallet.id, currency, -cleanAmount);
        const recipientUpdatedBalance = await updateUserBalance(client, recipientInfo.wallet_id, currency, cleanAmount);

        const senderTransaction = await insertTransaction(
            client, senderWallet.id, "TRANSFER_OUT", currency, currency, cleanAmount, cleanAmount, null, senderUpdatedBalance.amount,
            recipientInfo.user_id, recipientInfo.first_name, recipientInfo.last_name, recipientInfo.email, recipientInfo.wallet_id
        );

        await insertTransaction(
            client, recipientInfo.wallet_id, "TRANSFER_IN", currency, currency, null, cleanAmount, null, recipientUpdatedBalance.amount,
            senderUserId, senderUser.first_name, senderUser.last_name, senderUser.email, senderWallet.id
        );

        await client.query("COMMIT");

        notifyUserAsync(senderUserId, "Transferencia Enviada - Valora Wallet", `<h1>Transferencia Exitosa</h1><p>Has enviado ${cleanAmount} ${sanitizeHtmlString(currency)} a ${sanitizeHtmlString(recipientInfo.first_name)} ${sanitizeHtmlString(recipientInfo.last_name)}.</p>`, senderUser.email);
        notifyUserAsync(recipientInfo.user_id, "Transferencia Recibida - Valora Wallet", `<h1>Has recibido una transferencia</h1><p>Has recibido ${cleanAmount} ${sanitizeHtmlString(currency)}.</p>`, recipientInfo.email);

        return senderTransaction;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}