# HireLens — System Architecture & Technical Specifications

> **System Overview**: HireLens is an enterprise-grade, distributed technical hiring and candidate evaluation platform. It replaces superficial keyword matching with a multi-dimensional, deterministic evaluation engine backed by asynchronous queue workers, a 6-stage hybrid resume parsing pipeline, and a resilient distributed architecture.

---

## Table of Contents
1. [High-Level System Topology](#1-high-level-system-topology)
2. [Asynchronous Ingestion & Distributed Job Processing](#2-asynchronous-ingestion--distributed-job-processing)
3. [Fault Tolerance, Exponential Backoff & DLQ Lifecycle](#3-fault-tolerance-exponential-backoff--dlq-lifecycle)
4. [6-Stage Hybrid Resume Parsing Pipeline](#4-6-stage-hybrid-resume-parsing-pipeline)
5. [4-Pillar Deterministic Scoring Engine & Cohort Ranking](#5-4-pillar-deterministic-scoring-engine--cohort-ranking)
6. [Resume & Application State Machine](#6-resume--application-state-machine)
7. [Authentication, RBAC & Multi-Tenant Security](#7-authentication-rbac--multi-tenant-security)
8. [Data Persistence & Entity Relational Schema](#8-data-persistence--entity-relational-schema)
9. [Operational Considerations & Latency Budgets](#9-operational-considerations--latency-budgets)
10. [Technology Stack Summary](#10-technology-stack-summary)

---

## 1. High-Level System Topology

HireLens is architected as a **decoupled 3-tier distributed system** designed for horizontal scalability, fault isolation, and independent deployment cycles.

```mermaid
flowchart TD
    subgraph Client_Tier["1. Client Tier (React SPA)"]
        UI["React 19 Frontend<br/>Vite · Redux Toolkit · Tailwind CSS<br/>Job Seeker & Recruiter Dashboards"]
    end

    subgraph API_Tier["2. API Gateway & Orchestration (NestJS)"]
        Gateway["NestJS API Application"]
        AuthModule["Auth & RBAC Module<br/>(JWT Guard + RolesGuard)"]
        JobsModule["Jobs & Matchmaking<br/>(Knockouts + Tenancy)"]
        ResumeModule["Resume Ingestion Service<br/>(MIME & Size Validation)"]
        StorageAdapter["Storage Adapter<br/>(AWS S3 / MinIO Driver)"]
        QueueProducer["BullMQ Queue Producer<br/>(resume-parse-queue)"]
        AdminDLQ["Admin DLQ Controller<br/>(Inspect, Replay, Purge)"]
    end

    subgraph Data_Tier["3. Persistence & Cache Tier"]
        PostgreSQL[("PostgreSQL 16<br/>(Prisma ORM - Structured Data,<br/>Users, Jobs, Scores, Applications)")]
        RedisQueue[("Redis 7 (BullMQ Engine)<br/>Job Queues, Locks & DLQ Storage")]
        ObjectStore[("AWS S3 / MinIO<br/>Raw PDF & Extracted Artifacts")]
    end

    subgraph Worker_Tier["4. Asynchronous Execution Tier"]
        BullWorker["NestJS BullMQ Worker Process<br/>(Concurrency: 5, Exponential Retry)"]
    end

    subgraph ML_Tier["5. Machine Learning Service (FastAPI)"]
        MLApi["FastAPI REST Microservice"]
        ParsingEngine["6-Stage Hybrid Parser<br/>(pdfplumber + Heuristics + Fallback)"]
        ScoringEngine["4-Pillar Scorer<br/>(Skills, Experience, Projects, Proof of Work)"]
        CohortRanker["Cohort Ranker<br/>(Knockout Gates + Normalization)"]
        GroqLLM["Groq Llama-3 Cloud<br/>(Structured Extraction Fallback)"]
    end

    UI -->|"HTTPS / REST (JWT Bearer)"| Gateway
    Gateway --> AuthModule
    Gateway --> JobsModule
    Gateway --> ResumeModule
    Gateway --> AdminDLQ
    ResumeModule --> StorageAdapter
    ResumeModule --> QueueProducer
    StorageAdapter -->|"PutObject / GetObject"| ObjectStore
    QueueProducer -->|"Enqueue Jobs"| RedisQueue
    JobsModule -->|"Prisma Client"| PostgreSQL
    AuthModule -->|"Prisma Client"| PostgreSQL
    RedisQueue -->|"Poll / Claim Lock"| BullWorker
    BullWorker -->|"Stream File & Context"| MLApi
    MLApi --> ParsingEngine
    MLApi --> ScoringEngine
    MLApi --> CohortRanker
    ParsingEngine -.->|"Conditional Fallback"| GroqLLM
    BullWorker -->|"Update Parse Status & Payload"| PostgreSQL
    AdminDLQ <-->|"Inspect Failed Jobs & Replay"| RedisQueue
```

---

## 2. Asynchronous Ingestion & Distributed Job Processing

Resume parsing and multi-candidate scoring are compute-heavy operations (PDF geometric analysis, OCR, LLM inference). To preserve a sub-100ms API response time, document ingestion is completely decoupled from parsing execution via an asynchronous message queue.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client (Job Seeker / Recruiter)
    participant UI as React Frontend
    participant API as NestJS ResumesController
    participant S3 as AWS S3 / Local Storage
    participant DB as PostgreSQL (Prisma)
    participant Queue as BullMQ (Redis)
    participant Worker as BullMQ Worker Process
    participant ML as FastAPI ML Microservice

    User->>UI: Uploads Resume PDF (Max 5MB)
    UI->>API: POST /resumes/upload (multipart/form-data)
    
    rect rgb(240, 248, 255)
        note over API,S3: Stage 1: Validation & Persistence
        API->>API: Validate MIME type (application/pdf) & Size
        API->>S3: Upload PDF (s3.putObject)
        S3-->>API: Returns storage key & bucket URI
        API->>DB: INSERT Resume (status: 'PENDING', fileKey, candidateId)
        DB-->>API: Returns resume record
        API->>Queue: resumeQueue.add('parse-resume', { resumeId, fileKey })
        Queue-->>API: Returns JobID
    end

    API-->>UI: HTTP 202 Accepted { resumeId, status: "PENDING" }
    UI-->>User: Display non-blocking upload progress

    rect rgb(245, 255, 250)
        note over Queue,Worker: Stage 2: Asynchronous Consumption
        Queue->>Worker: Job dispatched to available worker
        Worker->>DB: UPDATE Resume status = 'PROCESSING'
        Worker->>S3: Download PDF stream (or pass signed URL)
        S3-->>Worker: PDF Binary Stream
        Worker->>ML: POST /api/v1/parse-resume (stream + metadata)
    end

    rect rgb(255, 250, 240)
        note over ML: Stage 3: ML Parsing Pipeline
        ML->>ML: Execute 6-Stage Hybrid Parser
        ML-->>Worker: HTTP 200 OK (Structured JSON schema)
    end

    rect rgb(240, 255, 240)
        note over Worker,DB: Stage 4: Result Commit & Status Broadcast
        Worker->>DB: UPDATE Resume SET status = 'PARSED', parsedData = :json
        Worker->>Queue: Complete Job (job.ack)
    end

    UI->>API: GET /resumes/:id/status (or SSE notification)
    API->>DB: Query status
    DB-->>API: { status: "PARSED", parsedData: {...} }
    API-->>UI: HTTP 200 OK (Parsed Resume Loaded)
```

---

## 3. Fault Tolerance, Exponential Backoff & DLQ Lifecycle

Transient failures (network partitions, downstream ML timeouts, rate limits) must not result in data loss. HireLens implements a robust Dead-Letter Queue (DLQ) pattern with exponential backoff and administrative controls.

```mermaid
flowchart TD
    Start([Job Dispatched: 'parse-resume']) --> Execute[Worker Calls ML Service]
    Execute --> Decision{HTTP Call Successful?}
    
    Decision -- Yes --> MarkParsed[Update PostgreSQL: status = 'PARSED'<br/>Persist structured payload]
    MarkParsed --> JobComplete([Job Completed Successfully])
    
    Decision -- "No (Error or Timeout)" --> CheckAttempts{"Current Attempt < Max Retries (3)?"}
    
    CheckAttempts -- Yes --> CalcBackoff["Calculate Exponential Delay:<br/>Delay = 2^attempt * 1000ms + Jitter"]
    CalcBackoff --> RetryQueue["Re-enqueue into BullMQ with Delay"]
    RetryQueue --> Execute
    
    CheckAttempts -- "No (Exhausted)" --> MoveDLQ["Move Job to Dead-Letter Queue<br/>'resume-parse-dlq'"]
    MoveDLQ --> UpdateDBFailed["Update PostgreSQL: status = 'FAILED'<br/>Record error stack & timestamp"]
    
    subgraph Admin_Ops["Administrative DLQ Control (/admin/dlq)"]
        AdminView["Admin Dashboard / API: GET /admin/dlq<br/>Inspect error trace, resumeId, payload"]
        ActionCheck{Admin Action}
        
        AdminView --> ActionCheck
        ActionCheck -- "POST /admin/dlq/:id/retry" --> Requeue["Extract Job Metadata<br/>Push back into Active Queue"]
        ActionCheck -- "DELETE /admin/dlq/:id" --> Purge["Permanently Remove Dead Job<br/>Update DB status = 'ABORTED'"]
    end
    
    MoveDLQ -.-> AdminView
    Requeue --> Execute
```

---

## 4. 6-Stage Hybrid Resume Parsing Pipeline

The ML parsing engine combines deterministic layout heuristics with conditional LLM fallback to maximize accuracy while minimizing API costs and execution latency.

```mermaid
flowchart TD
    PDFIn[/Raw PDF Binary/] --> S1["Stage 1: Single-Pass PDF Extraction (pdfplumber)<br/>- Word coordinate bounding boxes<br/>- Column clustering & text flow<br/>- Hyperlink annotation extraction"]
    
    S1 --> S2["Stage 2: Text Normalization & Sanitization (text_sanitizer.py)<br/>- NFKD Unicode normalization<br/>- De-hyphenation across line breaks<br/>- Whitespace & control character pruning"]
    
    S2 --> S3["Stage 3: Boundary Segmentation & Metadata (section_segmenter.py)<br/>- Candidate header detection<br/>- Segment blocks: Skills, Experience, Projects, Education<br/>- Calculate boundary confidence margin (Delta)"]
    
    S3 --> S4Decision{"Confidence Margin Delta >= 3?"}
    
    S4Decision -- "Yes (Standard Format)" --> S5["Stage 5: Concurrent Field Extraction (ThreadPoolExecutor)<br/>Worker 1: Skills Extractor (Regex + Alias mapping)<br/>Worker 2: Experience Parser (Tenure + title extraction)<br/>Worker 3: Project Parser (Stack + complexity markers)<br/>Worker 4: Education & Certifications Parser"]
    
    S4Decision -- "No (Ambiguous Format)" --> S4["Stage 4: Conditional LLM Fallback (llm_segmenter.py)<br/>- Invoke Groq Llama-3 with structured schema prompt<br/>- Semantic boundary demarcation<br/>- Preserve valid heuristic chunks"]
    
    S4 --> S5
    
    S5 --> S6["Stage 6: Schema Validation & Normalization (schema_validator.py)<br/>- Pydantic schema validation<br/>- Non-overlapping career tenure computation<br/>- Date format standardization (ISO-8601)<br/>- Pruning temporary staging fields"]
    
    S6 --> JSONOut[/Structured Candidate JSON/]
```

---

## 5. 4-Pillar Deterministic Scoring Engine & Cohort Ranking

Rather than relying on opaque similarity embeddings alone, HireLens uses a **deterministic 4-pillar scoring architecture** anchored in explicit engineering competencies.

```mermaid
flowchart LR
    subgraph Inputs["Evaluation Inputs"]
        JD["Job Description<br/>- Required Skills<br/>- Preferred Skills<br/>- Min Tenure (Years)<br/>- Seniority Level<br/>- Knockout Criteria"]
        Candidate["Parsed Candidate Profile<br/>- Normalized Skills<br/>- Experience List<br/>- Project Artifacts<br/>- Proof of Work Links"]
    end

    subgraph Gates["Phase 1: Knockout Gates"]
        KG{"Knockout Check<br/>- Minimum Years Experience<br/>- Work Authorization<br/>- Mandatory Stack"}
    end

    subgraph ParallelScorers["Phase 2: 4-Pillar Scoring Engine"]
        direction TB
        
        S_Pillar["1. Skills Scorer<br/>- Direct keyword match<br/>- Ontology / Graph expansion<br/>- Semantic vector similarity<br/>- Recency & frequency weighting"]
        
        E_Pillar["2. Experience Scorer<br/>- Non-overlapping tenure<br/>- Seniority calibration<br/>- Career trajectory<br/>- Relevance decay"]
        
        P_Pillar["3. Projects Scorer<br/>- Architectural complexity<br/>- Stack alignment to JD<br/>- Scale & production signals"]
        
        W_Pillar["4. Proof of Work Scorer<br/>- Verifiable GitHub repos<br/>- Live deployed demos / URLs<br/>- Open-source contributions<br/>- Technical publications"]
    end

    subgraph Aggregator["Phase 3: Composite Aggregation & Normalization"]
        MacroWeights["Macro-Economic Role Presets<br/>- Balanced (25/25/25/25)<br/>- Skill-Heavy (45/20/20/15)<br/>- Experience-Heavy (20/45/20/15)<br/>- Project-Heavy (20/15/45/20)<br/>- Custom Recruiter Weights"]
        
        WeightedSum["Composite Score Calculation<br/>Score = SUM(Pillar_i * Weight_i)"]
        
        CohortRank["Cohort Normalization Engine<br/>- Pool Percentile Distribution<br/>- Tier Categorization:<br/>  * Strong Match (>= 85)<br/>  * Moderate Match (65 - 84)<br/>  * Potential Match (50 - 64)<br/>  * Unmatched (< 50)"]
    end

    JD --> KG
    Candidate --> KG
    
    KG -- "Fails Hard Requirement" --> KnockoutOut["Disqualified / Knocked Out<br/>(Score: 0 + Explicit Reason)"]
    KG -- "Passes" --> ParallelScorers
    
    S_Pillar --> WeightedSum
    E_Pillar --> WeightedSum
    P_Pillar --> WeightedSum
    W_Pillar --> WeightedSum
    MacroWeights --> WeightedSum
    
    WeightedSum --> CohortRank
    CohortRank --> OutputReport["Final Candidate Evaluation Report<br/>- Overall Score<br/>- Pillar Breakdown & Explanations<br/>- Matched vs Missing Skills<br/>- Cohort Percentile"]
```

---

## 6. Resume & Application State Machine

The candidate evaluation and resume processing lifecycle follows a formal finite state machine (FSM), ensuring database consistency across all concurrent mutations.

```mermaid
stateDiagram-v2
    [*] --> UPLOADED: File uploaded via REST API
    
    UPLOADED --> QUEUED: Persisted to S3 and job pushed to BullMQ
    
    QUEUED --> PROCESSING: Worker claims Redis lock
    
    PROCESSING --> PARSED: 6-stage parser succeeds
    PROCESSING --> RETRYING: Parser fails (attempts < 3)
    
    RETRYING --> PROCESSING: Exponential backoff delay expires
    RETRYING --> DEAD_LETTERED: Attempts >= 3 exhausted
    
    DEAD_LETTERED --> QUEUED: Admin manually triggers replay
    DEAD_LETTERED --> ABORTED: Admin purges failed job
    
    PARSED --> SCORING: Application submitted or cohort evaluation started
    
    SCORING --> EVALUATED: 4-pillar scores computed
    SCORING --> KNOCKED_OUT: Disqualified by mandatory knockout gate
    
    EVALUATED --> SHORTLISTED: Recruiter bookmarks candidate
    EVALUATED --> REJECTED: Recruiter rejects candidate
    
    KNOCKED_OUT --> REJECTED
    SHORTLISTED --> [*]
    REJECTED --> [*]
    ABORTED --> [*]
```

---

## 7. Authentication, RBAC & Multi-Tenant Security

HireLens enforces strict role-based access control (RBAC) and organizational tenant isolation at both the HTTP gateway and the database access layer.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Authenticated User
    participant Gateway as NestJS HTTP Pipeline
    participant JwtGuard as JwtAuthGuard
    participant RolesGuard as RolesGuard
    participant Controller as Application Controller
    participant Prisma as Prisma Client
    participant DB as PostgreSQL

    Client->>Gateway: HTTP Request + Header [Authorization: Bearer JWT]
    
    Gateway->>JwtGuard: Intercept Request
    alt Token Missing or Invalid
        JwtGuard-->>Client: HTTP 401 Unauthorized
    else Token Valid
        JwtGuard->>JwtGuard: Decode payload (userId, role, tenantId)
        JwtGuard->>Gateway: Attach req.user
    end

    Gateway->>RolesGuard: Inspect Handler Metadata (@Roles)
    alt User Role Does Not Match Required Roles
        RolesGuard-->>Client: HTTP 403 Forbidden
    else Role Authorized
        RolesGuard->>Controller: Allow Execution
    end

    Controller->>Prisma: Query Data with Injected Tenant Constraint
    Prisma->>DB: SELECT * FROM candidates WHERE org_id = $1
    DB-->>Prisma: Scoped Dataset
    Prisma-->>Controller: Tenant-Isolated Records
    Controller-->>Client: HTTP 200 OK
```

---

## 8. Data Persistence & Entity Relational Schema

The relational schema is maintained via Prisma ORM on PostgreSQL, enforcing cascading integrity, multi-column indexes, and normalized scoring records.

```mermaid
erDiagram
    USER ||--o{ RECRUITER_PROFILE : has
    USER ||--o{ CANDIDATE_PROFILE : has
    ORGANIZATION ||--o{ USER : employs
    ORGANIZATION ||--o{ JOB : posts

    JOB ||--o{ JOB_APPLICATION : receives
    JOB ||--o{ JOB_SKILL : requires
    
    CANDIDATE_PROFILE ||--o{ RESUME : uploads
    CANDIDATE_PROFILE ||--o{ JOB_APPLICATION : submits
    
    JOB_APPLICATION ||--|| APPLICATION_SCORE : evaluated_by

    USER {
        string id PK
        string email UK
        string passwordHash
        string role
        datetime createdAt
    }

    ORGANIZATION {
        string id PK
        string name
        string domain
    }

    JOB {
        string id PK
        string organizationId FK
        string title
        string description
        string seniorityLevel
        int minExperienceYears
        json knockoutCriteria
        json macroWeights
        datetime createdAt
    }

    RESUME {
        string id PK
        string candidateId FK
        string fileKey
        string originalFileName
        string status
        json parsedData
        datetime createdAt
    }

    JOB_APPLICATION {
        string id PK
        string jobId FK
        string candidateId FK
        string resumeId FK
        string status
        datetime appliedAt
    }

    APPLICATION_SCORE {
        string id PK
        string applicationId FK
        float totalScore
        float skillsScore
        float experienceScore
        float projectsScore
        float proofOfWorkScore
        boolean isKnockedOut
        string knockoutReason
        int cohortPercentile
        datetime evaluatedAt
    }
```

---

## 9. Operational Considerations & Latency Budgets

| Operation | Target P50 | Target P95 | Fallback / Mitigation Strategy |
|---|---|---|---|
| **Resume Upload & Enqueue** | < 80ms | < 200ms | Direct streaming to S3; instantaneous Redis job enqueue |
| **Heuristic Parsing (Stages 1-3, 5-6)** | 1.2s | 2.5s | Single-pass disk I/O; concurrent thread pool for field extraction |
| **LLM-Fallback Parsing (Stage 4)** | 2.8s | 4.5s | Invoked only when boundary confidence $\Delta < 3$; Groq Llama-3 high-throughput tokens |
| **4-Pillar Single Candidate Scoring** | 150ms | 350ms | Pre-compiled skill graphs, cached vector embeddings, in-memory tenure math |
| **Cohort Ranking (100 candidates)** | 600ms | 1.4s | Vectorized NumPy operations, matrix dot-products, parallel pillar aggregation |
| **Dead-Letter Recovery** | < 50ms | < 120ms | Atomic Redis state mutations with transactional BullMQ job repointing |

---

## 10. Technology Stack Summary

* **Frontend**: React 19, Vite, Tailwind CSS, Redux Toolkit, React Router 7.
* **Backend Gateway**: NestJS 10, TypeScript, Prisma ORM, BullMQ, Passport JWT.
* **Data Stores**: PostgreSQL 16 (Primary ACID), Redis 7 (Queues & Distributed Locks), AWS S3 (Blobs).
* **ML Microservice**: Python 3.11, FastAPI, Pydantic v2, pdfplumber, spaCy, Groq SDK (Llama-3).
* **Testing & Quality**: Jest (NestJS unit & integration), Pytest (ML scoring engine & parser suites), Multi-tenant isolation specs.
