# Multi-Host Collaborative Workspaces for Koda

## Deep Research Report

**Date**: January 31, 2026  
**Scope**: Architecture research for multi-host agent collaboration  
**Stack Context**: Tauri 2.x (Rust) + React frontend + Node.js sidecar

---

## Executive Summary

Koda's vision of multi-host collaborative workspaces—where developers can see and interact with each other's agent sessions across machines—is architecturally feasible with existing technologies. The key insight is correct: **"it's just agents in a computer and a UI layer on top."** The complexity lies entirely in the sync/collaboration layer.

**Recommended Approach**: A hybrid architecture using:
1. **Yjs (CRDT)** for document/state synchronization
2. **Self-hosted y-websocket or y-hub backend** for production scaling
3. **Custom awareness protocol** for agent presence/activity
4. **SQLite + CRDT overlay** for selective sync of existing schema

This provides the best balance of:
- Implementation speed (Yjs ecosystem is mature)
- Cost efficiency (self-hosted, no per-MAU pricing)
- Flexibility (own the sync layer, can iterate)
- Performance (Yjs is the fastest CRDT implementation)

**Estimated Implementation Complexity**: 3-4 weeks for MVP collaboration, 6-8 weeks for production-ready system.

---

## 1. Liveblocks Deep Dive

### What is Liveblocks?

Liveblocks is a **managed collaboration infrastructure platform** that provides:
- Real-time presence and cursors
- Conflict-free data synchronization (built on Yjs internally)
- Comments and notifications
- AI agent integration

### Architecture

```
┌─────────────────┐     ┌─────────────────────────────────┐
│   Your App      │────▶│  Liveblocks Cloud               │
│   (React SDK)   │◀────│  - WebSocket Infrastructure     │
└─────────────────┘     │  - Room Management              │
                        │  - Presence Distribution         │
                        │  - Storage (LiveObject/Yjs)      │
                        │  - Auth/Permissions              │
                        └─────────────────────────────────┘
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Projects** | Top-level containers (maps to your app) |
| **Tenants** | Workspace/org isolation for multi-tenant apps |
| **Rooms** | Collaboration spaces (like a shared document) |
| **Presence** | Ephemeral user state (cursors, selection) |
| **Storage** | Persistent shared state (LiveObject, LiveList, LiveMap) |
| **Yjs Integration** | Can use raw Yjs with Liveblocks as provider |

### Pricing (Critical Factor)

| Plan | MAU | Cost | Notes |
|------|-----|------|-------|
| Starter | Free | $0 | 500 rooms, 256MB storage |
| Plus | $99/mo | $0.03/room after 500 | 8GB storage |
| Business | $149/mo | $0.03/room after 500 | SOC 2, SAML SSO |
| Enterprise | Custom | Custom | SLA, dedicated support |

**Key Pricing Concerns**:
- **$0.03 per room** adds up fast with agent sessions
- If each workspace = 1 room, costs scale linearly
- MAU-based pricing (monthly active users) is predictable but adds friction

### AI Agents Feature

Liveblocks has native AI agent support:
- **Liveblocks AI Copilots**: Dashboard-configured, works with OpenAI/Anthropic/Gemini
- **Framework agents** (private beta): Connect external agents via webhooks

This is interesting but:
- Designed for their copilot model (in-app AI assistant)
- Not designed for cross-host agent orchestration
- Framework agents feature isn't generally available

### Can Liveblocks Sync Agent Sessions?

**Technically yes**, with significant caveats:

✅ **Works well for**:
- Session metadata sync
- Presence (who's online, what they're doing)
- Comments and annotations
- UI state coordination

⚠️ **Challenges**:
- Agent message streams are high-frequency, high-volume
- Terminal output sync would require custom handling
- No built-in concept of "remote agent control"
- Vendor lock-in on core collaboration feature

### Verdict on Liveblocks

**Not recommended as primary solution** for Koda's use case:

1. **Cost**: Agent-heavy workflows = many rooms = high costs
2. **Lock-in**: Core feature depends on third-party service
3. **Mismatch**: Designed for document collaboration, not agent orchestration
4. **Control**: Can't customize sync behavior for agent-specific needs

**Potential use**: Could complement self-hosted solution for specific features (Comments component is excellent) but shouldn't be the foundation.

---

## 2. CRDT Analysis: Yjs vs Automerge

### What are CRDTs?

**Conflict-free Replicated Data Types** are data structures that:
- Can be modified independently by multiple peers
- Automatically merge without conflicts
- Eventually converge to same state regardless of operation order

Unlike OT (Operational Transform), CRDTs don't require a central server for conflict resolution—though having one simplifies architecture.

### Yjs

**Created by**: Kevin Jahns  
**Language**: JavaScript (TypeScript types available)  
**Maturity**: Production-ready, used by many major products

#### Architecture

```javascript
// Core concept: Y.Doc holds shared types
const ydoc = new Y.Doc()

