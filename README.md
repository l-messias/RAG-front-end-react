# 🧠 NAC RAG Chatbot — Faculdade Engenheiro Salvador Arena

Projeto de **Retrieval-Augmented Generation (RAG)** desenvolvido como Trabalho de Conclusão de Curso (TCC) pelos alunos de Engenharia de Computação da **Faculdade Engenheiro Salvador Arena (FESA)** — 2025.

O sistema consiste em um **chatbot inteligente** com integração a modelos de linguagem (OpenAI) e cache semântico (Redis), atuando como assistente virtual de carreiras do NAC (Núcleo de Apoio à Carreira).

---

## 🚀 Como executar o projeto localmente

### 1️⃣ Clonar o repositório

```bash
git clone https://github.com/<seu-usuario>/<seu-repo>.git
cd <seu-repo>
```

---

### 2️⃣ Backend — Configuração do ambiente

Entre na pasta do backend:

```bash
cd backend
```

Crie um arquivo `.env` com as seguintes variáveis (sem preencher com as chaves reais):

```bash
# ==============================
# BACKEND .ENV - NAC RAG FUNCTION PROXY
# ==============================

# Azure Function endpoint para o RAG principal
LINK_API_RAG="..."
X_FUNCTIONS_KEY_RAG="..."

# Redis (cache semântico)
REDIS_HOST="..."
REDIS_PORT="..."
REDIS_PASSWORD="..."

# OpenAI credentials e modelos
OPENAI_EMBEDDING_KEY="..."
OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
OPENAI_LLM_KEY="..."
OPENAI_LLM_MODEL="gpt-4o"
URL_LLM="https://api.openai.com/v1"

# Cache APIs
STORE_CACHE_ENDPOINT="..."
SEMANTIC_CACHE_ENDPOINT="..."

# Parâmetros padrão de inferência
TOP_N="10"
DO_SAMPLE="true"
MAX_TOKENS="1000"
TEMPERATURE="0.7"
TOP_P="0.95"
FREQUENCY_PENALTY="0"
PRESENCE_PENALTY="0"

# Prompt inicial
DEFAULT_PROMPT="Você é a assistente virtual de carreiras do NAC. Responda em português, com empatia e clareza, e seja objetiva ao orientar o usuário."

# Serviços auxiliares
AZURE_STORAGE_CONNECTION_STRING="..."
CONTAINER_NAME="tccblob"

LINK_API_UPLOAD_FILE="..."
LINK_API_DELETE_FILE="..."

# App Insights (telemetria opcional)
APPLICATIONINSIGHTS_CONNECTION_STRING="..."
APPLICATIONINSIGHTSAGENT_EXTENSION_VERSION="~3"
ASPNETCORE_ENVIRONMENT="Development"
```

---

### 3️⃣ Frontend — Configuração do ambiente

Entre na pasta `frontend`:

```bash
cd ../frontend
```

Crie um arquivo `.env` com o seguinte conteúdo:

```bash
VITE_API_BASE_URL="http://localhost:3000"
```

---

### 4️⃣ Instalar dependências

Na raiz do projeto, rode os comandos:

```bash
cd backend && npm install
cd ../frontend && npm install
```

---

### 5️⃣ Executar em modo desenvolvedor

De **qualquer uma das duas pastas** (`backend` ou `frontend`), execute:

```bash
npm run dev:all
```

Esse comando inicia **o backend e o frontend simultaneamente** em modo desenvolvedor.

---

## 🧩 Estrutura do projeto

```
📁 projeto-nac-rag/
├── 📁 backend/        # Servidor Node.js (proxy RAG + cache semântico)
│   ├── .env           # Variáveis de ambiente do backend
│   ├── package.json
│   └── ...
│
├── 📁 frontend/       # Aplicação React (interface do chatbot)
│   ├── .env           # Variáveis de ambiente do frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── Chatbot.jsx
│   │   └── App.jsx
│   ├── public/
│   │   └── chatbot.png
│   └── package.json
│
└── README.md
```

---

## 👨‍💻 Autores

Aplicação desenvolvida por:

- **Caio Municelli**
- **Lorenzo Messias**
- **Luiz de Souza**
- **Ricardo Duarte**

🗓 **2025 — Curso de Engenharia de Computação**
🏫 **Faculdade Engenheiro Salvador Arena**

---

## ⚙️ Tecnologias principais

- **Node.js / Express** — backend e proxy RAG
- **React + Vite + MUI** — interface do chatbot
- **Redis** — cache semântico
- **OpenAI GPT-4o** — modelo de linguagem principal
- **Azure Functions / Storage** — camada de integração e persistência

---

## 📄 Licença

Todos os direitos reservados © 2025  
**Projeto acadêmico — uso educacional.**
