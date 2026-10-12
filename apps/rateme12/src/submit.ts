// Journey 4 — submit a server: `/submit`. Signed out, the live product shows
// only its account card (create account / sign in / GitHub / Google); the
// submit form itself sits behind it. The card works without JavaScript: the
// tabs are a GET form, the card POSTs here and calls src/data.ts. Until the
// §5b last mile no account can exist, so a post re-renders the card with the
// honest not-connected notice, keeping what was typed except the password.
// The live card's Turnstile widget has no site key here yet — §5a step 5 logs it.

import { signIn } from "./data.ts";
import { html, type View } from "./layout.ts";

type Mode = "create" | "signin";

const githubIcon = html`<svg class="btn-social-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path></svg>`;

const googleIcon = html`<svg class="btn-social-icon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path></svg>`;

// Shown where the live card shows a failed sign-in.
const accountsNotConnected = html`<p class="submit-error" role="alert">
    Accounts aren't connected yet: this rebuild keeps them in
    <a href="https://nlqdb.com">nlqdb</a>, and that step isn't wired yet. Nothing
    you entered was stored.
  </p>`;

function tab(mode: Mode, current: Mode, label: string) {
  return html`<button type="submit" form="auth-mode" name="mode" value="${mode}" class="${mode === current ? "active" : ""}">${label}</button>`;
}

function submitView(mode: Mode, values: Record<string, string> = {}, posted = false): View {
  const create = mode === "create";
  return {
    title: "Submit an MCP server — rateme12",
    body: html`<div class="submit-intro">
  <h1>Submit an MCP server</h1>
  <p>Add a server to the directory. You'll need an account — it's the only thing here that does.</p>
</div>
<form id="auth-mode" method="GET" action="/submit"></form>
<form class="submit-card" method="POST" action="/submit">
  <input type="hidden" name="mode" value="${mode}" />
  <!-- First submit button = Enter's default: a password submit, not GitHub. -->
  <button type="submit" name="method" value="password" hidden tabindex="-1" aria-hidden="true"></button>
  <div class="submit-social">
    <button type="submit" name="method" value="github" formnovalidate class="btn btn-social btn-social-github">${githubIcon}Continue with GitHub</button>
    <button type="submit" name="method" value="google" formnovalidate class="btn btn-social btn-social-google">${googleIcon}Continue with Google</button>
  </div>
  <div class="submit-or"><span>or</span></div>
  <div class="submit-tabs">
    ${tab("create", mode, "Create account")}
    ${tab("signin", mode, "Sign in")}
  </div>
  <p class="submit-hint">Browsing needs no account — publishing a server does.</p>
  ${create ? html`<label>Name<input name="name" autocomplete="name" required value="${values["name"] ?? ""}" /></label>` : ""}
  <label>Email<input name="email" autocomplete="email" required type="email" value="${values["email"] ?? ""}" /></label>
  <label>Password<input name="password" autocomplete="${create ? "new-password" : "current-password"}" minlength="8" required type="password" /></label>
  ${posted ? accountsNotConnected : ""}
  <button type="submit" name="method" value="password" class="btn">${create ? "Create account" : "Sign in"}</button>
</form>`,
  };
}

export async function submitPage(url: URL): Promise<View> {
  return submitView(url.searchParams.get("mode") === "signin" ? "signin" : "create");
}

export async function submitPost(form: FormData): Promise<View> {
  const values: Record<string, string> = {};
  for (const [key, value] of form) if (typeof value === "string") values[key] = value;
  await signIn(values);
  // Only the not-connected state exists until §5b: no session is ever set.
  return submitView(values["mode"] === "signin" ? "signin" : "create", values, true);
}