// Shared types that sync automatically
const ymap = ydoc.getMap('session-metadata')
const yarray = ydoc.getArray('messages')
const ytext = ydoc.getText('terminal-output')

// Changes propagate to all connected peers
ymap.set('status', 'running')
yarray.push([{ role: 'user', content: 'Hello' }])
```

#### Key Features

| Feature | Description |
|---------|-------------|
| **Shared Types** | Y.Map, Y.Array, Y.Text, Y.XmlFragment |
| **Awareness** | Separate protocol for presence (cursors, selection, status) |
| **Providers** | Network-agnostic: WebSocket, WebRTC, custom |
| **Editor Bindings** | Monaco, ProseMirror, Quill, CodeMirror, Tiptap |
| **Performance** | "Kicks the pants off" other CRDTs (proven benchmarks) |
| **Offline** | Full offline support, syncs when reconnected |

#### Providers Ecosystem

| Provider | Use Case | Scaling |
|----------|----------|---------|
| **y-websocket** | Simple client-server | Single server |
| **y-hub (y-redis)** | Production scaling | Redis + S3/Postgres |
| **y-webrtc** | P2P, demos | No server needed |
| **Liveblocks** | Managed service | Auto-scale |
| **Hocuspocus** | Self-hosted, full-featured | Redis for scale |

#### y-hub Architecture (Recommended for Production)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Clients   │────▶│   Server    │────▶│    Redis    │
│(y-websocket)│◀────│ (WebSocket) │◀────│  (pub/sub)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │                   ▼
                           │            ┌─────────────┐
                           │            │   Worker    │
                           │            │(background) │
                           │            └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ PostgreSQL  │     │     S3      │
                    │ (metadata)  │     │  (blobs)    │
                    └─────────────┘     └─────────────┘
```

Key benefits:
- **Memory efficient**: Server doesn't hold Y.Doc in memory, streams through Redis
- **Scalable**: Horizontal scaling, load balancer friendly
- **Auth built-in**: JWT + permission callbacks to your backend
- **Database agnostic**: S3 + Postgres, or implement custom storage

### Automerge

**Created by**: Martin Kleppmann + Ink & Switch team  
**Language**: Rust (with JS/WASM bindings)  
**Philosophy**: "PostgreSQL for local-first apps"

#### Key Differences from Yjs

| Aspect | Yjs | Automerge |
|--------|-----|-----------|
| **Core language** | JavaScript | Rust (WASM for JS) |
| **Performance** | Fastest | Very fast (improved in v3) |
| **Memory** | Efficient | 10x reduction in v3 |
| **Ecosystem** | Larger, more providers | Smaller, growing |
| **Focus** | Editor collaboration | General local-first |
| **API** | Shared types | JSON-like document |
| **Network** | Provider-based | Sync protocol |

#### Automerge Code Example

```javascript
import * as Automerge from '@automerge/automerge'

// Create document
let doc = Automerge.init()
doc = Automerge.change(doc, d => {
  d.sessions = {}
  d.sessions['session-1'] = { 
    status: 'running',
    messages: []
  }
})

// Merge changes from remote
const update = getUpdateFromNetwork()
doc = Automerge.merge(doc, Automerge.load(update))
```

### CRDT Comparison Table

