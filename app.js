import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createChatRouter } from "./routes/chatRoutes.js";
import { createPatientRouter } from "./routes/patientRoutes.js";
import { createProfileRouter } from "./routes/profileRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ documents, sessionProgress, chatService }) {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));
  app.use(createProfileRouter());
  app.use(createPatientRouter({ documents, sessionProgress, chatService }));
  app.use(createChatRouter({ documents, sessionProgress, chatService }));

  return app;
}
