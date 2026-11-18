import { Router } from "express";

function isValidUserId(userId) {
  return typeof userId === "string" && userId.length > 0 && userId.length <= 128;
}

export function createChatRouter({ chatService }) {
  const router = Router();

  router.post("/chat", async (req, res) => {
    try {
      const { message, userId = "default-user", patientId } = req.body;

      if (!message) {
        return res.status(400).json({
          error: "No message provided",
        });
      }

      if (!isValidUserId(userId)) {
        return res.status(400).json({
          error: "Valid userId is required",
        });
      }

      const result = await chatService.sendMessage({ message, userId, patientId });
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: error.message,
      });
    }
  });

  router.delete("/chat/:userId/:patientId", (req, res) => {
    const { userId, patientId } = req.params;
    const cleared = chatService.clearConversation(userId, patientId);

    if (cleared) {
      res.json({ message: "Conversation cleared" });
    } else {
      res.status(404).json({ error: "Conversation not found" });
    }
  });

  return router;
}
