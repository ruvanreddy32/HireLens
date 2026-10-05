<p align="center">
  <h1 align="center">HireLens</h1>
  <p align="center">
    <strong>AI-powered technical hiring platform with transparent, 4-pillar candidate evaluation</strong>
  </p>
  <p align="center">
    <em>Built for Engineering Managers, Tech Leads, and Technical Recruiters who need signal — not noise.</em>
  </p>
</p>

<br/>

> **HireLens** replaces opaque ATS keyword matching with a deterministic, multi-dimensional scoring engine. Every candidate is evaluated across **Skills**, **Experience**, **Projects**, and **Proof of Work** — the four pillars that actually predict engineering capability.

---

## ✨ Key Features

| Area | Highlights |
|---|---|
| **4-Pillar Scoring** | Weighted evaluation across Skills, Experience, Projects & Proof of Work with configurable role presets (balanced, skill-heavy, experience-heavy, etc.) |
| **Smart Resume Parsing** | LLM-powered PDF parsing pipeline — extracts structured sections, skills, experience timelines, and project details with schema validation |
| **Cohort Ranking** | Rank an entire applicant pool against a JD in one call, with knockout gates for hard requirements |
| **Dual-Role UX** | Separate Job Seeker and Recruiter dashboards with role-based routing and guards |
| **Async Processing** | Resume uploads flow through S3 → BullMQ → ML service for non-blocking, background parsing |
| **Candidate Insights** | Per-candidate breakdowns with pillar scores, match tier badges, strengths/gaps analysis, and recruiter notes & bookmarks |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│            Vite · React 19 · Redux Toolkit               │
│                  Tailwind CSS · Router                   │
└──────────────────┬──────────────────┬────────────────────┘
                   │  REST API        │
┌──────────────────▼──────────────────▼────────────────────┐
│                    NestJS Backend                         │
│     Auth (JWT) · Jobs · Resumes · Storage (S3)           │
│           Prisma ORM · BullMQ Workers                    │
└────┬──────────────┬─────────────────┬────────────────────┘
     │              │                 │
     ▼              ▼                 ▼
 PostgreSQL      Redis           FastAPI ML
                (Queue)          Service
                              ┌──────────────┐
                              │  PDF Parsing  │
                              │  LLM Extract  │
                              │  4-Pillar     │
                              │  Scorer       │
                              │  Cohort Rank  │
                              └──────────────┘
```

---

## 📂 Project Structure

```
HireLens/
├── frontend/              # React SPA (Vite + Tailwind)
│   └── src/
│       ├── components/    # Layout, UI, recruiter components
│       ├── pages/         # Auth, Job Seeker, Recruiter pages
│       ├── store/         # Redux Toolkit slices
│       ├── router/        # Route definitions & RoleGuard
│       ├── services/      # API service layer
│       └── utils/         # Helpers (PDF, etc.)
│
├── backend/               # NestJS API server
│   ├── prisma/            # Schema & migrations (PostgreSQL)
│   └── src/
│       ├── auth/          # JWT auth (signup, login, guards)
│       ├── jobs/          # CRUD, applications, candidate management
│       ├── resumes/       # Upload, BullMQ processor, parsed data
│       ├── ml/            # ML service HTTP bridge
│       ├── storage/       # S3 file storage adapter
│       └── prisma/        # Prisma client module
│
├── ml/                    # Python ML engine
│   ├── api/               # FastAPI routes & schemas
│   ├── parsing/           # Resume PDF → structured JSON pipeline
│   │   ├── pdf_extractor.py
│   │   ├── text_sanitizer.py
│   │   ├── section_segmenter.py
│   │   ├── experience_parser.py
│   │   ├── llm_segmenter.py
│   │   ├── llm_field_extractor.py
│   │   └── schema_validator.py
│   ├── scoring/           # 4-pillar evaluation engine
│   │   ├── skill_scorer.py
│   │   ├── experience_scorer.py
│   │   ├── project_scorer.py
│   │   ├── proof_of_work_scorer.py
│   │   └── composite_scorer.py
│   ├── resources/         # Patterns, aliases, graph config
│   └── tests/             # Pytest suite for all scorers + API
│
├── docs/                  # Design decisions & UI specs
├── tests/                 # Sample resume PDFs for testing
├── docker-compose.yml     # Redis service
└── .env                   # Root-level env (Groq API config)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, Redux Toolkit, React Router 7, Tailwind CSS 3 |
| **Backend** | NestJS 11, TypeScript, Prisma 7 (PostgreSQL), Passport JWT, BullMQ |
| **ML Service** | Python, FastAPI, Groq LLM API, pdfplumber/PyMuPDF |
| **Queue** | Redis 7 (via BullMQ) |
| **Storage** | AWS S3 |
| **Database** | PostgreSQL |
| **Infra** | Docker Compose (Redis) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **PostgreSQL** running locally or remote
- **Redis** (via Docker or local install)
- **AWS S3** bucket configured (for resume storage)