| Feature | Yjs | Automerge |
|---------|-----|-----------|
| **Maturity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **JavaScript Ecosystem** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Editor Integrations** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Documentation** | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Self-hosting Options** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Rich Text** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **React Integration** | ⭐⭐⭐⭐ | ⭐⭐⭐ |

### Recommendation: Yjs

For Koda's use case, **Yjs is the clear winner**:

1. **More mature ecosystem** for the types of data you're syncing
2. **Monaco integration** already exists (y-monaco)
3. **Better provider options** for self-hosting (y-hub, Hocuspocus)
4. **Awareness protocol** is built specifically for presence
5. **Easier to integrate** with existing Node.js sidecar
6. **Liveblocks uses Yjs internally**—you can always migrate to managed later

---

## 3. Multiplayer Architectures Study

### Figma's Approach

Figma's multiplayer is **the gold standard** for collaborative design tools. Key insights:

#### Architecture Choices

- **Not using OTs**: Too complex, combinatorial explosion of states
- **Not using pure CRDTs**: Unnecessary overhead for centralized system
- **CRDT-inspired**: Last-writer-wins register for properties

#### Key Design Decisions

1. **Atomic changes at property level**: Each (ObjectID, Property, Value) tuple syncs independently
2. **Parent-child via child link**: Object stores parent reference, not children list
3. **Fractional indexing**: For ordering children (position as fraction 0-1)
4. **Server as authority**: Rejects cycles, validates changes
5. **Optimistic local updates**: Client applies immediately, reconciles with server

```
Document Structure: Map<ObjectID, Map<Property, Value>>

Conflict Resolution:
- Same property, same object → last write wins (server-ordered)
- Same property, different objects → no conflict
- Different properties, same object → no conflict
```

#### Relevance to Koda

Figma's insights apply directly:
- **Session state** = Map of properties (status, context count, messages)
- **Message ordering** = Fractional indexing or sequence numbers
- **Agent activity** = Ephemeral presence, not persisted

### Linear's Approach

Linear uses **hybrid sync**:
- Real-time for active users (WebSocket)
- Background sync for offline/inactive
- Server remains source of truth
- Client-side state management with optimistic updates

### Notion's Model

Notion uses **block-based CRDTs**:
- Each block is an atomic unit
- Blocks have parent/child relationships
- Real-time sync via WebSocket
- Offline-first with conflict resolution

### Common Patterns

All successful collaborative tools share:

1. **Central server for coordination** (even with CRDTs)
2. **Optimistic local updates** for responsiveness
3. **Ephemeral presence** separate from persistent state
4. **Property-level conflict resolution**
5. **Fractional indexing** for ordered collections

---

## 4. Agent-to-Agent Visibility Problem

### The Core Challenge

```
Machine A                          Machine B
┌────────────────┐                ┌────────────────┐
│ Agent A        │                │ Agent B        │
│ - Claude Code  │                │ - Codex        │
│ - Context: X   │                │ - Context: Y   │
│ - Working on   │                │ - Working on   │
│   feature/foo  │                │   feature/bar  │
└────────┬───────┘                └────────┬───────┘
         │                                 │
         ▼                                 ▼
┌────────────────┐                ┌────────────────┐
│ Human A        │                │ Human B        │
│ - Sees Agent A │                │ - Sees Agent B │
│ - Wants to see │◀──── ??? ────▶│ - Wants to see │
│   Agent B too  │                │   Agent A too  │
└────────────────┘                └────────────────┘
```

### What Needs to Cross the Wire

| Data Type | Sync Strategy | Frequency | Storage |
|-----------|---------------|-----------|---------|
| Session metadata | CRDT (Y.Map) | On change | Persistent |
| Agent status | Awareness | Every 30s | Ephemeral |
| Message stream | CRDT (Y.Array) | Per message | Persistent |
| Terminal output | CRDT (Y.Text) | Streaming | Ephemeral/Persistent |
| File changes | Git (not CRDT) | On commit | Git repo |
| Cursor/selection | Awareness | Real-time | Ephemeral |
| Comments | CRDT (Y.Array) | On change | Persistent |

