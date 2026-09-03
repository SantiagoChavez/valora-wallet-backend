import "dotenv/config";
import dns from "node:dns";

// Forzar la resolución de DNS a priorizar IPv4 sobre IPv6.
// Requerido en entornos de nube IPv4-only (Render, Heroku, AWS Lambda) para evitar
// errores de socket inalcanzables (ENETUNREACH) al conectar con APIs/SMTP externos.
dns.setDefaultResultOrder("ipv4first");

import { app } from "./app.js";

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`🚀 Valora Wallet backend escuchando en: http://localhost:${port}`);
});
