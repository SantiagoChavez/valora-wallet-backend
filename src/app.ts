import cors from "cors";
import express from "express";

import { errorHandler } from "./middlewares/errorHandler";
import { router } from "./routes";

export const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL, // producción (Vercel)
  "http://localhost:5173", // desarrollo local del frontend (puerto default de Vite)
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requests sin origin (Postman, curl, etc.) y los orígenes de la lista
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("No permitido por CORS"));
      }
    },
    credentials: true, // necesario si usan cookies o Authorization header con JWT
  }),
);
app.use(express.json());

app.use(router);

app.use(errorHandler);
