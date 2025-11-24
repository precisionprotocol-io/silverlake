# TaskTerminal - Future State Technical Specification

## Executive Summary

This document outlines the architecture, technical requirements, and migration path for evolving TaskTerminal from a local, single-user web application to a cloud-based, multi-user platform with authentication, third-party integrations, and AI agent capabilities.

**Current State**: Offline-first, browser-based, IndexedDB storage, zero-server architecture
**Future State**: Cloud-native, authenticated, API-driven, agentic-enabled task management platform

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Future State Architecture](#future-state-architecture)
3. [Tech Stack Recommendations](#tech-stack-recommendations)
4. [Feature Specifications](#feature-specifications)
5. [API Design](#api-design)
6. [Security Architecture](#security-architecture)
7. [Data Migration Strategy](#data-migration-strategy)
8. [Integration Framework](#integration-framework)
9. [Agentic Implementation](#agentic-implementation)
10. [Deployment & Infrastructure](#deployment--infrastructure)
11. [Migration Roadmap](#migration-roadmap)

---

## 1. Current Architecture Analysis

### Strengths to Preserve
- **Terminal UX**: Vim-style command interface is unique and efficient
- **Keyboard-first workflow**: Minimal mouse interaction
- **Hierarchical task model**: 2-level parent/child structure works well
- **Color-coded visual system**: Status and priority badges provide quick insights
- **Command history**: Arrow key navigation enhances UX
- **Zero-latency**: Local operations are instant

### Current Limitations
- No data synchronization across devices
- No collaboration features
- No external integrations
- No authentication/authorization
- No backup/recovery beyond browser
- No programmatic access (API)
- Single-user only
- Browser-dependent data storage

### Current Tech Stack
```
Frontend:  Vanilla JavaScript, HTML5, CSS3
Database:  IndexedDB (browser-native)
Storage:   100MB+ local capacity
Security:  None (local only)
API:       None
Backend:   None
```

---

## 2. Future State Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Web App (React/Vue)  │  Mobile App   │  CLI Tool  │  API   │
│  - Terminal UI        │  - Native UI  │  - SSH     │  - SDK │
│  - Offline Support    │  - Gestures   │  - Scripts │        │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTPS/WSS
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                      API GATEWAY LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  - Authentication (JWT)                                      │
│  - Rate Limiting                                             │
│  - Request Routing                                           │
│  - WebSocket Management                                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┴──────────┬──────────────────┐
        │                     │                  │
┌───────▼────────┐  ┌────────▼────────┐  ┌─────▼──────────┐
│  AUTH SERVICE  │  │  CORE API       │  │  AGENT SERVICE │
│  - OAuth 2.0   │  │  - Task CRUD    │  │  - LLM Gateway │
│  - SSO         │  │  - Projects     │  │  - Function    │
│  - Sessions    │  │  - Filtering    │  │    Calling     │
└────────────────┘  │  - Sorting      │  │  - Webhooks    │
                    │  - Notes        │  └────────────────┘
                    └─────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼─────────┐  ┌─────▼──────────┐
│  PostgreSQL    │  │  Redis Cache   │  │  S3 Storage    │
│  - Primary DB  │  │  - Sessions    │  │  - Attachments │
│  - JSONB       │  │  - Rate Limits │  │  - Exports     │
└────────────────┘  └────────────────┘  └────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼─────────┐  ┌─────▼──────────┐
│  INTEGRATIONS  │  │  EVENT BUS     │  │  ANALYTICS     │
│  - Slack       │  │  - Kafka/      │  │  - Metrics     │
│  - GitHub      │  │    RabbitMQ    │  │  - Logging     │
│  - Jira        │  │  - Event Logs  │  │  - Monitoring  │
│  - Calendar    │  └────────────────┘  └────────────────┘
└────────────────┘
```

### Architecture Principles

1. **API-First**: All functionality exposed via REST/GraphQL
2. **Offline-First**: Client can operate without connectivity
3. **Event-Driven**: Async operations via message queue
4. **Microservices**: Loosely coupled, independently deployable
5. **Multi-Tenant**: Data isolation at database level
6. **Horizontally Scalable**: Stateless services behind load balancer

---

## 3. Tech Stack Recommendations

### Option A: Modern JavaScript Stack (Recommended)

**Rationale**: Lowest migration effort, familiar ecosystem, excellent for real-time features

```yaml
Frontend:
  Framework: React 18+ with TypeScript
  State: Zustand or Jotai (lightweight)
  UI Library: Radix UI (headless components)
  Styling: Tailwind CSS (maintain terminal aesthetic)
  Offline: Workbox (service workers)
  Build: Vite
  Testing: Vitest + Playwright

Backend:
  Runtime: Node.js 20 LTS
  Framework: Fastify (high performance) or NestJS (enterprise)
  Language: TypeScript
  API Style: REST + GraphQL (Apollo)
  Real-time: Socket.io or WS

Database:
  Primary: PostgreSQL 15+ (JSONB for flexibility)
  Cache: Redis 7+ (sessions, rate limiting)
  Search: PostgreSQL Full-Text or Typesense
  Queue: BullMQ (Redis-backed)

Authentication:
  Provider: Auth0 or Clerk (managed)
  Protocol: OAuth 2.0 + OIDC
  Tokens: JWT (short-lived access, refresh tokens)
  MFA: TOTP (Google Authenticator)

Integrations:
  Webhooks: Svix (managed webhooks)
  OAuth Clients: Custom implementation
  API Gateway: Kong or Tyk

AI/Agents:
  LLM Provider: OpenAI API, Anthropic Claude API
  Framework: LangChain.js or custom
  Vector DB: Pinecone or pgvector (PostgreSQL extension)
  Function Calling: OpenAI Functions or Anthropic Tools

Infrastructure:
  Platform: Vercel (frontend) + Railway/Render (backend)
  OR: AWS (ECS + RDS + ElastiCache)
  OR: DigitalOcean App Platform (cost-effective)
  CDN: CloudFlare
  Monitoring: Sentry + Datadog/NewRelic
  Logging: Better Stack or LogRocket
```

**Pros**:
- Easy migration from current vanilla JS
- Large talent pool
- Excellent real-time support
- Fast development velocity
- Modern developer experience

**Cons**:
- JavaScript runtime quirks
- Memory management for long-running processes

---

### Option B: Go + React (High Performance)

**Rationale**: Best for high-concurrency, low-latency requirements

```yaml
Frontend: Same as Option A

Backend:
  Language: Go 1.21+
  Framework: Fiber or Gin
  API: REST + gRPC
  Real-time: Gorilla WebSocket
  ORM: sqlc or GORM

Database: Same as Option A

Advantages:
  - 10x better performance for API endpoints
  - Lower memory footprint
  - Built-in concurrency (goroutines)
  - Strong typing, fast compilation
  - Single binary deployment

Disadvantages:
  - Steeper learning curve
  - Smaller ecosystem than JS
  - More verbose code
```

---

### Option C: Python + React (AI-First)

**Rationale**: Best for AI/ML-heavy workloads

```yaml
Frontend: Same as Option A

Backend:
  Language: Python 3.11+
  Framework: FastAPI
  Async: asyncio + uvloop
  ORM: SQLAlchemy 2.0
  Real-time: FastAPI WebSockets

AI/ML:
  Framework: LangChain, LlamaIndex
  Vector DB: Weaviate, Chroma
  LLM: OpenAI, Anthropic, local models

Advantages:
  - Best-in-class AI/ML libraries
  - Easy to implement complex agentic logic
  - Jupyter notebooks for experimentation

Disadvantages:
  - Slower than Go/Node for pure API
  - GIL limits true parallelism
  - Larger container images
```

---

**Recommendation**: **Option A (Node.js + TypeScript)** for initial migration, evaluate Option C if AI features become primary focus.

---

## 4. Feature Specifications

### 4.1 Authentication & Authorization

#### User Authentication
```typescript
// User roles
enum UserRole {
  FREE = 'free',           // 100 tasks limit
  PRO = 'pro',             // Unlimited tasks
  TEAM = 'team',           // Multi-user workspaces
  ENTERPRISE = 'enterprise' // SSO, audit logs, SLA
}

// Auth providers
- Email/Password (with email verification)
- Google OAuth
- GitHub OAuth
- Apple Sign-In
- SAML 2.0 (Enterprise)
- Magic Link (passwordless)

// Session management
- JWT access tokens (15 min expiry)
- Refresh tokens (30 days)
- Device fingerprinting
- Session revocation
- "Remember me" option
```

#### Authorization Model
```
Workspace (Tenant)
├── Owner (full access)
├── Admin (manage users, billing)
├── Member (CRUD own tasks)
└── Viewer (read-only)

Task Permissions:
- Private (only creator)
- Workspace (all members)
- Shared (specific users/teams)
- Public (read-only link)
```

#### Security Requirements
- Rate limiting: 100 req/min per user
- MFA for sensitive operations
- Audit logging (who, what, when)
- GDPR compliance (data export/deletion)
- SOC 2 Type II (Enterprise)

---

### 4.2 Multi-User & Collaboration

#### Workspaces
```typescript
interface Workspace {
  id: string;
  name: string;
  slug: string; // taskterminal.app/w/acme-corp
  plan: UserRole;
  settings: {
    defaultTaskStatus: Status;
    defaultPriority: Priority;
    dueDateRequired: boolean;
    projectRequired: boolean;
  };
  members: WorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

interface WorkspaceMember {
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Date;
}
```

#### Real-Time Collaboration
- **Optimistic UI**: Update local state immediately, sync in background
- **Conflict Resolution**: Last-write-wins with version tracking
- **Presence Indicators**: Show who's viewing/editing a task
- **Activity Feed**: Real-time notifications of changes
- **@Mentions**: Notify users in task notes
- **Subscriptions**: Watch tasks for updates

#### Sync Engine
```typescript
// Operational Transformation or CRDT-based sync
class SyncEngine {
  // Local changes queue
  private changeQueue: Operation[] = [];

  // Push local changes to server
  async sync(): Promise<void> {
    const operations = this.changeQueue;
    const result = await api.sync(operations);

    // Apply server changes
    this.applyRemoteChanges(result.serverOps);

    // Handle conflicts
    this.resolveConflicts(result.conflicts);
  }

  // WebSocket listener for real-time updates
  onRemoteChange(op: Operation): void {
    this.applyRemoteChanges([op]);
    this.notifyUI();
  }
}
```

---

### 4.3 Platform Integrations

#### Integration Architecture
```typescript
interface Integration {
  id: string;
  type: IntegrationType;
  enabled: boolean;
  config: Record<string, any>;
  webhookUrl?: string;
  apiKey?: string;
  createdAt: Date;
}

enum IntegrationType {
  // Communication
  SLACK = 'slack',
  DISCORD = 'discord',
  TEAMS = 'teams',

  // Development
  GITHUB = 'github',
  GITLAB = 'gitlab',
  JIRA = 'jira',
  LINEAR = 'linear',

  // Calendar
  GOOGLE_CALENDAR = 'google_calendar',
  OUTLOOK = 'outlook',
  APPLE_CALENDAR = 'apple_calendar',

  // Email
  GMAIL = 'gmail',
  OUTLOOK_EMAIL = 'outlook_email',

  // Automation
  ZAPIER = 'zapier',
  MAKE = 'make',
  N8N = 'n8n',

  // Time Tracking
  TOGGL = 'toggl',
  HARVEST = 'harvest',

  // Note-taking
  NOTION = 'notion',
  OBSIDIAN = 'obsidian',
  ROAM = 'roam'
}
```

#### Integration Use Cases

**1. Slack Integration**
```bash
# Slash command in Slack
/task add "Fix bug in login" priority:high project:Auth

# Notifications
🔔 Task #42 "Deploy to prod" is due in 1 hour
   View: https://taskterminal.app/t/42

# Two-way sync
- Create tasks from Slack
- Get notified in Slack when task status changes
- Complete tasks from Slack
- Daily digest of tasks
```

**2. GitHub Integration**
```bash
# Auto-create tasks from issues
GitHub Issue #123 → TaskTerminal Task #456

# Link commits to tasks
git commit -m "Fix login bug [TT-42]"

# Close tasks when PR merged
PR merged → Task marked as Completed

# Sync labels with projects
github:bug → Project: Bugs
github:feature → Project: Features
```

**3. Google Calendar Integration**
```bash
# Sync due dates to calendar
Task due 2024-12-31 14:00 → Calendar event

# Time blocking
Block time for "In Progress" tasks

# Reminders
15 min before due date → Push notification
```

**4. Zapier/Make Integration**
```bash
# Example Zaps
- New email from boss → Create high-priority task
- Task completed → Update Google Sheet
- New Trello card → Create task
- Task overdue → Send SMS via Twilio
```

#### Integration API Design
```typescript
// Generic webhook handler
interface WebhookPayload {
  source: IntegrationType;
  event: string; // 'task.created', 'task.updated', etc.
  data: any;
  timestamp: string;
  signature: string; // HMAC for verification
}

// OAuth flow for third-party integrations
class IntegrationManager {
  // Step 1: Redirect user to OAuth provider
  async initiateOAuth(type: IntegrationType): Promise<string> {
    const authUrl = this.getAuthUrl(type);
    return authUrl;
  }

  // Step 2: Handle callback
  async handleOAuthCallback(code: string, state: string): Promise<void> {
    const tokens = await this.exchangeCodeForTokens(code);
    await this.saveIntegration(tokens);
  }

  // Step 3: Make API calls on behalf of user
  async syncWithProvider(type: IntegrationType): Promise<void> {
    const integration = await this.getIntegration(type);
    const tasks = await this.fetchTasksFromProvider(integration);
    await this.syncTasks(tasks);
  }
}
```

---

### 4.4 Agentic Implementation

#### AI Agent Architecture

**Use Cases**:
1. **Natural Language Task Creation**: "Add task to call mom tomorrow at 3pm high priority"
2. **Smart Scheduling**: AI suggests optimal due dates based on workload
3. **Auto-Categorization**: Classify tasks into projects automatically
4. **Priority Recommendations**: Analyze urgency/importance, suggest priorities
5. **Task Breakdown**: Split complex tasks into subtasks automatically
6. **Context Enrichment**: Add relevant notes/links from web searches
7. **Conflict Detection**: Warn about overlapping deadlines
8. **Daily Briefing**: AI-generated summary of tasks for the day

#### Agent System Design

```typescript
// Agent interface
interface Agent {
  id: string;
  name: string;
  type: AgentType;
  capabilities: Capability[];
  enabled: boolean;
}

enum AgentType {
  NLP_PARSER = 'nlp_parser',           // Parse natural language
  SCHEDULER = 'scheduler',             // Suggest due dates
  CATEGORIZER = 'categorizer',         // Auto-assign projects
  PRIORITIZER = 'prioritizer',         // Suggest priorities
  DECOMPOSER = 'decomposer',           // Break down tasks
  ENRICHER = 'enricher',               // Add context
  CONFLICT_DETECTOR = 'conflict_detector', // Find conflicts
  SUMMARIZER = 'summarizer'            // Generate summaries
}

// Function calling schema for LLM
const taskFunctions = [
  {
    name: 'create_task',
    description: 'Create a new task',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Task name' },
        dueDate: { type: 'string', description: 'ISO date string' },
        priority: {
          type: 'string',
          enum: ['Low', 'Medium', 'High', 'Critical']
        },
        project: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['name']
    }
  },
  {
    name: 'update_task',
    description: 'Update an existing task',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'number' },
        updates: { type: 'object' }
      },
      required: ['taskId', 'updates']
    }
  },
  {
    name: 'search_tasks',
    description: 'Search tasks by criteria',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        filters: { type: 'object' }
      }
    }
  }
];

// Agent implementation
class NLPAgent {
  private llm: OpenAI | Anthropic;

  async parseCommand(input: string): Promise<TaskOperation> {
    const response = await this.llm.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a task management assistant. Parse user commands into structured task operations.`
        },
        {
          role: 'user',
          content: input
        }
      ],
      functions: taskFunctions,
      function_call: 'auto'
    });

    const functionCall = response.choices[0].message.function_call;
    return JSON.parse(functionCall.arguments);
  }
}

// Example usage
const agent = new NLPAgent();
const result = await agent.parseCommand(
  "Add task to review pull requests every Monday at 9am, high priority, engineering project"
);

// Output:
{
  name: 'Review pull requests',
  dueDate: 'next-monday-9am', // Agent converts to ISO
  priority: 'High',
  project: 'Engineering',
  recurrence: 'weekly' // New field detected by AI
}
```

#### Agent Communication Protocol

```typescript
// Inbound: External agents call our API
interface AgentRequest {
  agentId: string;              // Unique agent identifier
  apiKey: string;               // Authentication
  action: 'create' | 'read' | 'update' | 'delete';
  resource: 'task' | 'project' | 'note';
  data: any;
  context?: {                   // Optional context for AI
    conversationId?: string;
    userId?: string;
    source?: string;            // 'slack', 'email', 'api'
  };
}

// Outbound: We call external agents
interface AgentWebhook {
  url: string;
  events: string[];             // ['task.created', 'task.due_soon']
  secret: string;               // For signature verification
}

// Example: Third-party AI assistant integration
POST /api/v1/agent/execute
Authorization: Bearer agent_key_abc123
Content-Type: application/json

{
  "agentId": "zapier-ai-assistant",
  "action": "create",
  "resource": "task",
  "data": {
    "name": "Follow up with customer",
    "priority": "High",
    "dueDate": "2024-12-25T10:00:00Z"
  },
  "context": {
    "source": "email",
    "userId": "user_123",
    "conversationId": "conv_456"
  }
}
```

#### RAG (Retrieval-Augmented Generation) for Context

```typescript
// Vector embeddings for semantic search
class TaskRAG {
  private vectorDB: PineconeClient;

  // Index tasks for semantic search
  async indexTask(task: Task): Promise<void> {
    const embedding = await this.generateEmbedding(
      `${task.name} ${task.notes.map(n => n.content).join(' ')}`
    );

    await this.vectorDB.upsert([{
      id: `task_${task.id}`,
      values: embedding,
      metadata: {
        taskId: task.id,
        name: task.name,
        project: task.project,
        priority: task.priority
      }
    }]);
  }

  // Semantic search
  async findSimilarTasks(query: string): Promise<Task[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const results = await this.vectorDB.query({
      vector: queryEmbedding,
      topK: 5
    });

    return results.matches.map(m => this.getTask(m.metadata.taskId));
  }
}

// Example: Agent uses RAG to provide context
User: "What tasks do I have related to the login system?"

Agent Process:
1. Generate embedding for "login system"
2. Query vector DB for similar tasks
3. Retrieve: [Task #12: "Fix login bug", Task #34: "Add OAuth", ...]
4. Format response with context
5. Return to user
```

#### AI Safety & Controls

```typescript
// Agent action approval workflow
enum ApprovalMode {
  AUTO = 'auto',           // Agent acts immediately
  CONFIRM = 'confirm',     // Ask user before acting
  NOTIFY = 'notify'        // Act, then notify user
}

interface AgentPolicy {
  agentType: AgentType;
  approvalMode: ApprovalMode;
  maxTasksPerDay: number;  // Rate limit
  allowedActions: string[]; // Whitelist
  blockedProjects: string[]; // Don't touch certain projects
}

// Audit trail for agent actions
interface AgentAuditLog {
  id: string;
  agentId: string;
  action: string;
  resourceId: string;
  userId: string;
  timestamp: Date;
  approved: boolean;
  result: 'success' | 'failure';
  reasoning: string;      // Why agent took this action
}
```

---

## 5. API Design

### REST API Structure

```
Base URL: https://api.taskterminal.app/v1

Authentication:
  - Header: Authorization: Bearer {jwt_token}
  - API Key: X-API-Key: {api_key}

Endpoints:

# Tasks
GET    /tasks                    # List tasks (with filters)
POST   /tasks                    # Create task
GET    /tasks/:id                # Get task by ID
PUT    /tasks/:id                # Update task
PATCH  /tasks/:id                # Partial update
DELETE /tasks/:id                # Delete task
GET    /tasks/:id/history        # Task change history
POST   /tasks/:id/notes          # Add note to task
GET    /tasks/search             # Full-text search

# Projects
GET    /projects                 # List projects
POST   /projects                 # Create project
GET    /projects/:id             # Get project
PUT    /projects/:id             # Update project
DELETE /projects/:id             # Delete project
GET    /projects/:id/tasks       # Get tasks in project

# Workspaces
GET    /workspaces               # List workspaces
POST   /workspaces               # Create workspace
GET    /workspaces/:id           # Get workspace
PUT    /workspaces/:id           # Update workspace
DELETE /workspaces/:id           # Delete workspace
GET    /workspaces/:id/members   # List members
POST   /workspaces/:id/members   # Invite member
DELETE /workspaces/:id/members/:userId  # Remove member

# Integrations
GET    /integrations             # List integrations
POST   /integrations             # Connect integration
GET    /integrations/:type       # Get integration config
PUT    /integrations/:type       # Update integration
DELETE /integrations/:type       # Disconnect integration
POST   /integrations/:type/sync  # Trigger sync

# AI Agents
POST   /agents/parse             # Parse natural language
POST   /agents/suggest           # Get AI suggestions
POST   /agents/breakdown         # Break down task
POST   /agents/schedule          # Get scheduling suggestions
GET    /agents/summary           # Daily briefing

# User
GET    /user                     # Get current user
PUT    /user                     # Update user
GET    /user/settings            # Get settings
PUT    /user/settings            # Update settings
POST   /user/export              # Export all data (GDPR)
DELETE /user                     # Delete account

# Sync (for offline support)
POST   /sync                     # Sync local changes
GET    /sync/changes?since=timestamp  # Get changes since timestamp

# Webhooks
GET    /webhooks                 # List webhooks
POST   /webhooks                 # Create webhook
DELETE /webhooks/:id             # Delete webhook
```

### GraphQL Schema

```graphql
type Task {
  id: ID!
  name: String!
  dueDate: DateTime
  status: TaskStatus!
  priority: Priority!
  project: Project
  parentTask: Task
  childTasks: [Task!]!
  notes: [Note!]!
  assignee: User
  createdBy: User!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Query {
  tasks(
    filter: TaskFilter
    sort: TaskSort
    limit: Int
    offset: Int
  ): TaskConnection!

  task(id: ID!): Task

  projects: [Project!]!

  search(query: String!): SearchResults!
}

type Mutation {
  createTask(input: CreateTaskInput!): Task!
  updateTask(id: ID!, input: UpdateTaskInput!): Task!
  deleteTask(id: ID!): Boolean!

  # AI-powered mutations
  parseNaturalLanguage(input: String!): Task!
  breakdownTask(id: ID!): [Task!]!
}

type Subscription {
  taskUpdated(workspaceId: ID!): Task!
  taskCreated(workspaceId: ID!): Task!
  taskDeleted(workspaceId: ID!): ID!
}
```

### WebSocket Protocol (Real-Time)

```typescript
// Connection
ws://api.taskterminal.app/ws?token={jwt}

// Message format
interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'event' | 'ping' | 'pong';
  channel?: string;
  data?: any;
}

// Subscribe to workspace
{
  "type": "subscribe",
  "channel": "workspace:123"
}

// Receive events
{
  "type": "event",
  "channel": "workspace:123",
  "data": {
    "event": "task.updated",
    "taskId": 456,
    "changes": {
      "status": "Completed"
    },
    "userId": "user_789",
    "timestamp": "2024-12-20T10:30:00Z"
  }
}
```

---

## 6. Security Architecture

### Authentication Flow

```
1. User Login
   ├─ Email/Password → bcrypt hash comparison
   ├─ OAuth (Google, GitHub) → Exchange code for tokens
   └─ Magic Link → Time-limited JWT sent via email

2. Token Issuance
   ├─ Access Token (JWT, 15 min expiry)
   │  └─ Claims: userId, workspaceId, role, permissions
   └─ Refresh Token (opaque, 30 days expiry)
      └─ Stored in Redis with user session data

3. API Request
   ├─ Client sends: Authorization: Bearer {access_token}
   ├─ API validates JWT signature + expiry
   ├─ Check permissions for requested resource
   └─ Execute request or return 403 Forbidden

4. Token Refresh
   ├─ Access token expires → Client sends refresh token
   ├─ API validates refresh token in Redis
   ├─ Issue new access token
   └─ Optionally rotate refresh token
```

### Authorization Matrix

```
Resource: Task

Action      │ Owner │ Admin │ Member │ Viewer │ Public
────────────┼───────┼───────┼────────┼────────┼────────
Create      │   ✓   │   ✓   │   ✓    │   ✗    │   ✗
Read Own    │   ✓   │   ✓   │   ✓    │   ✓    │   ✗
Read All    │   ✓   │   ✓   │   ✓    │   ✓    │   ✗
Update Own  │   ✓   │   ✓   │   ✓    │   ✗    │   ✗
Update All  │   ✓   │   ✓   │   ✗    │   ✗    │   ✗
Delete Own  │   ✓   │   ✓   │   ✓    │   ✗    │   ✗
Delete All  │   ✓   │   ✓   │   ✗    │   ✗    │   ✗
Share       │   ✓   │   ✓   │   ✓    │   ✗    │   ✗
```

### Data Protection

```yaml
Encryption:
  At-Rest:
    - Database: AES-256 (AWS RDS encryption)
    - Backups: AES-256
    - File Storage: S3 Server-Side Encryption
  In-Transit:
    - TLS 1.3 for all connections
    - Certificate pinning for mobile apps
    - HSTS headers

Data Isolation:
  - Row-Level Security (RLS) in PostgreSQL
  - Each workspace = separate schema OR tenant_id column
  - No cross-tenant queries possible

Secrets Management:
  - API keys: Hashed with SHA-256
  - OAuth tokens: Encrypted with workspace-specific key
  - Environment variables: AWS Secrets Manager or Vault

Compliance:
  - GDPR: Data export, right to be forgotten
  - SOC 2: Audit logs, access controls
  - HIPAA (optional): BAA, PHI encryption
```

### Rate Limiting Strategy

```
Tier-based limits:

Free Tier:
  - 100 requests/minute
  - 1,000 requests/day
  - 5 concurrent connections

Pro Tier:
  - 500 requests/minute
  - 10,000 requests/day
  - 25 concurrent connections

Team Tier:
  - 1,000 requests/minute
  - 50,000 requests/day
  - 100 concurrent connections

Enterprise:
  - Custom limits
  - Dedicated rate limit quotas per integration

Implementation:
  - Redis sliding window algorithm
  - Return headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
  - 429 Too Many Requests with Retry-After header
```

---

## 7. Data Migration Strategy

### Phase 1: Export from IndexedDB

```javascript
// Client-side export script
async function exportCurrentData() {
  const taskManager = new TaskManager();
  await taskManager.init();

  const data = await taskManager.exportData();

  // Format for new API
  const exportFormat = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    userId: null, // To be assigned during import
    tasks: data.tasks.map(task => ({
      // Keep same structure, add new fields
      ...task,
      workspaceId: null, // To be assigned
      assigneeId: null,
      tags: [],
      attachments: []
    }))
  };

  // Download as JSON
  const blob = new Blob([JSON.stringify(exportFormat, null, 2)],
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `taskterminal-export-${Date.now()}.json`;
  a.click();
}
```

### Phase 2: Import to New System

```typescript
// Server-side import endpoint
POST /api/v1/import

{
  "source": "indexeddb",
  "version": "2.0",
  "data": { ... }
}

// Import handler
class ImportService {
  async importFromLegacy(userId: string, data: any): Promise<ImportResult> {
    // Create default workspace
    const workspace = await this.createWorkspace({
      name: `${user.name}'s Workspace`,
      ownerId: userId
    });

    // Map old IDs to new IDs
    const idMapping = new Map<number, string>();

    // Import tasks (parents first, then children)
    const tasks = this.sortTasksByHierarchy(data.tasks);

    for (const task of tasks) {
      const newTask = await this.createTask({
        workspaceId: workspace.id,
        name: task.name,
        dueDate: task.dueDate,
        status: task.status,
        priority: task.priority,
        project: task.project,
        notes: task.notes,
        parentTaskId: task.parentTaskId
          ? idMapping.get(task.parentTaskId)
          : null
      });

      idMapping.set(task.id, newTask.id);
    }

    return {
      success: true,
      tasksImported: tasks.length,
      workspaceId: workspace.id
    };
  }
}
```

### Phase 3: Dual-Mode Operation

```typescript
// During migration period, support both local and cloud
class HybridTaskManager {
  private local: IndexedDBManager;
  private remote: APIClient;
  private mode: 'local' | 'cloud' | 'hybrid';

  async getTasks(): Promise<Task[]> {
    if (this.mode === 'local') {
      return this.local.getAllTasks();
    } else if (this.mode === 'cloud') {
      return this.remote.getTasks();
    } else {
      // Hybrid: merge local and remote, prioritize remote
      const [localTasks, remoteTasks] = await Promise.all([
        this.local.getAllTasks(),
        this.remote.getTasks()
      ]);

      return this.mergeTasks(localTasks, remoteTasks);
    }
  }

  async createTask(data: TaskData): Promise<Task> {
    // Optimistic update to local DB
    const localTask = await this.local.createTask(data);

    if (this.mode !== 'local') {
      try {
        // Sync to cloud
        const remoteTask = await this.remote.createTask(data);

        // Update local with server ID
        await this.local.updateTask(localTask.id, {
          remoteId: remoteTask.id
        });

        return remoteTask;
      } catch (error) {
        // Queue for retry
        await this.queueForSync(localTask);
        return localTask;
      }
    }

    return localTask;
  }
}
```

---

## 8. Integration Framework

### Webhook System

```typescript
// Webhook registration
interface Webhook {
  id: string;
  workspaceId: string;
  url: string;
  events: string[];  // ['task.created', 'task.updated', 'task.deleted']
  secret: string;    // For HMAC signature
  active: boolean;
  createdAt: Date;
}

// Webhook delivery
class WebhookDeliveryService {
  async deliver(webhook: Webhook, event: Event): Promise<void> {
    const payload = {
      id: uuidv4(),
      event: event.type,
      data: event.data,
      timestamp: new Date().toISOString()
    };

    // Generate signature
    const signature = this.generateSignature(payload, webhook.secret);

    // Attempt delivery with retries
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.post(webhook.url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-TaskTerminal-Signature': signature,
            'X-TaskTerminal-Event': event.type
          },
          timeout: 5000
        });

        if (response.status === 200) {
          await this.logSuccess(webhook.id, event.id);
          return;
        }
      } catch (error) {
        if (i === maxRetries - 1) {
          await this.logFailure(webhook.id, event.id, error);
          // Optionally disable webhook after repeated failures
        }

        // Exponential backoff
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
  }

  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }
}
```

### OAuth 2.0 Client Implementation

```typescript
// For integrations that use OAuth (GitHub, Google, etc.)
class OAuthClient {
  async getAuthorizationUrl(provider: string): Promise<string> {
    const config = this.getProviderConfig(provider);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: this.generateState() // CSRF protection
    });

    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    provider: string,
    code: string
  ): Promise<OAuthTokens> {
    const config = this.getProviderConfig(provider);

    const response = await axios.post(config.tokenUrl, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      scope: response.data.scope
    };
  }

  async refreshAccessToken(
    provider: string,
    refreshToken: string
  ): Promise<OAuthTokens> {
    const config = this.getProviderConfig(provider);

    const response = await axios.post(config.tokenUrl, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token || refreshToken,
      expiresIn: response.data.expires_in
    };
  }
}
```

---

## 9. Agentic Implementation (Detailed)

### Agent Registry

```typescript
// Central registry of available agents
class AgentRegistry {
  private agents: Map<string, Agent> = new Map();

