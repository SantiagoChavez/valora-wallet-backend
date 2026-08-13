const SUPPORT_EMAIL = "nexot.solutions@gmail.com";

/**
 * Logo de Valora embebido en base64 (96x96) — los clientes de mail (Gmail, Outlook) bloquean
 * o no cargan imágenes externas de forma confiable, así que va inline. Único lugar donde vive
 * este blob — todos los templates de mail lo importan de acá.
 */
export const VALORA_LOGO_BASE64 = "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";

// Glifos de texto (no SVG) compartidos por los templates de mail. El ícono grande del
// círculo dorado y los íconos de fila usaban <svg> inline — Gmail y Outlook lo eliminan del
// HTML del mail (soporte de SVG en mails es prácticamente nulo), así que la burbuja quedaba
// vacía en la bandeja real aunque se viera bien al abrir el .html en el navegador. Se
// reemplaza por caracteres Unicode simples (flechas, símbolos) que son texto plano: toman el
// color por CSS y se renderizan en cualquier cliente. Los mockups originales no usaban el
// mismo ícono para filas con el mismo significado (ej. "Fecha" tenía un ícono en el mail de
// transferencias y otro distinto en el de compra) — acá se estandariza uno por significado.
export const ICON_CART = "⇄";
export const ICON_PLANE = "↑";
export const ICON_DOWN_ARROW = "↓";
export const ICON_CHECK = "✓";

/**
 * Escapa texto libre provisto por el usuario (nombre, apellido, concepto) antes de
 * interpolarlo en el HTML del mail — mismo criterio que sanitizeHtmlString en
 * transactionService.ts, replicado acá para no crear una dependencia circular entre módulos.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[<&>"']/g, "");
}

export const ROW_ICON_PERSON = "●";
export const ROW_ICON_ALIAS = "@";
export const ROW_ICON_CLOCK = "○";
export const ROW_ICON_DOCUMENT = "≡";
export const ROW_ICON_MONEY = "$";
export const ROW_ICON_OPERATION = "#";

/**
 * Formatea un monto con el criterio de los mockups: prefijo "$" solo para ARS (moneda local),
 * el resto de las monedas (USD, EUR) van sin prefijo — siempre con separadores es-AR y código
 * de moneda al final (ej. "$25.000,00 ARS", "125,50 USD").
 */
export function formatMoney(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  const prefix = currency === "ARS" ? "$" : "";
  return `${prefix}${formatted} ${currency}`;
}

/** Fecha corta "DD/MM/YYYY · HH:MM", usada en los mails de transferencia y depósito. */
export function formatDateShort(date: Date): string {
  const datePart = date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const timePart = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return `${datePart} · ${timePart}`;
}

/** Fecha larga "12 de agosto de 2026 · 20:42", usada en los mails de compra/venta/intercambio. */
export function formatDateLong(date: Date): string {
  const datePart = date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const timePart = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Buenos_Aires",
  });
  return `${datePart} · ${timePart}`;
}

