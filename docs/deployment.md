# Deploy OpenMail to Cloudflare

This guide is written for first-time deployers. OpenMail runs as two Cloudflare Workers:

- The web app, built from Next.js with OpenNext, serves the UI and API routes.
- The email worker receives Cloudflare Email Routing messages, stores raw mail in R2, and saves metadata in D1.

Both workers share one D1 database and one R2 bucket.

## 1. Prerequisites

Create or install:

- A Cloudflare account.
- A domain added to Cloudflare if you want to receive email.
- Node.js 20 or newer.
- pnpm. This project uses pnpm only.

Install dependencies:

```bash
pnpm install
```

Log in to Cloudflare:

```bash
pnpm wrangler login
```

The installer can also start this login flow for you if you skip this step.

## 2. Recommended: Use the Installer

Create a production env file:

```bash
cp .env.example .env.prod
```

Fill in at least:

```bash
BETTER_AUTH_SECRET=your-random-secret
BETTER_AUTH_URL=https://your-openmail-domain.com
ADMIN_EMAIL=you@example.com
```

Generate a secret with:

```bash
openssl rand -base64 32
```

Optional login providers:

```bash
EMAIL_PASSWORD_LOGIN_ENABLED=true
AUTH_RESEND_API_KEY=your-resend-api-key
AUTH_RESEND_FROM=OpenMail <noreply@your-domain.com>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
CLOUDFLARE_AI_ACCOUNT_ID=...
CLOUDFLARE_AI_API_TOKEN=...
```

