import { getProfile } from "../profiles.js";
import {
  buildDocumentContext,
  getPatientDocument,
} from "../documents.js";
import { synthesizeSpeech } from "./textToSpeech.js";

export function createChatService({ documents, getCurrentSession }) {
  const conversations = {};
  const ollamaUrl = (process.env.OLLAMA_URL || "http://localhost:11434").replace(
    /\/+$/,
    ""
  );
  const ollamaModel = process.env.OLLAMA_MODEL || "qwen2.5:3b";

  async function sendMessage({
    message,
    userId,
    patientId,
    includeAudio = false,
  }) {
    const profile = getProfile("patient");
    const selectedPatient = getPatientDocument(documents, patientId);

    if (!selectedPatient) {
      return {
        status: 404,
        body: { error: "No patient documents available" },
      };
    }

    if (!conversations[userId]) {
      conversations[userId] = {};
    }

    const systemPrompt = getPatientSystemPrompt(
      profile,
      selectedPatient,
      userId,
      getCurrentSession
    );

    if (!conversations[userId][selectedPatient.id]) {
      conversations[userId][selectedPatient.id] = [
        {
          role: "system",
          content: systemPrompt,
        },
      ];
    }

    const conversation = conversations[userId][selectedPatient.id];
    conversation[0] = { role: "system", content: systemPrompt };

    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          conversation[0],
          ...conversation.slice(1),
          { role: "user", content: message },
        ],
        stream: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        status: 502,
        body: {
          error: data?.error || `Ollama respondió con el estado ${response.status}`,
        },
      };
    }

    const reply = data?.message?.content;

    if (!reply) {
      return {
        status: 500,
        body: {
          error: "No reply generated",
          raw: data,
        },
      };
    }

    conversation.push(
      { role: "user", content: message },
      { role: "assistant", content: reply }
    );

    const body = {
      reply,
      profile: {
        key: selectedPatient.id,
        name: selectedPatient.name || selectedPatient.title,
      },
      session: selectedPatient.sessions
        ? getCurrentSession(userId, selectedPatient)
        : undefined,
    };

    if (includeAudio) {
      try {
        const audio = await synthesizeSpeech(reply);
        body.audio = {
          mimeType: "audio/wav",
          data: audio.toString("base64"),
        };
      } catch (error) {
        body.audioError = error.message;
      }
    }

    return {
      status: 200,
      body,
    };
  }

  function clearConversation(userId, patientId) {
    if (conversations[userId] && conversations[userId][patientId]) {
      delete conversations[userId][patientId];
      return true;
    }

    return false;
  }

  return { sendMessage, clearConversation };
}

function getPatientSystemPrompt(profile, patient, userId, getCurrentSession) {
  if (!patient.sessions) {
    const patientContext = buildDocumentContext([patient]);
    return `${profile.systemPrompt}\n\nContexto del paciente seleccionado:\n\n${patientContext}`;
  }

  const currentSession = getCurrentSession(userId, patient);
  const session = patient.sessions.find(({ number }) => number === currentSession);

  if (!session) {
    throw new Error(`No prompt is configured for session ${currentSession}`);
  }

  const patientName = patient.name || patient.title || patient.id;

  return `${session.prompt}

Interpreta exclusivamente a ${patientName} como paciente. El usuario es el psicólogo o terapeuta. Responde en primera persona como paciente; nunca asumas el rol del psicólogo, no dirijas la sesión ni des consejos clínicos.

Responde únicamente dentro de esta sesión activa. No anticipes ni inventes actividades, hechos, respuestas o conclusiones de otras sesiones.`;
}