### Proposed Message Routing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Collaboration Server                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              y-hub (WebSocket Server)                │    │
│  │  - Rooms: workspace:{workspace_id}                   │    │
│  │  - Auth: JWT tokens from Koda auth                   │    │
│  │  - Persistence: S3 + Postgres                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│  ┌─────────────────────────┼─────────────────────────────┐  │
│  │                   Redis (PubSub)                       │  │
│  │  - Channel: y:{workspace_id}:updates                  │  │
│  │  - Channel: y:{workspace_id}:awareness                │  │
│  └─────────────────────────┼─────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Machine A   │    │   Machine B   │    │   Machine C   │
│   (Koda App)  │    │   (Koda App)  │    │   (Mobile)    │
│ ┌───────────┐ │    │ ┌───────────┐ │    │ ┌───────────┐ │
│ │ Sidecar   │ │    │ │ Sidecar   │ │    │ │ Web View  │ │
│ │ + Agents  │ │    │ │ + Agents  │ │    │ │ (read-    │ │
│ └───────────┘ │    │ └───────────┘ │    │ │  only)    │ │
│ ┌───────────┐ │    │ ┌───────────┐ │    │ └───────────┘ │
│ │ React UI  │ │    │ │ React UI  │ │    └───────────────┘
│ │ + y-client│ │    │ │ + y-client│ │
│ └───────────┘ │    │ └───────────┘ │
└───────────────┘    └───────────────┘
```

### Human on Machine A Directing Agent B on Machine B

**Flow**:

1. Human A opens shared workspace in Koda UI
2. UI shows all active sessions (synced via CRDT)
3. Human A sees Agent B's session on Machine B
4. Human A types message → stored in Y.Array for that session
5. Message syncs to Machine B via collaboration server
6. Machine B's sidecar detects new message in CRDT
7. Machine B's sidecar sends message to Agent B's stdin
8. Agent B responds → sidecar writes to CRDT
9. Response syncs back to Human A's UI

**Key Insight**: The sidecar on each machine acts as a **bridge** between local agents and the shared CRDT state.

### Shared Workspace State Data Model

```typescript
// Yjs Document Structure for a shared workspace
interface SharedWorkspaceState {
  // Persistent, synced via Y.Map
  metadata: {
    id: string
    name: string
    repository: string
    branch: string
    createdAt: string
    ownerUserId: string
  }
  
  // Persistent, synced via Y.Map  
  sessions: Map<SessionId, {
    id: string
    agentType: 'claude' | 'codex' | 'kimi'
    status: 'idle' | 'running' | 'paused'
    hostMachineId: string  // Which machine owns this session
    model: string
    contextTokenCount: number
    createdAt: string
  }>
  
  // Persistent, synced via Y.Array
  messages: Map<SessionId, Array<{
    id: string
    sessionId: string
    role: 'user' | 'assistant'
    content: string
    authorUserId: string  // Who sent the message
    sourceMachineId: string
    turnId: string
    timestamp: string
  }>>
  
  // Persistent, synced via Y.Array
  comments: Array<{
    id: string
    userId: string
    filePath: string
    lineNumber: number
    body: string
    resolved: boolean
    timestamp: string
  }>
  
