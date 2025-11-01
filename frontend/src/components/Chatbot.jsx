import React, { useEffect, useRef, useState } from "react";
import {
  Avatar,
  TextField,
  IconButton,
  Typography,
  Stack,
  Paper,
  Box,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import CancelIcon from "@mui/icons-material/Cancel";
import api from "../api/apiRag";
import { marked } from "marked";
import DOMPurify from "dompurify";

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
    return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
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
  const [timings, setTimings] = useState(null);
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
    setTimings(null);
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
        content: DOMPurify.sanitize(marked.parse("<em>Aguardando...</em>")),
        createdAt: new Date().toISOString(),
      },
    ]);

    streamRef.current?.close();
    streamRef.current = api.streamRag(
      q,
      messages.filter((m) => m.role !== "assistant"),
      {
        onChunk: (partial) => {
          if (!firstChunk) firstChunk = Math.round(performance.now() - start);
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.findIndex(
              (m) => m.id === placeholderIdRef.current
            );
            const html = DOMPurify.sanitize(
              marked.parse(String(partial).replace(/^data:\s*/gm, ""), {
                async: false,
              })
            );
            if (idx !== -1) copy[idx] = { ...copy[idx], content: html };
            return copy;
          });
        },
        onComplete: (finalText) => {
          const total = Math.round(performance.now() - start);
          if (!firstChunk) firstChunk = total;
          setTimings({ firstChunk, total });
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.findIndex(
              (m) => m.id === placeholderIdRef.current
            );
            if (idx !== -1) {
              const htmlFinal = DOMPurify.sanitize(
                marked.parse(String(finalText).replace(/^data:\s*/gm, ""))
              );
              copy[idx] = { ...copy[idx], content: htmlFinal };
            }
            return copy;
          });
          setRunning(false);
          placeholderIdRef.current = null;
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
      }
    );
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
                <Typography className="chatbot-message-time">
                  {formatTime(m.createdAt)}
                </Typography>
                {m.id === placeholderIdRef.current && running && <TypingDots />}
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
