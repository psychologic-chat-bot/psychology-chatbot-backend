import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createApp } from "./app.js";
import { loadDocuments } from "./documents.js";
import { createChatService } from "./services/chatService.js";
import { createSessionProgress } from "./services/sessionProgress.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const documents = await loadDocuments();
const sessionProgress = await createSessionProgress(
  path.join(__dirname, ".data", "session-progress.json")
);
const chatService = createChatService({
  documents,
  getCurrentSession: sessionProgress.getCurrentSession,
});
const app = createApp({ documents, sessionProgress, chatService });

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

app.listen(port, host, () => {
  console.log(`Server listening on ${host}:${port}`);
});
