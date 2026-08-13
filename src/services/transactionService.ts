import { pool } from "../database/db.js";
import { findWalletByUserId, findWalletAndUserByIdentifier, findWalletWithNotificationRecipientByUserId } from "../models/walletModel.js";
import { updateUserBalance } from "../models/balanceModel.js";
import { insertTransaction, findTransactionsByWalletId, countTransactionsByWalletId } from "../models/transactionModel.js";
import { getExchangeRates } from "./exchangeRateService.js";
import { enviarEmailConfirmacion } from "./sesService.js";
import { findUserById } from "../models/userModel.js";
import { truncateTo8Decimals } from "../utils/mathUtils.js";
import { buildDepositEmailHtml } from "../emails/depositEmailTemplate.js";
import { buildConversionEmailHtml } from "../emails/conversionEmailTemplate.js";
import { buildTransferSentEmailHtml } from "../emails/transferSentEmailTemplate.js";
import { buildTransferReceivedEmailHtml } from "../emails/transferReceivedEmailTemplate.js";

// ============================================================================
// HELPERS Y UTILIDADES (DRY)
// ============================================================================

/**
 * Notificador asíncrono centralizado (Fire-and-Forget).
 * No bloquea la respuesta HTTP ni la base de datos. Respeta el toggle
 * email_notifications_enabled del usuario — si está en false, no envía nada.
 */
function notifyUserAsync(
    subject: string,
    htmlBody: string,
    recipient: { email: string; notificationsEnabled: boolean }
): void {
    if (!recipient.notificationsEnabled) return;
    void enviarEmailConfirmacion({
        destinatario: recipient.email,
        asunto: subject,
        cuerpoHtml: htmlBody
    }).catch(err => {
        // FIX: Enmascaramos el email para no exponer PII en logs (cumplimiento de privacidad)
        const parts = recipient.email.split('@');
        const maskedEmail = parts.length === 2 ? `${parts[0].slice(0, 2)}***@${parts[1]}` : '***';
        console.error(`[Background Notification Error] email ${maskedEmail}:`, err);
    });
}

// ============================================================================
// CONVERSIÓN DE MONEDAS (compra/venta/intercambio) — helpers compartidos
// ============================================================================

type BaseCurrency = "USD" | "EUR" | "ARS";
const isValidCurrency = (cur: string): cur is BaseCurrency => ["USD", "EUR", "ARS"].includes(cur);

// Comisión/spread aplicada a toda conversión — mitigación de "salami slicing" (ver CHANGELOG).
const CONVERSION_FEE_RATE = 0.01;

// Debe coincidir con el .max() de amountBaseSchema en transactionSchema.ts. El schema solo
// valida el campo "amount" tal cual lo manda el cliente; cuando amountSide es "target", el
// monto que realmente se debita (sourceAmount) se deriva DESPUÉS de esa validación, así que
// hay que volver a chequearlo acá o un monto "target" bajo el límite puede derivar un
// sourceAmount muy por encima de 1.000.000 sin que nada lo frene.
const MAX_TRANSACTION_AMOUNT = 1_000_000;

/**
 * Calcula sourceAmount/targetAmount para una conversión, aplicando la comisión del 1% en la
 * dirección correcta según qué lado del monto mandó el usuario (misma aritmética que antes
 * tenían por separado getExchangeQuote y executeConversion, ahora en un solo lugar).
 *
 * effectiveRate es la tasa YA con la comisión aplicada — es lo que hay que persistir como
 * rate_applied en el ledger para que target_amount = source_amount * rate_applied cierre
 * siempre (antes se guardaba la tasa cruda sin comisión, y el ledger quedaba inconsistente
 * con los montos reales y con el "Cotización" que muestra el email de confirmación).
 */
function computeConversionAmounts(
    amount: number,
    amountSide: "source" | "target",
    rateFrom: number,
    rateTo: number
): { sourceAmount: number; targetAmount: number; effectiveRate: number } {
    const rawRatio = rateTo / rateFrom;

    let sourceAmount: number;
    let targetAmount: number;

    if (amountSide === "target") {
        targetAmount = truncateTo8Decimals(amount);
        const rawTargetAmount = targetAmount / (1 - CONVERSION_FEE_RATE);
        sourceAmount = truncateTo8Decimals(rawTargetAmount / rawRatio);
    } else {
        sourceAmount = truncateTo8Decimals(amount);
        targetAmount = truncateTo8Decimals(sourceAmount * rawRatio * (1 - CONVERSION_FEE_RATE));
    }

    if (sourceAmount <= 0 || targetAmount <= 0) {
        throw Object.assign(
            new Error("El monto resultante es demasiado pequeño para la tasa de cambio actual."),
            { status: 400, code: "AMOUNT_TOO_SMALL" }
        );
    }

    if (sourceAmount > MAX_TRANSACTION_AMOUNT || targetAmount > MAX_TRANSACTION_AMOUNT) {
        throw Object.assign(
            new Error("El monto excede el límite operativo permitido por transacción."),
            { status: 400, code: "AMOUNT_TOO_LARGE" }
        );
    }

    const effectiveRate = truncateTo8Decimals(rawRatio * (1 - CONVERSION_FEE_RATE));

    return { sourceAmount, targetAmount, effectiveRate };
}

