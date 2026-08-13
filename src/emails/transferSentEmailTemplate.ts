import {
  ICON_PLANE,
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

export interface TransferSentEmailParams {
  amount: number;
  currency: string;
  recipientName: string;
  recipientAlias: string | null;
  concepto: string | null;
  transactionId: string;
  date: Date;
  country?: string | null;
}

/**
 * Mail al emisor de una transferencia P2P, según el diseño
 * "Valora Mail - Transferencia Enviada" del proyecto de Claude Design.
 */
export function buildTransferSentEmailHtml(params: TransferSentEmailParams): string {
  const amountText = `-${formatMoney(params.amount, params.currency)}`;

  const rows: DetailRow[] = [
    { icon: ROW_ICON_PERSON, label: "Destinatario", value: escapeHtml(params.recipientName) },
  ];
  if (params.recipientAlias) {
    rows.push({ icon: ROW_ICON_ALIAS, label: "Alias", value: escapeHtml(params.recipientAlias) });
  }
  rows.push({ icon: ROW_ICON_CLOCK, label: "Fecha", value: formatDateShort(params.date, params.country) });
  if (params.concepto) {
    rows.push({ icon: ROW_ICON_DOCUMENT, label: "Concepto", value: escapeHtml(params.concepto) });
  }
  rows.push({ icon: ROW_ICON_OPERATION, label: "ID de operación", value: buildOperationId(params.transactionId) });

  const bodyHtml =
    renderAmountCard({ label: "MONTO ENVIADO", amountText, amountColor: "#e3e3dd", rows }) +
    renderSuccessLine("Transferencia realizada correctamente") +
    renderHelpBox();

  return renderEmailShell({
    title: "Transferencia enviada",
    preheader: `Tu transferencia de ${formatMoney(params.amount, params.currency)} fue realizada correctamente.`,
    iconPath: ICON_PLANE,
    heading: "Transferencia enviada",
    subheading: "Tu transferencia fue realizada correctamente.",
    bodyHtml,
  });
}