  register(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}

// Built-in agents
const builtInAgents: Agent[] = [
  {
    id: 'nlp-parser',
    name: 'Natural Language Parser',
    description: 'Parse natural language into structured task data',
    capabilities: ['parse', 'create'],
    model: 'gpt-4-turbo',
    systemPrompt: `You are a task management assistant...`
  },
  {
    id: 'smart-scheduler',
    name: 'Smart Scheduler',
    description: 'Suggest optimal due dates based on workload',
    capabilities: ['analyze', 'suggest'],
    model: 'gpt-4-turbo'
  },
  {
    id: 'task-decomposer',
    name: 'Task Decomposer',
    description: 'Break down complex tasks into subtasks',
    capabilities: ['decompose', 'create'],
    model: 'claude-3-opus'
  }
];
```

### Agent Execution Engine

```typescript
class AgentExecutor {
  private llm: LLMClient;
  private tools: ToolRegistry;

  async execute(
    agent: Agent,
    input: string,
    context: ExecutionContext
  ): Promise<AgentResponse> {
    // Build context from user's tasks
    const userTasks = await this.loadUserContext(context.userId);

    // Create chat completion with function calling
    const messages = [
      {
        role: 'system',
        content: agent.systemPrompt + this.buildContextPrompt(userTasks)
      },
      {
        role: 'user',
        content: input
      }
    ];

    let response = await this.llm.chat({
      model: agent.model,
      messages,
      tools: this.getToolsForAgent(agent),
      tool_choice: 'auto'
    });

    // Handle function calls
    while (response.tool_calls && response.tool_calls.length > 0) {
      for (const toolCall of response.tool_calls) {
        const tool = this.tools.get(toolCall.function.name);
        const args = JSON.parse(toolCall.function.arguments);

        // Check permissions
        if (!this.hasPermission(context, toolCall.function.name)) {
          throw new Error(`Insufficient permissions for ${toolCall.function.name}`);
        }

        // Execute tool
        const result = await tool.execute(args, context);

        // Add to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // Get next response
      response = await this.llm.chat({
        model: agent.model,
        messages,
        tools: this.getToolsForAgent(agent)
      });
    }

    return {
      content: response.content,
      actions: this.extractActions(messages),
      usage: response.usage
    };
  }

  private getToolsForAgent(agent: Agent): Tool[] {
    // Map agent capabilities to available tools
    const toolMap = {
      create: ['create_task', 'create_project'],
      read: ['get_task', 'search_tasks', 'list_tasks'],
      update: ['update_task', 'add_note'],
      delete: ['delete_task'],
      analyze: ['get_workload', 'find_conflicts'],
      suggest: ['suggest_due_date', 'suggest_priority']
    };

    const tools: Tool[] = [];
    for (const capability of agent.capabilities) {
      const toolNames = toolMap[capability] || [];
      tools.push(...toolNames.map(name => this.tools.get(name)));
    }

    return tools;
  }
}
```

### Tool Definitions for LLM

```typescript
const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new task in the user\'s workspace',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'The name/title of the task'
          },
          due_date: {
            type: 'string',
            description: 'ISO 8601 date string for due date'
          },
          priority: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
            description: 'Task priority level'
          },
          project: {
            type: 'string',
            description: 'Project name to assign task to'
          },
          notes: {
            type: 'string',
            description: 'Additional notes or context for the task'
          },
          parent_task_id: {
            type: 'string',
            description: 'ID of parent task if this is a subtask'
          }
        },
        required: ['name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_tasks',
      description: 'Search for tasks by criteria',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (searches name and notes)'
          },
          status: {
            type: 'string',
            enum: ['Not Started', 'In Progress', 'Blocked', 'Completed']
          },
          priority: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical']
          },
          project: {
            type: 'string',
            description: 'Filter by project name'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_workload',
      description: 'Analyze user\'s current workload and identify potential issues',
      parameters: {
        type: 'object',
        properties: {
          time_range: {
            type: 'string',
            enum: ['today', 'this_week', 'this_month'],
            description: 'Time range to analyze'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_due_date',
      description: 'Suggest an optimal due date based on current workload',
      parameters: {
        type: 'object',
        properties: {
          task_name: {
            type: 'string',
            description: 'Name of the task to schedule'
          },
          estimated_duration: {
            type: 'number',
            description: 'Estimated hours to complete'
          },
          priority: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical']
          }
        },
        required: ['task_name']
      }
    }
  }
];
```

### Agentic Workflows

```typescript
// Multi-step agent workflow
class AgentWorkflow {
  async processNaturalLanguageTask(
    input: string,
    userId: string
  ): Promise<WorkflowResult> {
    const steps: WorkflowStep[] = [];

    // Step 1: Parse natural language
    const parser = this.registry.getAgent('nlp-parser');
    const parsed = await this.executor.execute(parser, input, { userId });
    steps.push({ agent: 'nlp-parser', result: parsed });

    // Step 2: Analyze workload for smart scheduling
    if (!parsed.actions.some(a => a.type === 'create_task' && a.data.dueDate)) {
      const scheduler = this.registry.getAgent('smart-scheduler');
      const suggestion = await this.executor.execute(
        scheduler,
        `Suggest a due date for: ${parsed.actions[0].data.name}`,
        { userId }
      );
      steps.push({ agent: 'smart-scheduler', result: suggestion });

      // Apply suggested due date
      parsed.actions[0].data.dueDate = suggestion.actions[0].data.suggestedDate;
    }

    // Step 3: If task is complex, break it down
    const complexity = this.assessComplexity(parsed.actions[0].data.name);
    if (complexity > 0.7) {
      const decomposer = this.registry.getAgent('task-decomposer');
      const subtasks = await this.executor.execute(
        decomposer,
        `Break down this task: ${parsed.actions[0].data.name}`,
        { userId }
      );
      steps.push({ agent: 'task-decomposer', result: subtasks });

      // Create parent task first, then subtasks
      const parentTask = await this.api.createTask(parsed.actions[0].data);
      for (const subtask of subtasks.actions) {
        subtask.data.parentTaskId = parentTask.id;
        await this.api.createTask(subtask.data);
      }
    } else {
      // Just create the task
      await this.api.createTask(parsed.actions[0].data);
    }

    return {
      success: true,
      steps,
      summary: this.generateSummary(steps)
    };
  }
}

