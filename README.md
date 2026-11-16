# Psychology Chatbot

Chatbot de paciente virtual que usa Ollama para generar respuestas localmente.
Las conversaciones y los documentos de pacientes se procesan desde el servidor
del proyecto; no se necesita una clave de Gemini.

## Requisitos

- [Ollama](https://ollama.com/download) instalado y en ejecución.
- [Bun](https://bun.sh/) instalado.

## Configuración

Descarga el modelo recomendado:

```bash
ollama pull qwen2.5:3b
```

Instala las dependencias e inicia el servidor:

```bash
bun install
bun run dev
```

Abre [http://localhost:3000](http://localhost:3000). Ollama debe estar
disponible en `http://localhost:11434`; en Windows normalmente queda en
ejecución después de iniciar la aplicación de Ollama. Si hace falta, inicia el
servicio manualmente con `ollama serve`.

## Configuración opcional

Puedes definir estas variables de entorno para usar otra instancia o modelo:

- `OLLAMA_URL`: URL base de Ollama. Por defecto, `http://localhost:11434`.
- `OLLAMA_MODEL`: nombre del modelo instalado en Ollama. Por defecto,
  `qwen2.5:3b`.
- `HOST`: interfaz de red en la que escucha el backend. Por defecto,
  `0.0.0.0` para permitir conexiones desde Unity en otro dispositivo.
- `PORT`: puerto HTTP del backend. Por defecto, `3000`.

Por ejemplo, en PowerShell:

```powershell
$env:OLLAMA_MODEL = "llama3.2"
bun run dev
```

## Integración con Unity

El backend expone una API HTTP/JSON. Unity debe enviar el texto del psicólogo a
`POST /chat` y mostrar el campo `reply`, que contiene la respuesta del paciente:

```json
{
  "userId": "usuario-1",
  "patientId": "shared_conversation_Valentina",
  "message": "¿Qué te trae hoy a consulta?"
}
```

Respuesta:

```json
{
  "reply": "Últimamente me he sentido preocupada...",
  "profile": {
    "key": "shared_conversation_Valentina",
    "name": "Valentina Gómez"
  },
  "session": 1
}
```

`patientId` se obtiene de `GET /patients`. Mantén un `userId` estable para
conservar el historial y el progreso de sesión; `message` es el texto del
psicólogo.

Configura en Unity una URL base para el componente cliente (por ejemplo, como
campo serializado en el Inspector) y úsala para todos los endpoints:

| Dónde corre Unity | URL base si el backend está en el equipo indicado |
| --- | --- |
| Editor o build de escritorio, en el mismo equipo que el backend | `http://localhost:3000` |
| Emulador Android estándar, backend en el equipo anfitrión | `http://10.0.2.2:3000` |
| Dispositivo físico u otro equipo de la red local | `http://<IP-LAN-del-equipo-backend>:3000` |
| Unity WebGL servido desde este backend | La misma dirección desde la que se abrió la página |

`localhost` siempre significa «este mismo dispositivo» desde la perspectiva de
Unity; en un teléfono no apunta al PC. La IP de la tabla debe ser la del equipo
que ejecuta el backend, y este debe estar accesible por la red y permitido en
el firewall. El backend escucha en todas las interfaces por defecto; se puede
restringir con `HOST` si solo se necesita acceso local. La interfaz web usa
rutas relativas y, por tanto, se conecta automáticamente al servidor que la
sirvió. El backend actualmente permite solicitudes CORS desde cualquier origen;
antes de desplegarlo, limita esa configuración a los orígenes WebGL confiables.

## Dictado por voz

En el chat, pulsa el botón del micrófono y habla en español. El mensaje se envía
automáticamente después de tres segundos de silencio; también puedes pulsar el
micrófono para detener el dictado sin enviarlo automáticamente. El dictado usa
la API de reconocimiento de voz del navegador y está disponible en navegadores
compatibles, como Chrome y Edge. Según el navegador, el reconocimiento puede
requerir conexión a Internet y el audio puede ser procesado por un servicio del
navegador; no se garantiza que el dictado sea local.
