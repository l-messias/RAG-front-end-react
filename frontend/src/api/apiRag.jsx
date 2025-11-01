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

      let sseBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        sseBuffer += chunk;

        // Procura eventos completos separados por linha em branco (LF-LF ou CRLF-CRLF)
        let sepIndex;
        while ((sepIndex = sseBuffer.search(/\r?\n\r?\n/)) !== -1) {
          // determine exact separator length (2 for \n\n, 4 for \r\n\r\n)
          const maybeSep = sseBuffer.slice(sepIndex, sepIndex + 4);
          const sepLen = maybeSep.startsWith("\r\n\r\n") ? 4 : 2;
          const eventStr = sseBuffer.slice(0, sepIndex);
          sseBuffer = sseBuffer.slice(sepIndex + sepLen);

          console.log(
            "Eventstr bruto:",
            JSON.stringify(eventStr).replace(/\n/g, "\\n")
          );

          const lines = eventStr.split(/\r?\n/);
          let eventName = null;
          const dataParts = [];

          for (const line of lines) {
            if (!line) continue;
            const evMatch = line.match(/^event:\s*(.*)/i);
            if (evMatch) {
              eventName = evMatch[1]?.trim();
              continue;
            }
            const dataMatch = line.match(/^data:\s?(.*)$/i);
            if (dataMatch) {
              dataParts.push(dataMatch[1] ?? "");
            }
          }

          let dataPayload = dataParts.join("\n");

          if (
            !dataPayload ||
            dataPayload.trim() === "[DONE]" ||
            (eventName && eventName.toLowerCase() === "end")
          ) {
            continue; // ignora controle
          }

          // remove apenas UM par de \n\n no final
          dataPayload = dataPayload.replace(/(\r?\n){2}$/, "");

          console.log(
            "[apiRag] chunk limpo:",
            JSON.stringify(dataPayload).replace(/\n/g, "\\n")
          );

          assistantMsg += dataPayload;
          onChunk?.(assistantMsg);
        }
      }

      // Flush restante do buffer
      if (sseBuffer && sseBuffer.trim()) {
        const dataRegex = /(?:^|\r?\n)data:\s?(.*?)(?=(?:\r?\n|$))/gs;
        let m;
        while ((m = dataRegex.exec(sseBuffer)) !== null) {
          let part = m[1] ?? "";
          if (!part || part.trim() === "[DONE]") continue;

          part = part.replace(/(\r?\n){2}$/, "");
          console.log(
            "[apiRag] chunk limpo (flush):",
            JSON.stringify(part).replace(/\n/g, "\\n")
          );

          assistantMsg += part;
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
