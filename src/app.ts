import cors from "cors";
import express from "express";

import { errorHandler } from "./middlewares/errorHandler.js";
import { router } from "./routes/index.js";

export const app = express();

const whitelist = ["http://localhost:5173"];
if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim() !== "") {
  whitelist.push(process.env.FRONTEND_URL.trim().replace(/\/$/, ""));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalizedOrigin = origin.replace(/\/$/, "");
      if (whitelist.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        const corsError = Object.assign(new Error("No permitido por CORS"), {
          status: 403,
          code: "CORS_ERROR",
        });
        callback(corsError);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.use(router);

app.use(errorHandler);
