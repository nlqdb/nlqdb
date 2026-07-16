# Free Intercom alternatives — research (2026-07)

Context: [`SUPPORT.md`](../../SUPPORT.md) currently states we offer **no
real-time chat** (no Slack/Discord/Intercom). This doc is the research
input for whenever we decide to add a chat/support widget to
`apps/web` / `docs.nlqdb.com`. It does **not** decide anything —
adopting one means updating SUPPORT.md in the same PR.

Constraint lens: pre-PMF, ~1 operator, free-tier-first
([GLOBAL-013](../decisions/GLOBAL-013-cloudflare-free-tier.md) ethos —
$0/mo until a trigger fires). Free-tier claims below were verified on
vendor pricing pages on 2026-07-16, not from listicles.

## Hosted, free tier (no infra to run)

| Tool | Free tier (verified) | Catch / first paid step |
|---|---|---|
| **tawk.to** | Genuinely free: live chat + email ticketing + knowledge base, **unlimited agents, unlimited chats/history** | "Powered by tawk.to" branding (small fee to remove); AI assist is a paid add-on. Dated UX, ad-supported business model |
| **Crisp** | 2 seats, website chat widget, shared inbox, mobile/desktop apps, unlimited conversations | Triggers, email inbox, knowledge base are paid; Mini $45/mo, Essentials $95/mo (flat per workspace, not per seat) |
| **Chatwoot Cloud** ("Hacker" plan) | 2 agents, 500 conversations/mo, live chat, notes/labels | **30-day data retention**; Startups $19/agent/mo adds email/social channels |
| **Tidio** | 10 seats, live chat + ticketing, but only **50 billable conversations/mo** | Starter ~$24/mo for 100 conversations — the conversation cap is the real limit |
| **Zoho SalesIQ** | 3 operators, **100 chat sessions/mo**, 10K tracked visitors | Session cap; paid plans per-operator |
| **HubSpot free tools** | Free live chat + shared inbox bundled with free CRM, unlimited-ish | HubSpot branding on widget; pulls you into the HubSpot suite; heavyweight for a chat widget |
| **Brevo Conversations** | Free plan includes 1 seat chat widget | Fine if we ever use Brevo for email anyway (see [`email-and-marketing.md`](email-and-marketing.md)) |

## Open source / self-hosted

| Tool | Notes |
|---|---|
| **Chatwoot** (self-hosted, MIT community edition) | The de-facto OSS Intercom clone (~20K+ GitHub stars, active). Full omnichannel (chat, email, WhatsApp/Telegram/socials). Needs Rails + Postgres + Redis — i.e. a VPS (~$5–10/mo), **not** deployable on our Cloudflare-Workers free tier, so "self-hosted" is not actually $0 for us |
| **Zammad** | Helpdesk/ticketing first (email, chat, phone channels, SLAs). Heavier than we need pre-PMF; same VPS cost caveat |
| **FreeScout** | Free self-hosted Help Scout clone; shared email inbox, chat via paid modules. PHP/MySQL, cheap to run, but email-inbox-shaped, not widget-shaped |
| **Papercups** | Elixir/React OSS Intercom clone — **effectively unmaintained** (hosted service shut down, commits stalled). Avoid |

## Read of the options

- **Absolute $0 forever, most Intercom-like feature set:** tawk.to —
  the only one with no agent/conversation caps on free. Trade-off is
  branding + a less polished widget.
- **Best widget quality / dev-tool-credible on free:** Crisp (2 seats
  is enough for us) or Chatwoot Cloud free (aligns with our OSS
  positioning; 500 conv/mo is far above pre-PMF volume, but 30-day
  retention loses support history).
- **Self-hosting Chatwoot** only makes sense once we already pay for a
  VPS for something else; today it violates the $0 constraint that
  hosted free tiers meet.
- Tidio/Zoho free tiers are caps-first designs (50–100
  conversations/mo) — fine at zero volume, but they exist to force an
  upgrade.

Sources: vendor pricing pages ([tawk.to](https://www.tawk.to/pricing/),
[Crisp](https://crisp.chat/en/pricing/),
[Chatwoot](https://www.chatwoot.com/pricing/),
[Tidio](https://www.tidio.com/pricing/),
[Zoho SalesIQ](https://www.zoho.com/salesiq/pricing.html)) fetched
2026-07-16; OSS landscape via
[chatwoot/chatwoot](https://github.com/chatwoot/chatwoot),
[opensourcealternative.to](https://opensourcealternative.to/alternativesto/intercom),
[helpzen.io OSS roundup](https://helpzen.io/blog/open-source-intercom-alternative).