/** ID de operación estilo "VAL-8F3A92", derivado de las primeras 6 posiciones del UUID real. */
export function buildOperationId(transactionId: string): string {
  return `VAL-${transactionId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export interface DetailRow {
  icon: string;
  label: string;
  value: string;
}

function renderRow(row: DetailRow): string {
  return `
        <tr>
          <td style="padding:12px 0;border-top:1px solid #343531;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="20" style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#9c8f7a;">${row.icon}</td>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9c8f7a;padding-left:8px;">${row.label}</td>
                <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#e3e3dd;">${row.value}</td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/**
 * La tarjeta gris con el monto grande arriba y las filas de detalle abajo — el bloque central
 * que comparten todos los mails de operaciones (depósito, compra/venta/intercambio, transferencias).
 */
export function renderAmountCard(params: {
  label: string;
  amountText: string;
  amountColor: string;
  rows: DetailRow[];
}): string {
  const rowsHtml = params.rows.map(renderRow).join("");
  return `
  <tr>
    <td style="padding:0 40px 24px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#1b1c19;border:1px solid #343531;border-radius:12px;">
        <tr>
          <td style="padding:22px 20px 0 20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#9c8f7a;">${params.label}</td>
        </tr>
        <tr>
          <td style="padding:6px 20px 18px 20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:30px;font-weight:700;color:${params.amountColor};">${params.amountText}</td>
        </tr>
        <tr>
          <td style="padding:0 20px 18px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rowsHtml}</table>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/** Ícono circular gold de 60x60 con el glifo de la acción (carrito, avión, flecha, etc.). */
export function renderIconBadge(glyph: string): string {
  return `
  <tr>
    <td style="text-align:center;padding-bottom:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr><td width="60" height="60" align="center" valign="middle" style="width:60px;height:60px;border-radius:50%;border:1px solid #f0b429;background-color:#1b1c19;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:60px;font-weight:700;color:#f0b429;">${glyph}</td></tr>
      </table>
    </td>
  </tr>`;
}

/** Línea verde de confirmación con tilde, debajo de la tarjeta de detalle. */
export function renderSuccessLine(text: string): string {
  return `
  <tr>
    <td style="padding:0 40px 28px 40px;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr>
          <td style="vertical-align:middle;padding-right:8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#49dfa0;">${ICON_CHECK}</td>
          <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#49dfa0;vertical-align:middle;">${text}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/** Caja "¿Tenés dudas? Ir a ayuda" — mailto al soporte real, no hay página de ayuda propia. */
export function renderHelpBox(): string {
  return `
  <tr>
    <td style="padding:0 40px 28px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#1b1c19;border:1px solid #343531;border-radius:10px;">
        <tr>
          <td style="padding:16px 20px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#d4c5ad;">
            Si tenés dudas o necesitás ayuda, estamos para ayudarte.<br>
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#f0b429;font-weight:700;text-decoration:none;">Ir a ayuda</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/**
 * Envuelve el contenido de un mail transaccional en el shell completo (head, header con logo,
 * ícono de acción, título/subtítulo, footer). `bodyHtml` es todo lo que va entre el subtítulo
 * y el footer (la tarjeta de detalle + línea de éxito + caja de ayuda opcional).
 */
export function renderEmailShell(params: {
  title: string;
  preheader: string;
  iconPath: string;
  heading: string;
  subheading: string;
  bodyHtml: string;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${params.title} — Valora Wallet</title>
<!--[if mso]>
<style type="text/css">
  table {border-collapse:collapse;}
  .fallback-font {font-family: Arial, sans-serif !important;}
</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#050605;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#050605;">${params.preheader}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#050605;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:#121411;border:1px solid #262624;border-radius:16px;">
  <tr>
    <td style="padding:36px 40px 24px 40px;text-align:center;">
      <a href="https://valora-wallet-frontend.vercel.app/" style="text-decoration:none;display:inline-block;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td style="padding-right:10px;vertical-align:middle;"><img src="data:image/png;base64,${VALORA_LOGO_BASE64}" width="34" height="34" alt="Valora" style="display:block;width:34px;height:34px;border:0;"></td>
            <td style="vertical-align:middle;text-align:left;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#f0b429;letter-spacing:0.5px;line-height:24px;">VALORA</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:600;color:#9c8f7a;letter-spacing:3px;line-height:12px;">WALLET</div>
            </td>
          </tr>
        </table>
      </a>
    </td>
  </tr>${renderIconBadge(params.iconPath)}
  <tr>
    <td style="text-align:center;padding:0 20px 28px 20px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#e3e3dd;padding-bottom:8px;">${params.heading}</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:400;color:#d4c5ad;line-height:20px;">${params.subheading}</div>
    </td>
  </tr>${params.bodyHtml}
  <tr>
    <td style="padding:24px 40px 36px 40px;text-align:center;border-top:1px solid #262624;">
      <div style="padding-bottom:6px;">
        <a href="https://valora-wallet-frontend.vercel.app/" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#f0b429;text-decoration:none;">Valora Wallet</a>
      </div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9c8f7a;padding-bottom:8px;">© ${year} Valora Wallet. Todos los derechos reservados.</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#f0b429;">
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#f0b429;text-decoration:none;">Ayuda</a>
      </div>
    </td>
  </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