// Example usage
User: "I need to launch a new feature by end of next month, high priority"

Workflow:
1. NLP Parser →
   {
     name: "Launch new feature",
     priority: "High",
     dueDate: "2024-02-29" // inferred from "end of next month"
   }

2. Smart Scheduler →
   Analyzes: "You have 8 high-priority tasks due next month. This is
   achievable but will require focused work."

3. Task Decomposer →
   Suggests breaking down into:
   - Design feature
   - Implement backend
   - Implement frontend
   - Write tests
   - Deploy to staging
   - QA testing
   - Deploy to production

4. Creates parent task + 7 subtasks

Result: "Created task 'Launch new feature' with 7 subtasks. Due Feb 29, 2024."
```

---

## 10. Deployment & Infrastructure

### Cloud Architecture Options

#### Option A: Serverless (AWS)

```yaml
Architecture:
  Frontend: CloudFront + S3
  API: API Gateway + Lambda (Node.js)
  Database: Aurora Serverless v2 (PostgreSQL)
  Cache: ElastiCache (Redis)
  Queue: SQS + Lambda
  Storage: S3
  Search: OpenSearch Serverless
  Monitoring: CloudWatch

Advantages:
  - Auto-scaling (0 to millions)
  - Pay-per-use
  - No server management
  - Built-in redundancy

