import { renderEmailShell } from "./emailLayout.js";

/** Caja de nota con glifo a la izquierda — mismo estilo que usa el mockup de reset de contraseña. */
function renderNoteBox(text: string): string {
  return `
  <tr>
    <td style="padding:0 40px 20px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#1b1c19;border:1px solid #343531;border-radius:10px;">
        <tr>
          <td width="36" style="padding:14px 0 14px 16px;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#f0b429;">●</td>
          <td style="padding:14px 16px 14px 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#d4c5ad;">${text}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

/**
 * Construye el HTML del email de recuperación/cambio de contraseña, según el diseño
 * "Valora Mail - Restablecer Contrasena" del proyecto de Claude Design. Reusa el shell
 * compartido de emailLayout.ts (logo, badge de ícono, footer) — antes lo reimplementaba a
 * mano, lo que lo hacía desalinearse del resto de los templates cada vez que el shell cambiaba.
 *
 * Diferencias respecto al diseño original:
 * - El TTL del texto ("30 minutos") coincide con PASSWORD_RESET_TOKEN_TTL_MS real, no con el
 *   "60 minutos" del mockup.
 * - El footer solo tiene "Ayuda" (mailto al soporte real) — Privacidad/Términos no tienen
 *   página propia todavía (hoy son un modal in-app, no una ruta pública).
 *
 * @param resetLink - URL completa con el token de recuperación (frontend /reset-password?token=...)
 */
export function buildPasswordResetEmailHtml(resetLink: string): string {
  const bodyHtml = `
  <tr>
    <td style="padding:0 40px 20px 40px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#d4c5ad;text-align:center;">Si fuiste vos, hacé clic en el botón para continuar y crear una nueva contraseña.</td>
  </tr>
  <tr>
    <td style="padding:0 40px 24px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr>
          <td align="center" bgcolor="#f0b429" style="border-radius:10px;">
            <a href="${resetLink}" style="display:block;padding:15px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#1a1300;text-decoration:none;">Continuar</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${renderNoteBox("Este enlace es válido durante los próximos 30 minutos.")}
  <tr>
    <td style="padding:0 40px 20px 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid #262624;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
  </tr>
  <tr>
    <td style="padding:0 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#e3e3dd;text-align:center;">¿No solicitaste este cambio?</td>
  </tr>
  <tr>
    <td style="padding:0 40px 20px 40px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#d4c5ad;text-align:center;">Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña no será modificada.</td>
  </tr>
  ${renderNoteBox("Por tu seguridad, nunca te vamos a solicitar tu contraseña ni códigos de seguridad por correo electrónico.")}`;

  return renderEmailShell({
    title: "Restablecé o cambiá tu contraseña",
    preheader: "Recibimos una solicitud para restablecer o cambiar tu contraseña de Valora Wallet.",
    iconPath: "●",
    heading: "Restablecé o cambiá tu contraseña",
    subheading: "Recibimos una solicitud para restablecer o cambiar<br>la contraseña de tu cuenta de Valora Wallet.",
    bodyHtml,
  });
}
