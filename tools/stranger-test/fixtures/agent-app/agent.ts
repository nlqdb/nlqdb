// support-bot — a stateless customer-support agent.
//
// Every message is one LLM round-trip with no memory of prior sessions.
// The product is multi-tenant: many end users, each needing their own
// memory that no other user can read. The stack already uses Postgres.
//
// TODO: give this agent persistent per-user memory.

export type Message = { userId: string; text: string };

// One stateless LLM call. Nothing about `userId` is remembered after this
// returns — the next message from the same user starts from zero.
export async function handleMessage(_msg: Message): Promise<string> {
  throw new Error("not implemented — see README.md");
}