Disadvantages:
  - Cold start latency
  - Vendor lock-in
  - Complex debugging

Cost Estimate (per month):
  Free Tier: $0 (1M API calls, 25GB DB storage)
  Light Usage (10K users): ~$200
  Medium Usage (100K users): ~$2,000
  Heavy Usage (1M users): ~$15,000
```

#### Option B: Container-Based (Kubernetes)

```yaml
Architecture:
  Frontend: Vercel or CloudFlare Pages
  API: EKS (Kubernetes) + Docker containers
  Database: RDS PostgreSQL (Multi-AZ)
  Cache: ElastiCache Redis
  Queue: RabbitMQ or Kafka on EKS
  Storage: S3
  Monitoring: Prometheus + Grafana

Advantages:
  - Full control
  - Portable (any cloud)
  - Consistent performance
  - Complex orchestration support

Disadvantages:
  - Higher baseline cost
  - Requires DevOps expertise
  - Manual scaling

Cost Estimate (per month):
  Minimum: ~$500 (t3.medium nodes)
  Light Usage: ~$800
  Medium Usage: ~$3,000
  Heavy Usage: ~$20,000+
```

#### Option C: Platform-as-a-Service (Recommended for MVP)

```yaml
Architecture:
  Frontend: Vercel
  API: Railway or Render
  Database: Supabase (managed PostgreSQL)
  Cache: Upstash (serverless Redis)
  Queue: Inngest (serverless events)
  Storage: Supabase Storage (S3-compatible)
  Monitoring: Better Stack

