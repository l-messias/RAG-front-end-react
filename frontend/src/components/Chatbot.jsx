import React, { useEffect, useRef, useState } from "react";
import { Avatar, IconButton, Typography, Paper, Box } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CancelIcon from "@mui/icons-material/Cancel";
import api from "../api/apiRag";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true });

function TypingDots() {
  return (
    <span className="typing-dots" aria-hidden>
      <span></span>
      <span></span>
      <span></span>
    </span>
  );
}

function formatTime(iso) {
  try {
    const dt = new Date(iso);
    return dt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

// Normaliza listas tipo "1. Texto", garantindo espaço após o ponto
function normalizeNumberedList(text) {
  return text.replace(/([^\n])\s*([0-9]+)\.(\S)/g, "$1\n$2. $3");
}

// Aplica quebra de linha após ponto final grudado com próximo texto
function breakAfterDot(text) {
  return text.replace(/(\S)\.([^\s\n])/g, "$1.\n$2");
}

function parseAdvancedMarkdown(text) {
  let html = text;

  // 1. Normaliza listas numeradas com espaço após o ponto
  html = normalizeNumberedList(html);

  // 2. Quebra de linha depois de pontos finais grudados
  html = breakAfterDot(html);

  // Títulos
  html = html.replace(/^\s*###### (.*)$/gm, "<h6>$1</h6>");
  html = html.replace(/^\s*##### (.*)$/gm, "<h5>$1</h5>");
  html = html.replace(/^\s*#### (.*)$/gm, "<h4>$1</h4>");
  html = html.replace(/^\s*### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^\s*## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^\s*# (.*)$/gm, "<h1>$1</h1>");

  // Negrito e itálico
  html = html.replace(/\*\*\*(.*?)\*\*\*/gim, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>");

  // Links e imagens
  html = html.replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />');
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/gim,
    '<a target="_blank" href="$2">$1</a>'
  );

  // Citação
  html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

  // Linha horizontal <hr>
  html = html.replace(/^\s*---\s*$/gm, "<hr>");

  // Listas não ordenadas
  html = html.replace(
    /^\s*-\s+(.*$)/gim,
    '<ul style="margin-left: 20px;"><li>$1</li></ul>'
  );

  // Unificação de listas
  html = html.replace(/<\/ol>\n<ol>/gim, "");
  html = html.replace(/<\/ul>\n<ul>/gim, "");

  // Quebras de linha
  html = html.replace(/\n\n/gim, "<br>");
  html = html.replace(/\n/gim, '<div style="margin: 0;"></div>');

  return html.trim();
}

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      id: "initial",
      role: "assistant",
      content: DOMPurify.sanitize(
        marked.parse(
          "Olá, eu sou a assistente de carreiras do NAC virtual dos cursos de administração e engenharia de computação, no que posso te ajudar?",
          { async: false }
        )
      ),
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const listRef = useRef(null);
  const streamRef = useRef(null);
  const placeholderIdRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("nac_client_id");
        if (stored) return;
        const id = await api.newSession();
        if (id) localStorage.setItem("nac_client_id", id);
      } catch {}
    })();
    return () => streamRef.current?.close();
  }, []);

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || running) return;

    const start = performance.now();
    let firstChunk = null;
    setInput("");
    setRunning(true);

    const placeholderId = `a_${Date.now()}`;
    placeholderIdRef.current = placeholderId;

    setMessages((prev) => [
      ...prev,
      {
        id: `u_${Date.now()}`,
        role: "user",
        content: q,
        createdAt: new Date().toISOString(),
      },
      {
        id: placeholderId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    streamRef.current?.close();
    streamRef.current = api.streamRag(q, history, {
      onChunk: (partial) => {
        if (!firstChunk) firstChunk = Math.round(performance.now() - start);
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((m) => m.id === placeholderIdRef.current);
          if (idx !== -1) {
            copy[idx] = {
              ...copy[idx],
              content: DOMPurify.sanitize(parseAdvancedMarkdown(partial)),
            };
          }
          return copy;
        });
      },
      onComplete: (finalText) => {
        const total = Math.round(performance.now() - start);
        if (!firstChunk) firstChunk = total;
        const finalId = placeholderIdRef.current;

        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.findIndex((m) => m.id === finalId);
          if (idx !== -1) {
            copy[idx] = {
              ...copy[idx],
              content: DOMPurify.sanitize(parseAdvancedMarkdown(finalText)),
            };
          }
          return copy;
        });

        placeholderIdRef.current = null;
        setRunning(false);
      },
      onError: () => {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "assistant",
            content: "Erro ao obter resposta.",
            createdAt: new Date().toISOString(),
          },
        ]);
        setRunning(false);
        placeholderIdRef.current = null;
      },
    });
  };

  const handleCancel = () => {
    streamRef.current?.close();
    setRunning(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `b_cancel_${Date.now()}`,
        role: "assistant",
        content: "Transmissão cancelada.",
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  return (
    <Box className="chatbot-container">
      <Box className="chatbot-header">Assistente NAC — Carreiras</Box>
      <Paper
        className="chatbot-content"
        ref={listRef}
        sx={{ background: "transparent" }}
      >
        {messages.map((m) => (
          <Box
            key={m.id}
            className={
              m.role === "user" ? "chatbot-message-user" : "chatbot-message"
            }
          >
            <Box display="flex" gap={1} alignItems="flex-start">
              {m.role === "assistant" && (
                <Avatar className="chatbot-avatar" src="/chatbot.png" />
              )}
              <Box>
                <div dangerouslySetInnerHTML={{ __html: m.content }} />
                {m.id === placeholderIdRef.current && running && <TypingDots />}
                <Typography className="chatbot-message-time">
                  {formatTime(m.createdAt)}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Paper>
      <Box className="chatbot-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Digite sua mensagem..."
          disabled={running}
        />
        <IconButton onClick={handleSend} disabled={running || !input.trim()}>
          <SendIcon />
        </IconButton>
        <IconButton onClick={handleCancel} disabled={!running}>
          <CancelIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
