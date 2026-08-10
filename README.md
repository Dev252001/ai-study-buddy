# AI-Powered Study Buddy

<div align="center">

![AI Study Buddy](https://img.shields.io/badge/AI-Study%20Buddy-blue?style=for-the-badge&logo=graduation-cap)
![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?style=for-the-badge&logo=typescript)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Build](https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge)

**A full-stack AI-powered study platform — upload your documents and learn faster with RAG-based chat, AI quizzes, flashcards, summaries, and analytics.**

[Features](#-features) · [Tech Stack](#-tech-stack) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [API Docs](#-api-documentation) · [Deployment](#-deployment)

</div>

---

## 🎯 Overview

AI Study Buddy is a production-ready, full-stack SaaS application that transforms how students learn. Upload your study materials (PDF, DOCX, PPTX, TXT, Markdown) and interact with an intelligent AI tutor powered by **Retrieval-Augmented Generation (RAG)**. Every answer is grounded in your own documents with cited sources — no hallucinations.

The frontend is built with **React 18 + TypeScript + Vite**, fully type-safe and lint-clean, with a polished dark/light UI using Tailwind CSS and Radix UI primitives. The backend is a **FastAPI** async API backed by PostgreSQL, ChromaDB, and Redis, supporting multiple LLM providers out of the box.

---

## ✨ Features

### 📄 Document Processing
- Upload PDF, DOCX, PPTX, TXT, and Markdown files
- Drag-and-drop multi-file upload
- OCR for scanned PDFs (Tesseract)
- Automatic text extraction, chunking, and embedding
- Real-time processing status

### 🤖 AI Study Chat
- RAG-based Q&A that cites sources from your documents
- Multiple modes: Document Mode, General, Explain, Summarize
- Chat session history
- Voice input (Web Speech API)
- Markdown rendering with code highlighting

### 📝 AI Summarizer
- Short Overview, Detailed Summary, Bullet Points
- One-Page Notes, Exam Revision Notes
- Export to PDF, DOCX, Markdown

### 🧪 Quiz Generator
- MCQ, True/False, Fill in Blanks, Short Answer
- Easy, Medium, Hard difficulty
- Interactive quiz-taking with results
- Per-question feedback and explanations

### 🃏 Flashcards
- AI-generated question/answer cards
- 3D flip animation
- Spaced repetition tracking (Got It / Didn't Know)
- Progress tracking per session

### 🔍 Semantic Search
- Search across all uploaded documents
- Relevance scores
- Expandable result excerpts

### 🧠 AI Tools
- Concept Explainer (Beginner → Advanced)
- Mind Map generation
- Study Plan with exam date
- Formula Sheet extraction
- Glossary generation

### 📊 Analytics Dashboard
- Study hours tracking
- Quiz score trends
- Document count
- Study streak
- Weekly activity charts

### 🔐 Authentication
- JWT-based auth (access + refresh tokens)
- Secure password hashing (bcrypt)
- Forgot/Reset password via email
- Profile management

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, ShadCN UI, Framer Motion, Recharts |
| **Backend** | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic |
| **AI/ML** | LangChain, LangGraph, Sentence Transformers, RAG |
| **LLM** | OpenAI GPT-4o, IBM Granite (watsonx.ai), Llama 3 (Ollama), Mistral |
| **Vector DB** | ChromaDB |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis |
| **Document Processing** | PyMuPDF, pdfplumber, python-docx, python-pptx, Tesseract OCR |
| **Deployment** | Docker, Docker Compose, Nginx |
| **CI/CD** | GitHub Actions |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/ai-study-buddy.git
cd ai-study-buddy
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Start the application
```bash
docker-compose up -d
```

### 4. Run database migrations
```bash
docker-compose exec backend alembic upgrade head
```

### 5. (Optional) Seed sample data
```bash
docker-compose exec backend python scripts/seed_data.py
```

### 6. Access the application
| Service | URL |
|---------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│                    React + TypeScript                       │
│              Vite · Tailwind · Framer Motion               │
└─────────────────────────────────────────────────────────────┘
                          │ HTTP/REST
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (Port 80)                          │
│           Static Files + API Proxy → :8000                 │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  FastAPI (Port 8000)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Auth   │  │Documents │  │   Chat   │  │  Quiz    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Flashcards│  │Summaries │  │ Search   │  │Analytics │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                  AI Pipeline                        │  │
│  │  RAGService → EmbeddingService → VectorStoreService │  │
│  │  LLMService (OpenAI / IBM / Ollama / Mistral)       │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                  │                   │
         ▼                  ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│  PostgreSQL  │  │   ChromaDB   │  │      Redis       │
│  (Port 5432) │  │  (Port 8001) │  │   (Port 6379)    │
└──────────────┘  └──────────────┘  └──────────────────┘
```

### RAG Pipeline

```
User Question
     │
     ▼
Embed Query (SentenceTransformer all-MiniLM-L6-v2)
     │
     ▼
Vector Search (ChromaDB cosine similarity)
     │
     ▼
Retrieve Top-K Chunks (from user's documents)
     │
     ▼
Build Context + Chat History
     │
     ▼
LLM Generation (GPT-4o / Granite / Llama / Mistral)
     │
     ▼
Extract Citations + Format Response
     │
     ▼
Return Answer with Sources
```

---

## 📁 Project Structure

```
ai-study-buddy/
├── backend/
│   ├── app/
│   │   ├── api/v1/routers/      # FastAPI route handlers
│   │   │   ├── auth.py
│   │   │   ├── documents.py
│   │   │   ├── chat.py
│   │   │   ├── quiz.py
│   │   │   ├── flashcards.py
│   │   │   ├── summaries.py
│   │   │   ├── analytics.py
│   │   │   ├── search.py
│   │   │   ├── export.py
│   │   │   └── health.py
│   │   ├── core/                # Configuration & utilities
│   │   │   ├── config.py        # Pydantic settings
│   │   │   ├── security.py      # JWT + password hashing
│   │   │   ├── database.py      # SQLAlchemy async
│   │   │   ├── deps.py          # FastAPI dependencies
│   │   │   ├── exceptions.py    # Custom exceptions
│   │   │   └── logging.py       # structlog configuration
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # Business logic layer
│   │   │   ├── auth_service.py
│   │   │   ├── document_service.py
│   │   │   ├── document_processors/
│   │   │   ├── chunking_service.py
│   │   │   ├── embedding_service.py
│   │   │   ├── vector_store_service.py
│   │   │   ├── llm_service.py   # Multi-provider LLM
│   │   │   ├── rag_service.py
│   │   │   ├── chat_service.py
│   │   │   ├── quiz_service.py
│   │   │   ├── flashcard_service.py
│   │   │   ├── summary_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── export_service.py
│   │   └── main.py
│   ├── alembic/                 # Database migrations
│   ├── tests/                   # Pytest test suite
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/          # Sidebar, Header, Layout
│   │   │   ├── ui/              # ShadCN-style components
│   │   │   └── shared/          # Reusable components
│   │   ├── contexts/            # React contexts (Auth, Theme)
│   │   ├── hooks/               # React Query hooks
│   │   ├── lib/                 # API client, utilities
│   │   ├── pages/               # Route pages
│   │   └── types/               # TypeScript definitions
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── Dockerfile
├── scripts/
│   ├── setup.sh
│   ├── reset_db.sh
│   └── seed_data.py
├── .github/workflows/           # CI/CD
├── docker-compose.yml
├── docker-compose.dev.yml
├── Makefile
└── README.md
```

---

## ⚙️ Configuration

### LLM Provider Selection

Set `LLM_PROVIDER` in your `.env` file:

| Provider | Value | Required Keys |
|----------|-------|---------------|
| OpenAI GPT-4o | `openai` | `OPENAI_API_KEY` |
| IBM Granite (watsonx.ai) | `ibm_granite` | `IBM_API_KEY`, `IBM_PROJECT_ID` |
| Llama 3 via Ollama | `llama3` | `OLLAMA_BASE_URL` |
| Mistral | `mistral` | `MISTRAL_API_KEY` |

### Environment Variables

See [`.env.example`](.env.example) for all configuration options.

Key variables:
```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/studybuddy
CHROMADB_HOST=chromadb
EMBEDDING_MODEL=all-MiniLM-L6-v2
SECRET_KEY=your-secret-key-here
```

---

## 🔌 API Documentation

The API is fully documented with OpenAPI/Swagger.

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Core Endpoints

```
POST   /api/v1/auth/register          Register new user
POST   /api/v1/auth/login             Login
GET    /api/v1/auth/me                Get current user

POST   /api/v1/documents/             Upload documents
GET    /api/v1/documents/             List documents
DELETE /api/v1/documents/{id}         Delete document

POST   /api/v1/chat/message           Send message (RAG)
GET    /api/v1/chat/sessions          List chat sessions

POST   /api/v1/quiz/generate          Generate quiz
POST   /api/v1/quiz/attempt           Submit quiz answers

POST   /api/v1/flashcards/generate    Generate flashcards
POST   /api/v1/flashcards/review      Review a card

POST   /api/v1/summaries/summarize    Generate summary
POST   /api/v1/summaries/explain      Explain concept

POST   /api/v1/search/                Semantic search

GET    /api/v1/analytics/             User analytics
GET    /api/v1/analytics/progress     Progress data
```

---

## 🚢 Deployment

### Production with Docker Compose

```bash
# 1. Copy and configure environment
cp .env.example .env
nano .env  # Add your API keys

# 2. Build and start all services
docker-compose up -d --build

# 3. Run migrations
docker-compose exec backend alembic upgrade head

# 4. Check health
curl http://localhost:8000/api/v1/health/
```

### Development Mode

```bash
# Start with hot-reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Using Makefile

```bash
make up          # Start production
make dev         # Start development
make migrate     # Run migrations
make seed        # Seed sample data
make test-backend  # Run backend tests
make logs        # Tail logs
make down        # Stop all services
```

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest tests/ -v --cov=app --cov-report=html

# Or via Docker
docker-compose exec backend pytest tests/ -v
```

---

## 🔧 Development Setup (without Docker)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Start PostgreSQL and ChromaDB (or use docker-compose for just those)
docker-compose up -d postgres chromadb redis

# Run migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Starts on http://localhost:5173
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

<div align="center">
Built with ❤️ for students everywhere
</div>