Advantages:
  - Fastest to deploy
  - Automatic CI/CD
  - Simple scaling
  - Good DX (developer experience)
  - Affordable for startups

Disadvantages:
  - Less control
  - Limited customization
  - Platform limitations

Cost Estimate (per month):
  Free Tier: $0 (limited)
  Hobby: ~$50
  Startup (10K users): ~$300
  Scale (100K users): ~$1,500
```

### Deployment Pipeline

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/vercel-action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          production: true

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          push: true
          tags: taskterminal/api:${{ github.sha }}
      - name: Deploy to Railway
        run: |
          railway up --service api
```

### Database Schema (PostgreSQL)

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  role VARCHAR(50) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workspaces table
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(50) DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Workspace members
CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  due_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'Not Started',
  priority VARCHAR(50) DEFAULT 'Medium',
  project VARCHAR(255),
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes for common queries
  INDEX idx_workspace_id (workspace_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_due_date (due_date),
  INDEX idx_project (project),
  INDEX idx_parent_task_id (parent_task_id)
);

-- Row-Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_workspace_policy ON tasks
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = current_setting('app.user_id')::UUID
    )
  );

-- Notes table
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Integrations table
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(workspace_id, type)
);

-- Agent audit logs
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  input_text TEXT,
  output_text TEXT,
  function_calls JSONB,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhooks table
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 11. Migration Roadmap

