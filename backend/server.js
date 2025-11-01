import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(express.json());

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,https://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: false,
  })
);

app.post("/chat", async (req, res) => {
  const { query, messages } = req.body;

  if (!query) {
    res.status(400).json({ error: "Campo 'query' é obrigatório" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const normalizedMessages = (messages || [])
    .filter((m) => m && m.role && (m.text || m.html))
    .map((m) => ({
      role: m.role,
      content: m.text || m.html || "",
    }));

  const body = {
    redis_host: process.env.REDIS_HOST,
    redis_port: Number(process.env.REDIS_PORT),
    redis_password: process.env.REDIS_PASSWORD,
    openai_embedding_key: process.env.OPENAI_EMBEDDING_KEY,
    openai_embedding_model: process.env.OPENAI_EMBEDDING_MODEL,
    openai_llm_key: process.env.OPENAI_LLM_KEY,
    openai_llm_model: process.env.OPENAI_LLM_MODEL,
    url_llm: process.env.URL_LLM,
    query,
    rule: process.env.DEFAULT_PROMPT,
    store_cache_endpoint: process.env.STORE_CACHE_ENDPOINT,
    semantic_cache_endpoint: process.env.SEMANTIC_CACHE_ENDPOINT,
    request_data: {
      temperature: Number(process.env.TEMPERATURE || 0.7),
      max_tokens: Number(process.env.MAX_TOKENS || 512),
    },
    top_n: Number(process.env.TOP_N || 3),
    messages: normalizedMessages,
  };

  try {
    const response = await fetch(
      `${process.env.LINK_API_RAG}?code=${process.env.X_FUNCTIONS_KEY_RAG}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok || !response.body) {
      res.write(
        `data: ${JSON.stringify({ error: "Erro ao conectar com o RAG" })}\n\n`
      );
      res.end();
      return;
    }

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      try {
        const chunkBuf = Buffer.from(value);
        let asStr;
        try {
          asStr = chunkBuf.toString("utf8");
          console.log(
            "[backend] upstream chunk (string):",
            JSON.stringify(asStr)
          );
        } catch {
          asStr = chunkBuf.toString("latin1");
          console.log(
            "[backend] upstream chunk (binary length):",
            chunkBuf.length
          );
        }

        // match each SSE event block that ends with a blank line (preserve the separator)
        // this keeps internal `data:` line breaks intact and only treats the final
        // delimiter as the event terminator to forward to the client.
        // Match event blocks where the double-newline separator sequence is
        // either immediately followed by a new `data:` line or by end-of-string.
        // We accept multiple separators in a row but forward exactly one \n\n
        const eventBlockRegex =
          /(data:[\s\S]*?)(?:\r?\n\r?\n)+(?=(?:data:|$))/g;
        let matched = false;
        let evMatch;
        while ((evMatch = eventBlockRegex.exec(asStr)) !== null) {
          matched = true;
          const block = evMatch[1];
          // forward block with a single event separator (LF-LF)
          console.log(
            "[backend] sending line as chunk:",
            JSON.stringify(block + "\n\n").replace(/\n/g, "\\n")
          );
          res.write(block + "\n\n");
        }

        // fallback: if regex didn't match (partial chunk without final separator),
        // fall back to splitting on blank lines and forward each data: line (no sep)
        if (!matched) {
          const parts = asStr.split(/\r?\n\r?\n/);
          for (const part of parts) {
            if (part.startsWith("data:")) {
              console.log(
                "[backend] sending (partial) line as chunk:",
                JSON.stringify(part).replace(/\n/g, "\\n")
              );
              res.write(part);
            }
          }
        }
      } catch (err) {
        console.warn("[backend] erro processando chunk:", err?.message || err);
        try {
          res.write(Buffer.from(value));
        } catch (_) {}
      }
    }

    res.end();
  } catch (err) {
    console.error("Erro:", err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy RAG rodando na porta ${PORT}`));
