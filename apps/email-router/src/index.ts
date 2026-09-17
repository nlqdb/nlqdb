// Inbound mail for nlqdb.com + nlqdb.ai. Bound to the Email Routing
// catch-all rule of both zones.
//
// The contract: a message is either forwarded to the inbox or retried by
// the sending server. It is never permanently rejected and never silently
// consumed, so no inbound mail can be lost by a routing decision here.

// forward() only accepts addresses verified under Email Routing →
// Destination Addresses. An address on our own zones is not a valid
// target: it is unverified and resolves back through our own MX.
const INBOX = "omer.hochman@gmail.com";

// DMARC aggregate reports (`_dmarc` rua=mailto:dmarc@nlqdb.com) are
// machine-readable XML that nobody opens, and their volume is what trips
// Gmail's 4.7.28 bulk-mail rate limiter — which then delays real mail for
// hours. Keep them out of the inbox; the log line below is the record.
const REPORT_MAILBOXES = new Set(["dmarc"]);

type Verdict = "pass" | "suspicious" | "unknown";

export default {
  async email(message: ForwardableEmailMessage): Promise<void> {
    // Cloudflare does not always stamp Authentication-Results on
    // Worker-delivered mail, so a verdict may be unavailable entirely.
    const authResults =
      message.headers.get("Authentication-Results") ??
      message.headers.get("ARC-Authentication-Results") ??
      "";
    const verdict = authVerdict(authResults);

    const entry = {
      from: message.from,
      to: message.to,
      subject: message.headers.get("subject"),
      rawSize: message.rawSize,
      auth: authResults,
      verdict,
    };

    if (isReportMailbox(message.to)) {
      console.info(JSON.stringify({ ...entry, action: "report-only" }));
      return;
    }

    try {
      await message.forward(INBOX, stamp(verdict, message.to));
      console.info(JSON.stringify({ ...entry, action: "forwarded" }));
    } catch (error) {
      // Rethrowing makes Cloudflare return a temporary SMTP error, so the
      // sending server retries. setReject() is permanent and is the one
      // way to actually lose the message.
      console.error(JSON.stringify({ ...entry, action: "forward-failed", error: String(error) }));
      throw error;
    }
  },
};

function authVerdict(authResults: string): Verdict {
  // An ARC header often reads `arc=none` and carries no SPF/DKIM/DMARC
  // verdict at all. That is absence of evidence, not a pass.
  if (!/\b(?:spf|dkim|dmarc)=/i.test(authResults)) return "unknown";
  return /spf=(?:fail|softfail)|dkim=fail|dmarc=fail/i.test(authResults) ? "suspicious" : "pass";
}

function isReportMailbox(recipient: string): boolean {
  const address = recipient.match(/<([^>]+)>/)?.[1] ?? recipient;
  const localPart = address.split("@")[0]?.split("+")[0]?.toLowerCase() ?? "";
  return REPORT_MAILBOXES.has(localPart);
}

// A suspicious verdict is a label, not a block: the message still reaches
// the inbox, where a Gmail filter can sort on these headers. forward()
// accepts X-* headers only.
function stamp(verdict: Verdict, originalTo: string): Headers {
  return new Headers({
    "X-Nlqdb-Auth-Verdict": verdict,
    "X-Nlqdb-Original-To": originalTo,
  });
}
