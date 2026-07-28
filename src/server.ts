import "dotenv/config";

import { app } from "./app";

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`Valora Wallet backend escuchando en el puerto ${port}`);
});