### Phase 1: Backend Foundation (Months 1-2)

**Goal**: Build API, auth, and basic task CRUD

```
Week 1-2: Setup & Infrastructure
- Set up repositories (monorepo or multi-repo)
- Configure dev/staging/prod environments
- Set up PostgreSQL database
- Implement authentication (JWT + OAuth)
- Create API boilerplate

Week 3-4: Core API
- Task CRUD endpoints
- Project management
- Filtering & sorting
- Notes functionality

Week 5-6: User & Workspace Management
- User registration/login
- Workspace creation
- Member invitations
- Role-based access control

Week 7-8: Testing & Documentation
- Unit tests (80% coverage)
- Integration tests
- API documentation (OpenAPI/Swagger)
- Load testing
```

### Phase 2: Frontend Migration (Months 3-4)

**Goal**: Rebuild UI with React, maintain terminal aesthetic

```
Week 1-2: Component Library
- Set up React + TypeScript
- Build terminal-style components
- Replicate existing UI
- Command input system

Week 3-4: Core Features
- Task list/table
- Task creation modal
- Task editing
- Filtering UI
- Sorting UI

Week 5-6: Sync & Offline Support
- Implement sync engine
- IndexedDB for offline storage
- Conflict resolution
- Loading states

Week 7-8: Polish & Testing
- Command history
- Keyboard shortcuts
- Animations (overdue tasks)
- E2E tests (Playwright)
- Performance optimization
```

