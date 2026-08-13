import {
  ICON_DOWN_ARROW,
  ROW_ICON_PERSON,
  ROW_ICON_ALIAS,
  ROW_ICON_CLOCK,
  ROW_ICON_DOCUMENT,
  ROW_ICON_OPERATION,
  formatMoney,
  formatDateShort,
  buildOperationId,
  escapeHtml,
  renderAmountCard,
  renderSuccessLine,
  renderHelpBox,
  renderEmailShell,
  type DetailRow,
} from "./emailLayout.js";

export interface TransferReceivedEmailParams {
  amount: number;
  currency: string;
  senderName: string;
  senderAlias: string | null;
  concepto: string | null;
  transactionId: string;
  date: Date;
}

/**
 * Mail al receptor de una transferencia P2P, según el diseño
 * "Valora Mail - Transferencia Recibida" del proyecto de Claude Design.
 */
export function buildTransferReceivedEmailHtml(params: TransferReceivedEmailParams): string {
  const amountText = `+${formatMoney(params.amount, params.currency)}`;

  const rows: DetailRow[] = [
    { icon: ROW_ICON_PERSON, label: "Remitente", value: escapeHtml(params.senderName) },
  ];
  if (params.senderAlias) {
    rows.push({ icon: ROW_ICON_ALIAS, label: "Alias", value: escapeHtml(params.senderAlias) });
  }
  rows.push({ icon: ROW_ICON_CLOCK, label: "Fecha", value: formatDateShort(params.date) });
  if (params.concepto) {
    rows.push({ icon: ROW_ICON_DOCUMENT, label: "Concepto", value: escapeHtml(params.concepto) });
  }
  rows.push({ icon: ROW_ICON_OPERATION, label: "ID de operación", value: buildOperationId(params.transactionId) });

  const bodyHtml =
    renderAmountCard({ label: "MONTO RECIBIDO", amountText, amountColor: "#49dfa0", rows }) +
    renderSuccessLine("El dinero ya está disponible en tu cuenta") +
    renderHelpBox();

  return renderEmailShell({
    title: "Transferencia recibida",
    preheader: `Recibiste una transferencia de ${formatMoney(params.amount, params.currency)} en tu cuenta Valora.`,
    iconPath: ICON_DOWN_ARROW,
    heading: "Transferencia recibida",
    subheading: "Recibiste una transferencia en tu cuenta Valora.",
    bodyHtml,
  });
}