// ============================================================================
// CORE SERVICES
// ============================================================================

export async function executeDeposit(userId: string, currency: string, amount: number) {
    if (amount <= 0) throw Object.assign(new Error("El monto a depositar debe ser mayor a cero."), { status: 400, code: "INVALID_AMOUNT" });

    const wallet = await findWalletWithNotificationRecipientByUserId(userId);
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

        notifyUserAsync(
            "Depósito confirmado - Valora Wallet",
            buildDepositEmailHtml({ amount: cleanAmount, currency, transactionId: transaction.id, date: new Date(), country: wallet.country }),
            { email: wallet.email, notificationsEnabled: wallet.email_notifications_enabled }
        );

        return transaction;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function getExchangeQuote(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    amountSide: "source" | "target" = "source"
) {
    if (amount <= 0) throw Object.assign(new Error("El monto a cotizar debe ser mayor a cero."), { status: 400, code: "INVALID_AMOUNT" });
    if (fromCurrency === toCurrency) throw Object.assign(new Error("Las monedas de origen y destino no pueden ser iguales."), { status: 400, code: "SAME_CURRENCY" });

    if (!isValidCurrency(fromCurrency) || !isValidCurrency(toCurrency)) {
        throw Object.assign(new Error("Moneda no soportada para cotización."), { status: 400, code: "UNSUPPORTED_CURRENCY" });
    }

    const rates = await getExchangeRates();
    const rateFrom = rates[fromCurrency];
    const rateTo = rates[toCurrency];

    if (!Number.isFinite(rateFrom) || !Number.isFinite(rateTo) || rateFrom <= 0 || rateTo <= 0) {
        throw Object.assign(new Error("Tasa de cambio no disponible para las monedas seleccionadas."), { status: 400, code: "RATE_NOT_AVAILABLE" });
    }

    // exchangeRate acá es la tasa de mercado cruda (sin comisión) — es lo que se muestra como
    // cotización informativa antes de confirmar la operación. La comisión del 1% se aplica y
    // se documenta aparte en sourceAmount/targetAmount (ver computeConversionAmounts).
    const exchangeRate = truncateTo8Decimals(rateTo / rateFrom);
    const { sourceAmount, targetAmount } = computeConversionAmounts(amount, amountSide, rateFrom, rateTo);

    return { exchangeRate, sourceAmount, targetAmount };
}

async function executeConversion(
    userId: string,
    type: "EXCHANGE" | "BUY" | "SELL",
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    amountSide: "source" | "target" = "source"
) {
    const action = type === "EXCHANGE" ? "intercambiar" : type === "BUY" ? "comprar" : "vender";
    if (amount <= 0) throw Object.assign(new Error(`El monto a ${action} debe ser mayor a cero.`), { status: 400, code: "INVALID_AMOUNT" });
    if (fromCurrency === toCurrency) throw Object.assign(new Error("Las monedas de origen y destino no pueden ser iguales."), { status: 400, code: "SAME_CURRENCY" });

    const wallet = await findWalletWithNotificationRecipientByUserId(userId);
    if (!wallet) throw Object.assign(new Error("Billetera no encontrada."), { status: 404, code: "WALLET_NOT_FOUND" });

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

        let cleanAmount: number;
        let targetAmount: number;
        let effectiveRate: number;
        try {
            ({ sourceAmount: cleanAmount, targetAmount, effectiveRate } = computeConversionAmounts(amount, amountSide, rateFrom, rateTo));
        } catch (conversionError: unknown) {
            // Los mensajes de AMOUNT_TOO_SMALL/AMOUNT_TOO_LARGE del helper compartido son
            // genéricos ("el monto"); acá se personalizan con la acción (comprar/vender/etc.)
            // igual que antes, sin cambiar el status/code.
            if (
                conversionError && typeof conversionError === "object" && "code" in conversionError &&
                conversionError.code === "AMOUNT_TOO_SMALL"
            ) {
                throw Object.assign(
                    new Error(`El monto a ${action} es demasiado pequeño para la tasa de cambio actual.`),
                    { status: 400, code: "AMOUNT_TOO_SMALL" }
                );
            }
            throw conversionError;
        }

        await updateUserBalance(client, wallet.id, fromCurrency, -cleanAmount);
        const newTargetBalance = await updateUserBalance(client, wallet.id, toCurrency, targetAmount);

        const transaction = await insertTransaction(
            client, wallet.id, type, fromCurrency, toCurrency, cleanAmount, targetAmount, effectiveRate, newTargetBalance.amount
        );

        await client.query("COMMIT");

        const actionName = type === "EXCHANGE" ? "Intercambio" : type === "BUY" ? "Compra" : "Venta";

        notifyUserAsync(
            `${actionName} confirmada - Valora Wallet`,
            buildConversionEmailHtml({
                type,
                sourceAmount: cleanAmount,
                sourceCurrency: fromCurrency,
                targetAmount,
                targetCurrency: toCurrency,
                transactionId: transaction.id,
                date: new Date(),
                country: wallet.country,
            }),
            { email: wallet.email, notificationsEnabled: wallet.email_notifications_enabled }
        );

        return transaction;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

export async function executeExchange(userId: string, fromCurrency: string, toCurrency: string, amount: number, amountSide: "source" | "target" = "source") {
    return executeConversion(userId, "EXCHANGE", fromCurrency, toCurrency, amount, amountSide);
}

export async function executeBuy(userId: string, fromCurrency: string, toCurrency: string, amount: number, amountSide: "source" | "target" = "source") {
    return executeConversion(userId, "BUY", fromCurrency, toCurrency, amount, amountSide);
}

export async function executeSell(userId: string, fromCurrency: string, toCurrency: string, amount: number, amountSide: "source" | "target" = "source") {
    return executeConversion(userId, "SELL", fromCurrency, toCurrency, amount, amountSide);
}

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
export async function executeTransfer(senderUserId: string, currency: string, amount: number, destinationIdentifier: string, concepto?: string | null) {
    if (amount <= 0) throw Object.assign(new Error("El monto a transferir debe ser mayor a cero."), { status: 400, code: "INVALID_AMOUNT" });

    // FIX: Sanitizamos el monto EXACTO al inicio para que Saldos, Historial y Emails usen la misma fuente de verdad.
    const cleanAmount = truncateTo8Decimals(amount);
    const cleanConcepto = concepto?.trim() || null;

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

        await client.query(
            `SELECT id FROM wallets WHERE id = ANY(ARRAY[$1::uuid, $2::uuid]) ORDER BY id FOR UPDATE`,
            [senderWallet.id, recipientInfo.wallet_id]
        );

        const senderUpdatedBalance = await updateUserBalance(client, senderWallet.id, currency, -cleanAmount);
        const recipientUpdatedBalance = await updateUserBalance(client, recipientInfo.wallet_id, currency, cleanAmount);

        const senderTransaction = await insertTransaction(
            client, senderWallet.id, "TRANSFER_OUT", currency, currency, cleanAmount, cleanAmount, null, senderUpdatedBalance.amount,
            recipientInfo.user_id, recipientInfo.first_name, recipientInfo.last_name, recipientInfo.email, recipientInfo.wallet_id, recipientInfo.alias, cleanConcepto
        );

        const recipientTransaction = await insertTransaction(
            client, recipientInfo.wallet_id, "TRANSFER_IN", currency, currency, null, cleanAmount, null, recipientUpdatedBalance.amount,
            senderUserId, senderUser.first_name, senderUser.last_name, senderUser.email, senderWallet.id, senderWallet.alias, cleanConcepto
        );

        await client.query("COMMIT");

        const transferDate = new Date();

        notifyUserAsync(
            "Transferencia enviada - Valora Wallet",
            buildTransferSentEmailHtml({
                amount: cleanAmount,
                currency,
                recipientName: `${recipientInfo.first_name} ${recipientInfo.last_name}`,
                recipientAlias: recipientInfo.alias,
                concepto: cleanConcepto,
                transactionId: senderTransaction.id,
                date: transferDate,
                country: senderUser.country,
            }),
            { email: senderUser.email, notificationsEnabled: senderUser.email_notifications_enabled }
        );
        notifyUserAsync(
            "Transferencia recibida - Valora Wallet",
            buildTransferReceivedEmailHtml({
                amount: cleanAmount,
                currency,
                senderName: `${senderUser.first_name} ${senderUser.last_name}`,
                senderAlias: senderWallet.alias,
                concepto: cleanConcepto,
                transactionId: recipientTransaction.id,
                date: transferDate,
                country: recipientInfo.country,
            }),
            { email: recipientInfo.email, notificationsEnabled: recipientInfo.email_notifications_enabled }
        );

        return senderTransaction;
    } catch (error: unknown) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}
