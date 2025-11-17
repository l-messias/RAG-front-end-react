const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const STREAM_PATH = "/chat";
const RETURN_PATH = "/api/returnMessage";

function buildUrl(path) {
  if (!BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path}`;
}

export async function newSession() {
  const url = buildUrl("/api/new-session");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao criar sessão: ${res.status}`);
  const data = await res.json();
  return data?.clientId;
}

export function streamRag(
  query,
  messages = [],
  { onStart, onChunk, onComplete, onError } = {}
) {
  const url = buildUrl(STREAM_PATH);
  const controller = new AbortController();
  let assistantMsg = "";
  let buffer = "";

  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, messages }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError?.(new Error(`Erro no fetch: ${res.status}`));
        return;
      }

      onStart?.();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        console.log("[frontend] received chunk:", chunk);
        if (!chunk) continue;

        buffer += chunk;
        const events = buffer.split(/(?=event:\send)/g);
        const parts = events[0].split(/(?=data:\s)/g);
        buffer = events.length > 1 && parts.length ? parts.pop() : "";
        console.log("buffer after split:", buffer);
        for (let part of parts) {
          console.log("processing part:", part);
          const dataPayload = part.replace(/^data:\s?/, "");
          if (!dataPayload || dataPayload.trim() === "[DONE]") continue;
          console.log("data payload:", dataPayload);
          const cleanPayload = dataPayload.replace(/\n\n$/, "");

          assistantMsg += cleanPayload;
          onChunk?.(assistantMsg);
        }
      }

      if (buffer.trim()) {
        const events = buffer.split(/(?=event:\send)/g);
        const parts = events[0].split(/(?=data:\s)/g);
        for (let part of parts) {
          // if (/event:\s*end/i.test(part)) continue;
          console.log("processing part buffer:", part);

          const dataPayload = part.replace(/^data:\s?/, "");
          console.log("data payload buffer:", dataPayload);

          if (!dataPayload || dataPayload.trim() === "[DONE]") continue;
          console.log("final data payload:", dataPayload);
          const cleanPayload = dataPayload.replace(/\n\n$/, "");
          assistantMsg += cleanPayload;
        }
      }

      onComplete?.(assistantMsg);
    } catch (err) {
      if (err.name !== "AbortError") onError?.(err);
    }
  })();

  return { close: () => controller.abort() };
}

export async function postReturnMessage(query, clientId) {
  const url = buildUrl(RETURN_PATH);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, clientId }),
  });

  if (!res.ok) throw new Error(`Erro no POST: ${res.status}`);
  return await res.json();
}

export default { newSession, streamRag, postReturnMessage };