  // Ephemeral, synced via Awareness
  presence: Map<UserId, {
    name: string
    color: string
    machineId: string
    activeSessionId?: string
    cursor?: { file: string, line: number, column: number }
    lastSeen: number
  }>
}
```

---

## 5. What Needs Syncing

### Analysis of Koda's Current Schema

Looking at the existing SQLite schema:

| Table | Local-Only? | Needs Sync? | Sync Strategy |
|-------|-------------|-------------|---------------|
| `users` | No | Yes | CRDT or server-canonical |
| `git_identities` | Yes | No | Security-sensitive, local |
| `repos` | Partial | Optional | Could share repo configs |
| `workspaces` | No | Yes | Core collaboration unit |
| `workspace_shares` | No | Yes | Permissions |
| `sessions` | No | Yes | Agent visibility |
| `session_messages` | No | Yes | Agent interaction |
| `diff_comments` | No | Yes | Review collaboration |
| `visual_snapshots` | No | Partial | Large binaries, sync metadata |
| `git_checkpoints` | Yes | No | Machine-specific |
| `settings` | Yes | No | User preferences |
| `session_recordings` | Partial | Optional | Could share replays |

### Sync Priority Tiers

**Tier 1 - Must Sync (MVP)**:
- Workspace metadata
- Session metadata (who's running what)
- Session messages (for remote interaction)
- Presence/awareness

**Tier 2 - Should Sync (Phase 2)**:
- Diff comments
- Workspace shares/permissions
- Visual snapshot metadata

**Tier 3 - Nice to Sync (Phase 3)**:
- Session recordings
- Repository configurations

### Terminal Output Considerations

Terminal output is tricky:

| Approach | Pros | Cons |
|----------|------|------|
| **Full sync** | Complete visibility | Bandwidth, storage |
| **Metadata only** | Lightweight | Limited visibility |
| **Last N lines** | Good balance | Still significant data |
| **On-demand** | Most efficient | Latency for viewers |

**Recommendation**: Sync metadata + last 100 lines in CRDT, full history available on-demand via direct request to host machine.

### File Changes: Git vs CRDT

**Don't sync file contents via CRDT**. Git is designed for this.

Instead:
- Sync workspace `branch` name
- Sync commit hashes / git state
- Each machine pulls from remote as needed
- For live file editing: open in Monaco with y-monaco binding

---

## 6. Proposed Sync Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Koda Collaboration Layer                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  y-hub Server    │    │  Auth Service    │                  │
│  │  (WebSocket)     │◀──▶│  (JWT tokens)    │                  │
│  └────────┬─────────┘    └──────────────────┘                  │
│           │                                                      │
│  ┌────────┴─────────┐                                           │
│  │      Redis       │                                           │
│  │  (streams, pub)  │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│  ┌────────┴─────────┐    ┌──────────────────┐                  │
│  │  y-hub Worker    │───▶│  S3 + Postgres   │                  │
│  │  (persistence)   │    │  (document store)│                  │
│  └──────────────────┘    └──────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │   Koda A    │    │   Koda B    │    │   Mobile    │
    │             │    │             │    │   (Web)     │
    │ ┌─────────┐ │    │ ┌─────────┐ │    │             │
    │ │ Sidecar │ │    │ │ Sidecar │ │    │             │
    │ │ ┌─────┐ │ │    │ │ ┌─────┐ │ │    │             │
    │ │ │Agent│ │ │    │ │ │Agent│ │ │    │             │
    │ │ └─────┘ │ │    │ │ └─────┘ │ │    │             │
    │ └────┬────┘ │    │ └────┬────┘ │    │             │
    │      │      │    │      │      │    │             │
    │ ┌────┴────┐ │    │ ┌────┴────┐ │    │ ┌─────────┐ │
    │ │Yjs Sync │ │    │ │Yjs Sync │ │    │ │Yjs Sync │ │
    │ │ Layer   │ │    │ │ Layer   │ │    │ │ Layer   │ │
    │ └────┬────┘ │    │ └────┬────┘ │    │ └────┬────┘ │
    │      │      │    │      │      │    │      │      │
    │ ┌────┴────┐ │    │ ┌────┴────┐ │    │ ┌────┴────┐ │
    │ │ React   │ │    │ │ React   │ │    │ │ React   │ │
    │ │ UI      │ │    │ │ UI      │ │    │ │ Web UI  │ │
    │ └─────────┘ │    │ └─────────┘ │    │ └─────────┘ │
    └─────────────┘    └─────────────┘    └─────────────┘
```

### Data Flow

#### Scenario: User A sends message to Agent B

