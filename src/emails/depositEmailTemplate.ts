import {
  ICON_DOWN_ARROW,
  ROW_ICON_CLOCK,
  ROW_ICON_OPERATION,
  formatMoney,
  formatDateShort,
  buildOperationId,
  renderAmountCard,
  renderSuccessLine,
  renderHelpBox,
  renderEmailShell,
  type DetailRow,
} from "./emailLayout.js";

export interface DepositEmailParams {
  amount: number;
  currency: string;
  transactionId: string;
  date: Date;
  country?: string | null;
}

/**
 * Mail de confirmación de depósito. No hay diseño propio en el proyecto de Claude Design —
 * se arma con el mismo sistema visual, reusando el ícono de flecha hacia abajo de
 * "Transferencia Recibida" (mismo criterio: dinero entrando a la cuenta).
 */
export function buildDepositEmailHtml(params: DepositEmailParams): string {
  const amountText = `+${formatMoney(params.amount, params.currency)}`;

  const rows: DetailRow[] = [
    { icon: ROW_ICON_CLOCK, label: "Fecha", value: formatDateShort(params.date, params.country) },
    { icon: ROW_ICON_OPERATION, label: "ID de operación", value: buildOperationId(params.transactionId) },
  ];

  const bodyHtml =
    renderAmountCard({ label: "MONTO DEPOSITADO", amountText, amountColor: "#49dfa0", rows }) +
    renderSuccessLine("El dinero ya está disponible en tu cuenta") +
    renderHelpBox();

  return renderEmailShell({
    title: "Depósito confirmado",
    preheader: `Tu depósito de ${formatMoney(params.amount, params.currency)} se acreditó correctamente.`,
    iconPath: ICON_DOWN_ARROW,
    heading: "Depósito confirmado",
    subheading: "Tu depósito se acreditó correctamente en tu cuenta.",
    bodyHtml,
  });
}
