# support-bot

A minimal customer-support chat agent. Each incoming message is answered by
one stateless LLM call — the agent keeps **no memory between sessions**, so a
returning user has to re-explain who they are and what they asked last time.

## What it does today

- `handleMessage(userId, text)` → one LLM call, returns a reply
- No persistence: every call starts from a blank slate

## What it needs

Per-user memory that survives across sessions: when `userId` comes back, the
agent should recall facts it learned about them earlier. This is a
multi-tenant product — thousands of end users, each with their own memory —
so whatever backs the memory must isolate one user's data from another's.

The project already runs on Postgres.