```
User A (Machine A)                Server                User B (Machine B)
       │                            │                         │
       │  Type message in UI        │                         │
       │ ─────────────────────────▶ │                         │
       │  (WebSocket: Yjs update)   │                         │
       │                            │                         │
       │                            │ ──────────────────────▶ │
       │                            │  Broadcast update       │
       │                            │                         │
       │                            │                   ┌─────┴─────┐
       │                            │                   │ Sidecar   │
       │                            │                   │ detects   │
       │                            │                   │ message   │
       │                            │                   └─────┬─────┘
       │                            │                         │
       │                            │                   ┌─────┴─────┐
       │                            │                   │ Agent B   │
       │                            │                   │ processes │
       │                            │                   └─────┬─────┘
       │                            │                         │
       │                            │ ◀────────────────────── │
       │                            │  Agent response update  │
       │                            │                         │
       │ ◀────────────────────────  │                         │
       │  Broadcast response        │                         │
       │                            │                         │
       │  UI updates with response  │                         │
       ▼                            ▼                         ▼
```

### Sidecar Integration

The sidecar needs a new **Sync Module**:

```typescript
// apps/sidecar/src/sync/index.ts

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { Awareness } from 'y-protocols/awareness'

export class SyncManager {
  private doc: Y.Doc
  private provider: WebsocketProvider
  private awareness: Awareness
  
  constructor(
    private workspaceId: string,
    private machineId: string,
    private authToken: string
  ) {
    this.doc = new Y.Doc()
    
    // Connect to collaboration server
    this.provider = new WebsocketProvider(
      process.env.COLLAB_SERVER_URL,
      `workspace:${workspaceId}`,
      this.doc,
      { params: { auth: authToken } }
    )
    
    this.awareness = this.provider.awareness
    
    // Watch for remote messages targeting local sessions
    this.setupMessageWatcher()
  }
  
  // Expose shared types for the workspace
  get sessions() { return this.doc.getMap('sessions') }
  get messages() { return this.doc.getMap('messages') }
  get comments() { return this.doc.getArray('comments') }
  
  // Set local user presence
  setPresence(state: PresenceState) {
    this.awareness.setLocalState({
      ...state,
      machineId: this.machineId,
      lastSeen: Date.now()
    })
  }
  
  // Watch for messages sent to sessions on this machine
  private setupMessageWatcher() {
    this.messages.observeDeep((events) => {
      for (const event of events) {
        // Check if message is for a local session
        // If so, route to appropriate agent handler
      }
    })
  }
}
```

### Frontend Integration

```typescript
// apps/desktop/src/hooks/useCollaboration.ts

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useState } from 'react'

export function useCollaboration(workspaceId: string) {
  const [doc, setDoc] = useState<Y.Doc | null>(null)
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)
  const [connected, setConnected] = useState(false)
  const [peers, setPeers] = useState<Map<number, any>>(new Map())
  
  useEffect(() => {
    const ydoc = new Y.Doc()
    const wsProvider = new WebsocketProvider(
      import.meta.env.VITE_COLLAB_URL,
      `workspace:${workspaceId}`,
      ydoc,
      { params: { auth: getAuthToken() } }
    )
    
    wsProvider.on('status', ({ status }) => {
      setConnected(status === 'connected')
    })
    
    wsProvider.awareness.on('change', () => {
      setPeers(new Map(wsProvider.awareness.getStates()))
    })
    
    setDoc(ydoc)
    setProvider(wsProvider)
    
    return () => wsProvider.destroy()
  }, [workspaceId])
  
  return { doc, provider, connected, peers }
}
```

---

## 7. Security & Permissions Model

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Koda Auth  │────▶│  y-hub      │
│             │     │  Service    │     │  Server     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                  │                   │
       │  1. Login        │                   │
       │ ───────────────▶ │                   │
       │                  │                   │
       │  2. JWT token    │                   │
       │ ◀─────────────── │                   │
       │                  │                   │
       │  3. Connect with token               │
       │ ────────────────────────────────────▶│
       │                  │                   │
       │                  │ 4. Verify token   │
       │                  │◀──────────────────│
       │                  │                   │
       │                  │ 5. Permission     │
       │                  │    callback       │
       │                  │◀──────────────────│
       │                  │                   │
       │                  │ 6. Response       │
       │                  │──────────────────▶│
       │                  │                   │
       │  7. Connection established           │
       │ ◀────────────────────────────────────│
```

### Permission Levels

```typescript
type Permission = 'view' | 'comment' | 'control' | 'admin'

interface WorkspacePermissions {
  // Default access for workspace
  defaultAccess: Permission | null
  
