import {
  ICON_CART,
  ROW_ICON_MONEY,
  ROW_ICON_CLOCK,
  ROW_ICON_OPERATION,
  formatMoney,
  formatDateLong,
  buildOperationId,
  renderAmountCard,
  renderSuccessLine,
  renderHelpBox,
  renderEmailShell,
  type DetailRow,
} from "./emailLayout.js";

export type ConversionType = "BUY" | "SELL" | "EXCHANGE";

export interface ConversionEmailParams {
  type: ConversionType;
  sourceAmount: number;
  sourceCurrency: string;
  targetAmount: number;
  targetCurrency: string;
  transactionId: string;
  date: Date;
  country?: string | null;
}

const CONVERSION_COPY: Record<ConversionType, { heading: string; verb: string; label: string }> = {
  BUY: { heading: "Compra realizada", verb: "compra", label: "COMPRA DE" },
  SELL: { heading: "Venta realizada", verb: "venta", label: "VENTA DE" },
  EXCHANGE: { heading: "Intercambio realizado", verb: "intercambio", label: "INTERCAMBIO DE" },
};

/**
 * Mail de confirmación de compra/venta/intercambio, según el diseño
 * "Valora Mail - Compra Realizada" del proyecto de Claude Design — reusado tal cual para
 * los tres (mismo ícono de carrito, misma estructura), solo cambia el título/etiqueta.
 */
export function buildConversionEmailHtml(params: ConversionEmailParams): string {
  const copy = CONVERSION_COPY[params.type];
  const amountText = `+${formatMoney(params.targetAmount, params.targetCurrency)}`;

  // "Cotización": precio de 1 unidad de la moneda destino, expresado en la moneda de origen
  // (ej. 1 USD = $1.195,21 ARS) — mismo criterio que muestra el mockup original.
  const unitPrice = params.sourceAmount / params.targetAmount;

  const rows: DetailRow[] = [
    { icon: ROW_ICON_MONEY, label: "Monto", value: formatMoney(params.sourceAmount, params.sourceCurrency) },
    { icon: ROW_ICON_MONEY, label: "Cotización", value: formatMoney(unitPrice, params.sourceCurrency) },
    { icon: ROW_ICON_CLOCK, label: "Fecha", value: formatDateLong(params.date, params.country) },
    { icon: ROW_ICON_OPERATION, label: "ID de operación", value: buildOperationId(params.transactionId) },
  ];

  const bodyHtml =
    renderAmountCard({ label: copy.label, amountText, amountColor: "#49dfa0", rows }) +
    renderSuccessLine("Operación completada correctamente") +
    renderHelpBox();

  return renderEmailShell({
    title: copy.heading,
    preheader: `Tu ${copy.verb} de ${formatMoney(params.targetAmount, params.targetCurrency)} se procesó correctamente.`,
    iconPath: ICON_CART,
    heading: copy.heading,
    subheading: `Tu ${copy.verb} se procesó correctamente.`,
    bodyHtml,
  });
}
