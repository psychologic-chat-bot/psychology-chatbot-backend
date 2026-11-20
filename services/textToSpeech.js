import { spawn } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";

export async function synthesizeSpeech(text) {
  const executable = process.env.PIPER_EXECUTABLE || "piper";
  const model = process.env.PIPER_MODEL;

  if (!model) {
    throw new Error("PIPER_MODEL no está configurado.");
  }

  const directory = await mkdtemp(
    path.join(os.tmpdir(), "psychology-chatbot-tts-")
  );
  const outputPath = path.join(directory, "reply.wav");

  try {
    await runPiper(executable, model, outputPath, text);
    const audio = await readFile(outputPath);

    if (audio.length === 0) {
      throw new Error("Piper generó un archivo de audio vacío.");
    }

    return audio;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runPiper(executable, model, outputPath, text) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(
      executable,
      ["--model", model, "--output_file", outputPath],
      { stdio: ["pipe", "ignore", "pipe"] }
    );
    let stderr = "";
    let timeoutError;
    const timeout = setTimeout(() => {
      timeoutError = new Error("Piper excedió el tiempo máximo de síntesis.");
      childProcess.kill();
    }, Number(process.env.PIPER_TIMEOUT_MS) || 30000);

    childProcess.stderr.setEncoding("utf8");
    childProcess.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    childProcess.on("error", (error) => {
      clearTimeout(timeout);
      reject(
        error.code === "ENOENT"
          ? new Error(
              `No se encontró Piper en '${executable}'. Configura PIPER_EXECUTABLE.`
            )
          : error
      );
    });
    childProcess.on("close", (code) => {
      clearTimeout(timeout);
      if (timeoutError) {
        reject(timeoutError);
        return;
      }

      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Piper terminó con el código ${code}: ${stderr.trim() || "sin detalles"}`
          )
        );
      }
    });

    childProcess.stdin.on("error", (error) => {
      if (error.code !== "EPIPE" && !timeoutError) {
        clearTimeout(timeout);
        reject(error);
      }
    });
    childProcess.stdin.end(text);
  });
}
