import fs from "fs/promises";
import path from "path";

export async function createSessionProgress(progressPath) {
  let sessionProgress = await loadSessionProgress(progressPath);
  const approvalLocks = new Set();

  function getCurrentSession(userId, patient) {
    return sessionProgress.get(getProgressKey(userId, patient.id)) || 1;
  }

  async function changeSessionProgress(userId, patient, expectedSession, nextSession) {
    const progressKey = getProgressKey(userId, patient.id);

    if (approvalLocks.has(progressKey)) {
      return {
        status: 409,
        body: { error: "This session is already being changed" },
      };
    }

    approvalLocks.add(progressKey);

    try {
      const currentSession = getCurrentSession(userId, patient);

      if (expectedSession !== currentSession) {
        return {
          status: 409,
          body: {
            error: "The active session changed. Refresh the session status before continuing.",
            currentSession,
          },
        };
      }

      const nextProgress = new Map(sessionProgress);
      if (nextSession === 1) {
        nextProgress.delete(progressKey);
      } else {
        nextProgress.set(progressKey, nextSession);
      }

      await saveSessionProgress(progressPath, nextProgress);
      sessionProgress = nextProgress;

      return {
        status: 200,
        body: {
          currentSession: nextSession,
          totalSessions: patient.sessions.length,
          title: patient.sessions[nextSession - 1].title,
          isLastSession: nextSession === patient.sessions.length,
        },
      };
    } catch (error) {
      console.error("Error saving session progress:", error);
      return {
        status: 500,
        body: { error: "Could not save session progress" },
      };
    } finally {
      approvalLocks.delete(progressKey);
    }
  }

  return { getCurrentSession, changeSessionProgress };
}

async function loadSessionProgress(progressPath) {
  try {
    const savedProgress = await fs.readFile(progressPath, "utf-8");
    const parsedProgress = JSON.parse(savedProgress);

    if (!parsedProgress || typeof parsedProgress !== "object" || Array.isArray(parsedProgress)) {
      throw new Error("Saved session progress must be a JSON object");
    }

    return new Map(Object.entries(parsedProgress));
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

async function saveSessionProgress(progressPath, progress) {
  const directory = path.dirname(progressPath);
  const temporaryPath = `${progressPath}.${process.pid}.tmp`;

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    temporaryPath,
    JSON.stringify(Object.fromEntries(progress), null, 2),
    "utf-8"
  );
  await fs.rename(temporaryPath, progressPath);
}

function getProgressKey(userId, patientId) {
  return JSON.stringify([userId, patientId]);
}