### 1. Clone & Install

```bash
git clone https://github.com/ruvanreddy32/HireLens.git
cd HireLens
```

### 2. Start Redis

```bash
docker compose up -d
```

### 3. Backend Setup

```bash
cd backend
npm install

# Configure environment
cp .env.example .env   # Edit with your DB URL, JWT secret, AWS creds, etc.

# Run Prisma migrations
npx prisma migrate dev

# (Optional) Seed sample data
node seed.js

# Start dev server (port 3000)
npm run start:dev
```

### 4. ML Service Setup

```bash
# From project root
python -m venv .venv
.venv/Scripts/activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install fastapi uvicorn pdfplumber pydantic httpx

# Configure Groq API key in root .env
# GROQ_API_KEY=your_key_here

# Start ML service (port 8000)
cd backend
npm run start:ml
# — or directly: python -m uvicorn ml.api.main:app --app-dir .. --host 127.0.0.1 --port 8000 --reload
```

### 5. Frontend Setup

```bash
cd frontend
npm install

# Start dev server (port 5173)
npm run dev
```

### 6. Open the App

Navigate to **http://localhost:5173** — login or sign up as a **Job Seeker** or **Recruiter**.

---

## 🔌 API Endpoints

### Backend (NestJS — `localhost:3000`)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/signup` | Register (Job Seeker / Recruiter) |
| `POST` | `/auth/login` | JWT login |
| `GET` | `/jobs` | Browse active jobs |
| `POST` | `/jobs` | Create job posting (Recruiter) |
| `POST` | `/resumes/upload` | Upload resume PDF → S3 + queue |
| `GET` | `/resumes` | List user's resumes |

### ML Service (FastAPI — `localhost:8000`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/presets` | Role presets & match tier thresholds |
| `POST` | `/api/v1/parse-resume` | Parse PDF → structured JSON |
| `POST` | `/api/v1/score` | Score candidate against JD |
| `POST` | `/api/v1/parse-and-score` | Parse + score in one call |
| `POST` | `/api/v1/rank` | Rank candidate cohort against JD |

> Interactive docs available at **http://localhost:8000/docs** (Swagger UI)

---

## 🧪 Running Tests

```bash
# ML engine tests
cd ml
python -m pytest tests/ -v

# Backend tests
cd backend
npm run test
```

---

## 📊 Scoring Model

HireLens evaluates candidates on **4 weighted pillars**:

| Pillar | What It Measures |
|---|---|
| **Skills** | Keyword overlap, semantic similarity, skill-graph expansion, alias resolution |
| **Experience** | Total years, role-level seniority, recency weighting |
| **Projects** | Technical complexity, tech-stack alignment, scale/impact signals |
| **Proof of Work** | Open-source contributions, publications, certifications, conference talks |

Weights are configurable via **role presets** (`balanced`, `skill-heavy`, `experience-heavy`, etc.) or fully custom sliders on the recruiter dashboard. Every score includes a transparent breakdown — no black boxes.

---

## 📄 Environment Variables

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | Backend | PostgreSQL connection string |
| `JWT_SECRET` | Backend | Secret for JWT token signing |
| `ML_SERVICE_URL` | Backend | URL to FastAPI ML service (`http://127.0.0.1:8000`) |
| `STORAGE_DRIVER` | Backend | `s3` or `local` |
| `AWS_S3_BUCKET` | Backend | S3 bucket name |
| `AWS_REGION` | Backend | AWS region |
| `AWS_ACCESS_KEY_ID` | Backend | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | Backend | AWS credentials |
| `REDIS_HOST` | Backend | Redis host (default: `localhost`) |
| `REDIS_PORT` | Backend | Redis port (default: `6379`) |
| `GROQ_API_KEY` | ML | Groq API key for LLM-powered parsing |
| `GROQ_MODEL` | ML | Groq model identifier |

---

