const SUPPORT_EMAIL = "nexot.solutions@gmail.com";

/**
 * Construye el HTML del email de recuperación/cambio de contraseña, según el diseño
 * "Valora Mail - Restablecer Contrasena" del proyecto de Claude Design. El logo va embebido
 * en base64 (más confiable en clientes de mail que bloquean imágenes externas).
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
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Restablecé o cambiá tu contraseña — Valora Wallet</title>
<!--[if mso]>
<style type="text/css">
  table {border-collapse:collapse;}
  .fallback-font {font-family: Arial, sans-serif !important;}
</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#050605;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#050605;">Recibimos una solicitud para restablecer o cambiar tu contraseña de Valora Wallet.</div>
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
  </tr>
  <tr>
    <td style="text-align:center;padding-bottom:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
        <tr><td width="60" height="60" align="center" valign="middle" style="width:60px;height:60px;border-radius:50%;border:1px solid #f0b429;background-color:#1b1c19;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f0b429" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg></td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="text-align:center;padding:0 20px 28px 20px;">
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#e3e3dd;padding-bottom:8px;">Restablecé o cambiá tu contraseña</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:400;color:#d4c5ad;line-height:20px;">Recibimos una solicitud para restablecer o cambiar<br>la contraseña de tu cuenta de Valora Wallet.</div>
    </td>
  </tr>
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
  <tr>
    <td style="padding:0 40px 20px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#1b1c19;border:1px solid #343531;border-radius:10px;">
        <tr>
          <td width="36" style="padding:14px 0 14px 16px;vertical-align:top;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0b429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"></path></svg></td>
          <td style="padding:14px 16px 14px 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#d4c5ad;">Este enlace es válido durante los próximos 30 minutos.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 20px 40px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="border-top:1px solid #262624;font-size:0;line-height:0;">&nbsp;</td></tr></table></td>
  </tr>
  <tr>
    <td style="padding:0 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#e3e3dd;text-align:center;">¿No solicitaste este cambio?</td>
  </tr>
  <tr>
    <td style="padding:0 40px 20px 40px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#d4c5ad;text-align:center;">Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña no será modificada.</td>
  </tr>
  <tr>
    <td style="padding:0 40px 20px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#1b1c19;border:1px solid #343531;border-radius:10px;">
        <tr>
          <td width="36" style="padding:14px 0 14px 16px;vertical-align:top;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f0b429" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"></path></svg></td>
          <td style="padding:14px 16px 14px 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;color:#d4c5ad;">Por tu seguridad, nunca te vamos a solicitar tu contraseña ni códigos de seguridad por correo electrónico.</td>
        </tr>
      </table>
    </td>
  </tr>
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
</html>

`;
}