  // Group-based access
  groups: Map<GroupId, Permission>
  
  // User-specific overrides  
  users: Map<UserId, Permission>
}

// Permission inheritance:
// User > Group > Default
```

### Permission Capabilities

| Permission | See Sessions | See Messages | Comment | Send Messages | Control Agent |
|------------|--------------|--------------|---------|---------------|---------------|
| `view` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `comment` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `control` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ + manage |

### Implementing Permission Callback

```typescript
// Koda auth service endpoint that y-hub calls

app.get('/auth/perm/:room/:userid', async (req, res) => {
  const { room, userid } = req.params
  
  // Extract workspace ID from room name
  // Room format: "workspace:{workspaceId}"
  const workspaceId = room.replace('workspace:', '')
  
  // Check database for permissions
  const permission = await getWorkspacePermission(userid, workspaceId)
  
  // Map Koda permissions to y-hub access
  const yaccess = {
    'admin': 'rw',
    'control': 'rw', 
    'comment': 'rw',  // Can write comments but not control
    'view': 'read-only',
    null: 'no-access'
  }[permission]
  
  res.json({
    yroom: room,
    yaccess,
    yuserid: userid,
    // Custom data passed to client
    permissions: {
      canControl: permission === 'control' || permission === 'admin',
      canComment: permission !== 'view' && permission !== null
    }
  })
})
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Set up y-hub server with Redis + Postgres
- [ ] Implement auth service with JWT generation
- [ ] Permission callback endpoint
- [ ] Basic Yjs integration in React frontend
- [ ] Presence/awareness working across tabs

### Phase 2: Session Sync (Week 2-3)

- [ ] Define Yjs shared types for sessions
- [ ] Sidecar sync module
- [ ] Session metadata syncing
- [ ] Message syncing between machines
- [ ] UI shows remote sessions

### Phase 3: Agent Control (Week 3-4)

- [ ] Remote message routing
- [ ] Sidecar detects and routes remote messages
- [ ] Agent response syncing
- [ ] Permission enforcement for control

### Phase 4: Polish & Features (Week 5-6)

- [ ] Diff comments via CRDT
- [ ] Terminal output syncing
- [ ] Offline support
- [ ] Conflict resolution UI
- [ ] Mobile web view

### Phase 5: Production Ready (Week 6-8)

- [ ] Load testing
- [ ] Security audit
- [ ] Documentation
- [ ] Deployment automation
- [ ] Monitoring and observability

---

## 9. Recommended Approach Summary

### Technology Stack

| Component | Technology | Reasoning |
|-----------|------------|-----------|
| **CRDT Library** | Yjs | Best ecosystem, performance, editor bindings |
| **WebSocket Server** | y-hub | Scalable, auth built-in, self-hosted |
| **Persistence** | S3 + Postgres | Standard, reliable, works with y-hub |
| **Message Broker** | Redis | Required by y-hub, good for pub/sub |
| **Auth** | JWT (lib0/crypto) | Standard, works with y-hub |

### Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| **Self-host vs Liveblocks** | More work, but more control and lower cost |
| **Yjs vs Automerge** | More mature ecosystem vs newer approach |
| **Sync all messages** | More bandwidth vs complete history |
| **Terminal output** | Sync last N lines vs full sync |
| **File sync** | Don't sync files, use git instead |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Scale** | y-hub designed for horizontal scaling |
| **Complexity** | Start with minimal sync, expand gradually |
| **Offline conflicts** | CRDT handles this automatically |
| **Security** | JWT + permission callbacks + audit logging |
| **Cost** | Self-hosted, pay for compute not MAU |

### Cost Estimate (Self-Hosted)

| Component | Estimated Cost | Notes |
|-----------|----------------|-------|
| y-hub Server (2 instances) | $50-100/mo | For redundancy |
| Redis (managed) | $30-50/mo | Could be self-hosted |
| PostgreSQL (managed) | $30-50/mo | Could be self-hosted |
| S3 | $5-10/mo | For document storage |
| **Total** | ~$115-210/mo | vs Liveblocks at $99-149/mo + per-room fees |