### Phase 3: Real-Time & Collaboration (Month 5)

**Goal**: Add WebSocket support and multi-user features

```
Week 1-2: WebSocket Infrastructure
- Set up WebSocket server
- Implement pub/sub pattern
- Presence indicators
- Real-time task updates

Week 3-4: Collaboration Features
- Activity feed
- @mentions
- Task assignments
- Comments on tasks
- Workspace chat (optional)
```

### Phase 4: Integrations (Months 6-7)

**Goal**: Launch first 5 integrations

```
Week 1-2: Integration Framework
- OAuth client implementation
- Webhook system
- Integration settings UI

Week 3-6: Build Integrations (parallel)
- Slack (highest priority)
- GitHub
- Google Calendar
- Zapier
- One more based on feedback

Week 7-8: Testing & Documentation
- Integration guides
- Example use cases
- Video tutorials
```

### Phase 5: AI Agents (Months 8-9)

**Goal**: Launch AI-powered features

```
Week 1-2: Agent Infrastructure
- LLM integration (OpenAI/Anthropic)
- Function calling setup
- Agent registry
- Permission system

Week 3-4: Core Agents
- NLP parser
- Smart scheduler
- Task decomposer

Week 5-6: Advanced Agents
- Priority recommender
- Conflict detector
- Daily briefing

Week 7-8: Agent Controls
- Approval workflows
- Audit logs
- Settings & preferences
- Usage analytics
```