Not sure which values you need? Start with [Which Config Do You Need?](#3-which-config-do-you-need).

Preview what the installer will do:

```bash
pnpm install:cloudflare:dry-run
```

Run the installer:

```bash
pnpm install:cloudflare
```

For unattended installs:

```bash
pnpm install:cloudflare -- --yes
```

To prepare Cloudflare resources, secrets, and migrations without deploying:

```bash
pnpm install:cloudflare -- --skip-deploy
```

By default, the installer configures the web Worker custom domain from `BETTER_AUTH_URL`. To skip DNS/custom-domain setup:

```bash
pnpm install:cloudflare -- --disable-dns
```

To deploy multiple copies in one Cloudflare account, add a prefix:

```bash
pnpm install:cloudflare -- --prefix demo
```

This creates and patches names like `demo-openmail`, `demo-openmail-email`, `demo-mail-db`, and `demo-mail-raw`.

The installer will:

- Validate `.env.prod`.
- Show a masked config summary.
- Install project dependencies if Wrangler is missing.
- Start `wrangler login` if you are not logged in.
- Create or reuse `mail-db` and `mail-raw`, or prefixed names when `--prefix` is used.
- Patch `wrangler.jsonc` and `wrangler.email.jsonc`, including the web custom domain unless `--disable-dns` is used.
- Apply D1 migrations.
- Upload secrets from `.env.prod`.
- Deploy the web worker and email worker unless `--skip-deploy` is used.

## 3. Which Config Do You Need?

Start with the required values, then add optional providers only when you want those features.

### Required Auth Settings (Required)

- `BETTER_AUTH_SECRET`: Required. Better Auth uses this to sign and protect authentication data. Generate a long random value with `openssl rand -base64 32`.
- `BETTER_AUTH_URL`: Required. This is the public URL of your deployed OpenMail web app, such as `https://mail.example.com`. OAuth callbacks and email verification links depend on it.
- `ADMIN_EMAIL`: Required. This email becomes the admin account for managing OpenMail.

Setup help: [Recommended installer setup](#2-recommended-use-the-installer).

### Google OAuth Login (Recommended)

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Add these if you want "Sign in with Google". Both values must be set together. Leave both empty to disable Google login.

Get keys: [Google OAuth Client ID And Secret](#google-oauth-client-id-and-secret).

### GitHub OAuth Login

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

Add these if you want "Sign in with GitHub". Both values must be set together. Leave both empty to disable GitHub login.

Get keys: [GitHub OAuth Client ID And Secret](#github-oauth-client-id-and-secret).

### Email/Password Login

- `EMAIL_PASSWORD_LOGIN_ENABLED`: Optional. Set to `true` if you want users to sign up and sign in with an email address and password.
- `AUTH_RESEND_API_KEY`: Optional. When set, OpenMail sends email verification links through Resend for email/password accounts.
- `AUTH_RESEND_FROM`: Optional when Resend is enabled. This is the sender shown on verification emails. Use a verified sender in production.

If you leave `EMAIL_PASSWORD_LOGIN_ENABLED=false`, users can only use enabled OAuth providers.

Get keys: [Resend API Key](#resend-api-key).

### Cloudflare AI Features (Recommended)

- `CLOUDFLARE_AI_ACCOUNT_ID`
- `CLOUDFLARE_AI_API_TOKEN`

Add these if you want the email worker to classify or summarize incoming mail with Cloudflare AI. Both values must be set together. If you skip them, OpenMail can still receive and store email, but AI-generated summaries/categories may not work.

Get keys: [Cloudflare AI Account ID And API Token](#cloudflare-ai-account-id-and-api-token).

## 4. Get Provider Keys

Use your final `BETTER_AUTH_URL` when creating OAuth apps. If your app will live at `https://mail.example.com`, use that exact domain in the examples below.

### Google OAuth Client ID And Secret

1. Open Google Cloud credentials: https://console.cloud.google.com/apis/credentials
2. Create a project or select an existing project.
3. If Google asks for OAuth consent setup, configure the consent screen first. For a public open source deployment, start with "External" unless you are using a Google Workspace-only app.
4. Click "Create credentials", then choose "OAuth client ID".
5. Choose "Web application".
6. Add this authorized JavaScript origin:

```text
https://your-openmail-domain.com
```

7. Add this authorized redirect URI:

```text
https://your-openmail-domain.com/api/auth/callback/google
```

8. Copy the generated client ID and client secret into `.env.prod`:

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Google reference: https://developers.google.com/identity/protocols/oauth2/web-server

### GitHub OAuth Client ID And Secret

1. Open GitHub Developer settings: https://github.com/settings/developers
2. Click "OAuth Apps", then "New OAuth App".
3. Set "Application name" to something recognizable, such as `OpenMail`.
4. Set "Homepage URL":

```text
https://your-openmail-domain.com
```

5. Set "Authorization callback URL":

```text
https://your-openmail-domain.com/api/auth/callback/github
```

6. Create the app, then copy the client ID.
7. Generate a new client secret and copy it into `.env.prod`:

```bash
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

GitHub reference: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app

### Resend API Key

Resend is only needed if you enable email/password login and want verification emails.

1. Open Resend API Keys: https://resend.com/api-keys
2. For production, verify your sending domain in Resend first.
3. Create an API key.
4. Put the key in `.env.prod`:

```bash
AUTH_RESEND_API_KEY=your-resend-api-key
```

5. Set a sender address. In production, use a sender from your verified domain:

```bash
AUTH_RESEND_FROM=OpenMail <noreply@your-domain.com>
```

Resend reference: https://resend.com/docs/dashboard/api-keys/introduction

### Cloudflare AI Account ID And API Token

Cloudflare AI is optional and is used by the email worker for AI-powered mail processing.

1. Open the Cloudflare dashboard: https://dash.cloudflare.com
2. Select your account. The account ID is usually visible in the dashboard URL and on account overview pages.
3. Open Cloudflare API Tokens: https://dash.cloudflare.com/profile/api-tokens
4. Create an API token that can call Workers AI for your account.
5. Put the values in `.env.prod`:

```bash
CLOUDFLARE_AI_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_AI_API_TOKEN=your-cloudflare-ai-api-token
```

Cloudflare token reference: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/

## 5. Manual Setup Alternative

Use this path if you do not want the installer to create resources or patch config files.

### Create Cloudflare Storage

Create the D1 database:

```bash
pnpm wrangler d1 create mail-db
```

Wrangler prints a `database_id`. Copy it into both files:

- `wrangler.jsonc`
- `wrangler.email.jsonc`

Keep the binding name as `MAIL_DB`.

Create the R2 bucket:

```bash
pnpm wrangler r2 bucket create mail-raw
```

Keep the bucket binding as `MAIL_R2` in both Wrangler config files.

### Configure Environment Variables

Copy the example file for local development:

```bash
cp .env.example .env
```

Set at least:

```bash
BETTER_AUTH_SECRET=your-random-secret
BETTER_AUTH_URL=https://your-openmail-domain.com
ADMIN_EMAIL=you@example.com
```

Generate a secret with:

```bash
openssl rand -base64 32
```

Optional login providers:

```bash
EMAIL_PASSWORD_LOGIN_ENABLED=true
AUTH_RESEND_API_KEY=your-resend-api-key
AUTH_RESEND_FROM=OpenMail <noreply@your-domain.com>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
CLOUDFLARE_AI_ACCOUNT_ID=...
CLOUDFLARE_AI_API_TOKEN=...
```

For Google and GitHub OAuth, add these callback URLs in the provider dashboards:

```text
https://your-openmail-domain.com/api/auth/callback/google
https://your-openmail-domain.com/api/auth/callback/github
```

Set production secrets on the web worker:

```bash
pnpm wrangler secret put BETTER_AUTH_SECRET --config wrangler.jsonc
pnpm wrangler secret put BETTER_AUTH_URL --config wrangler.jsonc
pnpm wrangler secret put ADMIN_EMAIL --config wrangler.jsonc
pnpm wrangler secret put EMAIL_PASSWORD_LOGIN_ENABLED --config wrangler.jsonc
pnpm wrangler secret put AUTH_RESEND_API_KEY --config wrangler.jsonc
pnpm wrangler secret put AUTH_RESEND_FROM --config wrangler.jsonc
pnpm wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
pnpm wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc
pnpm wrangler secret put GITHUB_CLIENT_ID --config wrangler.jsonc
pnpm wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.jsonc
```

You can skip any optional provider secrets you are not using.

### Apply Database Migrations

Run the remote D1 migrations:

```bash
pnpm db:remote:migrate
```

This creates the Better Auth tables and OpenMail tables in your Cloudflare D1 database.

### Deploy the Web App

Build and deploy the Next.js app to Cloudflare Workers:

```bash
pnpm worker:deploy
```

After deploy, Wrangler prints a Workers URL. Visit it and sign in.

If you use a custom domain, attach it to the `openmail` Worker in Cloudflare Workers & Pages.

### Deploy the Email Worker

The email worker receives inbound email from Cloudflare Email Routing.

Deploy it:

```bash
pnpm email-worker:deploy
```

Optional AI classification uses Cloudflare Workers AI credentials:

```bash
pnpm wrangler secret put CLOUDFLARE_AI_ACCOUNT_ID --config wrangler.email.jsonc
pnpm wrangler secret put CLOUDFLARE_AI_API_TOKEN --config wrangler.email.jsonc
```

If you skip these, incoming mail can still be stored, but summaries/categories may fail.

## 6. Connect Email Routing

In the Cloudflare dashboard:

1. Open your domain.
2. Go to Email Routing.
3. Enable Email Routing and add the DNS records Cloudflare requests.
4. Create a custom address or catch-all route.
5. Route matching email to the `openmail-email` Worker.

In OpenMail, sign in as the admin user and link the receiving address from the settings page. Incoming messages to linked addresses will appear in the inbox.

## 7. Smoke Test

After everything is deployed:

1. Open the deployed OpenMail URL.
2. Sign in with an enabled auth method.
3. Go through onboarding and add a receiving email address.
4. Send a test email to that address.
5. Confirm the message appears in `/mail`.
6. Create an API key in `/settings/apikey` if you want to use the API.

## Updating Later

Pull the latest code, install dependencies, apply any new migrations, then redeploy:

```bash
pnpm install
pnpm db:remote:migrate
pnpm worker:deploy
pnpm email-worker:deploy
```

## Troubleshooting

- `D1_ERROR` or missing tables: run `pnpm db:remote:migrate`.
- Mail does not arrive: verify Cloudflare Email Routing is enabled and routes to `openmail-email`.
- Raw email cannot load: check that both Wrangler configs use the same `MAIL_R2` bucket.
- Login callback fails: confirm `BETTER_AUTH_URL` matches your deployed URL and OAuth callback URLs.
- Email/password verification mail is missing: check `AUTH_RESEND_API_KEY` and `AUTH_RESEND_FROM`.
- Admin page is unavailable: make sure `ADMIN_EMAIL` exactly matches the signed-in user email.

## Useful References

- Cloudflare D1 getting started: https://developers.cloudflare.com/d1/get-started/
- Cloudflare R2 bucket creation: https://developers.cloudflare.com/r2/buckets/create-buckets/
- Cloudflare Email Workers: https://developers.cloudflare.com/email-service/api/route-emails/email-handler/
- OpenNext Cloudflare adapter: https://opennext.js.org/cloudflare/get-started
