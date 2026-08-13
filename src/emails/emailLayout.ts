const SUPPORT_EMAIL = "nexot.solutions@gmail.com";

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
            <td style="padding-right:10px;vertical-align:middle;"><img src="https://valora-wallet-frontend.vercel.app/valora-logo.png" width="34" height="34" alt="Valora" style="display:block;width:34px;height:34px;border:0;"></td>
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