At scale, self-hosted becomes significantly cheaper than Liveblocks.

---

## 10. Conclusion

Multi-host collaborative workspaces for Koda are achievable with a well-designed architecture based on Yjs. The key components are:

1. **Yjs** as the CRDT foundation for conflict-free sync
2. **y-hub** as a scalable, auth-enabled WebSocket server
3. **Awareness protocol** for presence and ephemeral state
4. **Sidecar sync module** to bridge local agents with shared state
5. **Permission system** to control who can see and control what

This architecture delivers:
- Real-time visibility across machines
- Remote agent control
- Offline support
- Scalability
- Cost efficiency
- Full control over the collaboration stack

The recommendation is to start with **Phase 1 & 2** (3-4 weeks) to validate the architecture with basic session and message syncing, then iterate from there.

---

## Appendix A: Code Examples

### Yjs Document Schema

```typescript
// Type definitions for the shared Yjs document

import * as Y from 'yjs'

export function initSharedTypes(doc: Y.Doc) {
  // Workspace metadata
  const metadata = doc.getMap<string>('metadata')
  
  // Sessions indexed by sessionId
  const sessions = doc.getMap<Y.Map<any>>('sessions')
  
  // Messages indexed by sessionId → array of messages
  const messages = doc.getMap<Y.Array<any>>('messages')
  
  // Comments array
  const comments = doc.getArray<any>('comments')
  
  return { metadata, sessions, messages, comments }
}

// Helper to add a session
export function addSession(
  sessions: Y.Map<Y.Map<any>>,
  sessionData: SessionData
) {
  const sessionMap = new Y.Map()
  Object.entries(sessionData).forEach(([k, v]) => sessionMap.set(k, v))
  sessions.set(sessionData.id, sessionMap)
}

// Helper to add a message
export function addMessage(
  messages: Y.Map<Y.Array<any>>,
  sessionId: string,
  message: MessageData
) {
  if (!messages.has(sessionId)) {
    messages.set(sessionId, new Y.Array())
  }
  messages.get(sessionId)!.push([message])
}
```

### Awareness Setup

```typescript
import { Awareness } from 'y-protocols/awareness'

interface UserPresence {
  name: string
  color: string
  machineId: string
  activeSessionId?: string
  cursor?: {
    file: string
    line: number
    column: number
  }
}

export function setupAwareness(
  awareness: Awareness,
  currentUser: { id: string; name: string; color: string },
  machineId: string
) {
  // Set initial presence
  awareness.setLocalStateField('user', {
    name: currentUser.name,
    color: currentUser.color,
    machineId
  })
  
  // Listen for presence changes
  awareness.on('change', ({ added, updated, removed }) => {
    const states = awareness.getStates()
    
    // Update UI with current users
    const users = Array.from(states.entries())
      .map(([clientId, state]) => ({
        clientId,
        ...state.user
      }))
    
    // Emit event for UI update
    emitPresenceChange(users)
  })
  
  // Heartbeat to stay "online"
  setInterval(() => {
    awareness.setLocalStateField('lastSeen', Date.now())
  }, 30000)
}
```

---

## Appendix B: y-hub Configuration

```env
# .env file for y-hub deployment

# Redis connection
REDIS=redis://localhost:6379
REDIS_PREFIX=koda

# S3 storage
S3_ENDPOINT=s3.amazonaws.com
S3_PORT=443
S3_SSL=true
S3_ACCESS_KEY=AKIAXXXXXXXXXXXXXXXX
S3_SECRET_KEY=secretkey
S3_YHUB_BUCKET=koda-collab

# PostgreSQL connection
POSTGRES=postgres://koda:password@localhost:5432/koda_collab

# Authentication
AUTH_PUBLIC_KEY={"kty":"EC",...}
AUTH_PRIVATE_KEY={"kty":"EC",...}
AUTH_PERM_CALLBACK=https://api.koda.app/collab/auth/perm

# Document update webhook (optional)
YDOC_UPDATE_CALLBACK=https://api.koda.app/collab/doc-update

# Server
PORT=3002
LOG=@y/hub
```

---

*Report compiled January 31, 2026*
