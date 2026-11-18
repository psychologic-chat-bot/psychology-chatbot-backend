import { Router } from "express";
import { getPatientDocument, listPatients } from "../documents.js";

function isValidUserId(userId) {
  return typeof userId === "string" && userId.length > 0 && userId.length <= 128;
}

export function createPatientRouter({ documents, sessionProgress, chatService }) {
  const router = Router();

  router.get(["/patients", "/documents"], (req, res) => {
    res.json({
      patients: listPatients(documents),
    });
  });

  router.get("/patients/:patientId/progress", (req, res) => {
    const { patientId } = req.params;
    const userId = req.query.userId;
    const patient = getPatientDocument(documents, patientId);

    if (!patient?.sessions) {
      return res.status(404).json({ error: "Patient sessions not found" });
    }

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }

    const currentSession = sessionProgress.getCurrentSession(userId, patient);

    if (currentSession > patient.sessions.length) {
      return res.status(409).json({ error: "Saved session progress is invalid" });
    }

    res.json({
      currentSession,
      totalSessions: patient.sessions.length,
      title: patient.sessions[currentSession - 1].title,
      isLastSession: currentSession === patient.sessions.length,
    });
  });

  router.post("/patients/:patientId/approve-session", async (req, res) => {
    const { patientId } = req.params;
    const { userId, currentSession: approvedSession } = req.body;
    const patient = getPatientDocument(documents, patientId);

    if (!patient?.sessions) {
      return res.status(404).json({ error: "Patient sessions not found" });
    }

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }

    const currentSession = sessionProgress.getCurrentSession(userId, patient);

    if (approvedSession !== currentSession) {
      return res.status(409).json({
        error: "The active session changed. Refresh the session status before approving.",
        currentSession,
      });
    }

    if (currentSession >= patient.sessions.length) {
      return res.status(409).json({ error: "There are no more sessions to approve" });
    }

    const result = await changeProgressAndClearConversation(
      sessionProgress,
      chatService,
      userId,
      patient,
      approvedSession,
      currentSession + 1
    );
    res.status(result.status).json(result.body);
  });

  router.post("/patients/:patientId/rewind-session", async (req, res) => {
    const { patientId } = req.params;
    const { userId, currentSession: expectedSession } = req.body;
    const patient = getPatientDocument(documents, patientId);

    if (!patient?.sessions) {
      return res.status(404).json({ error: "Patient sessions not found" });
    }

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }

    const currentSession = sessionProgress.getCurrentSession(userId, patient);
    if (expectedSession !== currentSession) {
      return res.status(409).json({
        error: "The active session changed. Refresh the session status before continuing.",
        currentSession,
      });
    }

    if (currentSession <= 1) {
      return res.status(409).json({ error: "Already at the first session" });
    }

    const result = await changeProgressAndClearConversation(
      sessionProgress,
      chatService,
      userId,
      patient,
      expectedSession,
      currentSession - 1
    );
    res.status(result.status).json(result.body);
  });

  router.post("/patients/:patientId/reset-progress", async (req, res) => {
    const { patientId } = req.params;
    const { userId, currentSession: expectedSession } = req.body;
    const patient = getPatientDocument(documents, patientId);

    if (!patient?.sessions) {
      return res.status(404).json({ error: "Patient sessions not found" });
    }

    if (!isValidUserId(userId)) {
      return res.status(400).json({ error: "Valid userId is required" });
    }

    const result = await changeProgressAndClearConversation(
      sessionProgress,
      chatService,
      userId,
      patient,
      expectedSession,
      1
    );
    res.status(result.status).json(result.body);
  });

  return router;
}

async function changeProgressAndClearConversation(
  sessionProgress,
  chatService,
  userId,
  patient,
  expectedSession,
  nextSession
) {
  const result = await sessionProgress.changeSessionProgress(
    userId,
    patient,
    expectedSession,
    nextSession
  );

  if (result.status === 200) {
    chatService.clearConversation(userId, patient.id);
  }

  return result;
}