### Phase 6: Polish & Launch (Month 10)

**Goal**: Production-ready, public launch

```
Week 1-2: Performance & Optimization
- Database query optimization
- Frontend bundle size reduction
- CDN setup
- Caching strategy

Week 3: Security Audit
- Penetration testing
- Code audit
- Dependency updates
- Rate limiting tuning

Week 4: Launch Preparation
- Marketing site
- Documentation
- Pricing page
- Blog posts
- Product Hunt launch
```

---

## 12. Cost Projections

### Development Costs

```
Assumption: Small team (2-3 developers)

Phase 1-2 (Foundation): 4 months
  - 1 Backend Engineer: $120K/yr ÷ 12 × 4 = $40K
  - 1 Frontend Engineer: $120K/yr ÷ 12 × 4 = $40K
  - Subtotal: $80K

Phase 3-5 (Features): 5 months
  - 1 Backend Engineer: $120K/yr ÷ 12 × 5 = $50K
  - 1 Frontend Engineer: $120K/yr ÷ 12 × 5 = $50K
  - 1 DevOps/Full-Stack: $130K/yr ÷ 12 × 3 = $32.5K
  - Subtotal: $132.5K

Phase 6 (Launch): 1 month
  - Full team: ~$30K

Total Development: ~$242.5K

OR: Use contractors/agencies: ~$150-200K
```

### Operational Costs (Monthly)

```
Infrastructure (PaaS model):
  - Vercel (Frontend): $20 (Pro plan)
  - Railway (Backend): $50 (Hobby plan)
  - Supabase (Database): $25 (Pro plan)
  - Upstash (Redis): $10
  - S3 Storage: $10
  - CDN: $20
  - Monitoring: $50
  - Total: ~$185/month at launch

LLM API Costs:
  - OpenAI: $0.01/1K tokens (GPT-4)
  - Anthropic: $0.015/1K tokens (Claude 3 Opus)
  - Estimated: $200-500/month (1K active users)

Third-Party Services:
  - Auth0/Clerk: $25-100/month
  - Email (SendGrid): $15/month
  - Error tracking (Sentry): $26/month
  - Total: ~$66/month

Grand Total: ~$451/month at launch
Scaling to 10K users: ~$1,500/month
Scaling to 100K users: ~$8,000/month
```

---

## 13. Success Metrics

```yaml
Technical Metrics:
  - API Response Time: p95 < 200ms
  - Uptime: 99.9% (8.76 hours downtime/year)
  - Error Rate: < 0.1%
  - Test Coverage: > 80%
  - Build Time: < 5 minutes
  - Deploy Frequency: Multiple times per day

Product Metrics:
  - User Sign-ups: Track weekly
  - Activation Rate: % who create 5+ tasks
  - Retention: Day 1, Day 7, Day 30
  - MAU (Monthly Active Users): Target 10K in Year 1
  - Task Creation Rate: Avg tasks per user per week
  - Integration Usage: % of users with ≥1 integration
  - AI Agent Usage: % of tasks created via NLP

Business Metrics:
  - Free → Pro Conversion: Target 5-10%
  - MRR (Monthly Recurring Revenue): Track growth
  - Churn Rate: Target < 5%/month
  - NPS (Net Promoter Score): Target > 50
  - Customer Acquisition Cost (CAC): Track
  - Lifetime Value (LTV): Target LTV:CAC ratio > 3:1
```

---

## 14. Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Database performance at scale | Medium | High | Implement caching, read replicas, query optimization |
| WebSocket connection stability | Medium | Medium | Fallback to polling, reconnection logic |
| AI agent hallucinations | High | Medium | Human-in-the-loop, approval workflows |
| Third-party API rate limits | Medium | Medium | Implement retry logic, queue system |
| Security breach | Low | Critical | Regular audits, bug bounty, insurance |
| Vendor lock-in | Medium | Medium | Use cloud-agnostic tools where possible |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Market saturation (Notion, etc.) | High | High | Focus on terminal UX differentiation |
| Slow user adoption | Medium | High | Content marketing, Product Hunt launch |
| Competition from open-source | Medium | Medium | Offer superior cloud features, support |
| Pricing too low | Medium | Medium | Start with higher prices, discount early adopters |
| Feature creep | High | Medium | Strict roadmap, MVP mentality |

---

## 15. Future Enhancements (Post-Launch)

### Year 1 (Post-Launch)
- Mobile apps (iOS, Android)
- CLI tool for terminal power users
- Browser extensions (Chrome, Firefox)
- Recurring tasks
- Task templates
- Gantt chart view
- Calendar view
- Time tracking
- Pomodoro timer
- Team analytics
- Custom fields

### Year 2
- Public API for developers
- Marketplace for integrations
- Custom agents (user-created)
- Workflow automation builder
- Advanced reporting
- White-label solution (Enterprise)
- Desktop apps (Electron)
- Offline-first mobile experience
- Email-to-task
- Voice commands (Alexa, Siri)

---

## Conclusion

This specification provides a comprehensive roadmap for evolving TaskTerminal from a local, offline-first web app to a full-featured, cloud-based task management platform with authentication, integrations, and AI capabilities.

**Key Takeaways**:

1. **Preserve Core Strengths**: Terminal UX, keyboard-first, fast performance
2. **Iterative Approach**: Launch MVP, gather feedback, iterate
3. **API-First**: Enable extensibility and future integrations
4. **Security Focus**: Authentication, authorization, encryption from Day 1
5. **AI as Enhancement**: Not replacement for manual control
6. **Cost-Conscious**: Start with PaaS, optimize later
7. **Timeline**: 10 months from start to public launch
8. **Budget**: ~$250K dev + ~$500/mo ops (initial)

**Next Steps**:
1. Validate market demand (user interviews, surveys)
2. Secure funding or bootstrap
3. Hire team or engage contractors
4. Begin Phase 1 implementation
5. Set up beta testing program
6. Launch!

---

**Document Version**: 1.0
**Last Updated**: December 2024
**Status**: Planning / Specification
**Owner**: TaskTerminal Team
