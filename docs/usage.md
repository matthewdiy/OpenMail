# Using OpenMail

This guide explains the everyday OpenMail workflow after the app is deployed.

## Sign In

Open your deployed OpenMail URL and sign in with one of the auth methods enabled in your environment:

- Google OAuth, when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- GitHub OAuth, when `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set.
- Email/password, when `EMAIL_PASSWORD_LOGIN_ENABLED=true`.

If Resend verification is enabled with `AUTH_RESEND_API_KEY`, new email/password users must verify their email before signing in.

## First Run

After signing in, OpenMail sends new users through onboarding. The important step is linking a receiving email address to your account.

Incoming mail appears only when all of these are true:

- Cloudflare Email Routing is enabled for your domain.
- The route sends matching messages to the OpenMail email worker.
- The receiving address is linked to your OpenMail user.

## Inbox

The inbox shows mail received for your linked addresses. Use it to:

- Read parsed email content.
- View sender, subject, recipient, and received time.
- Open the raw email when you need original headers or source content.
- Filter or review categories when Cloudflare AI classification is configured.

Raw message files are stored in R2, while message metadata is stored in D1.

## Sending Mail

OpenMail includes a compose flow for sending messages from linked addresses. Make sure the sending provider settings are configured before relying on outbound mail in production.

## Settings

Use settings to manage:

- Linked receiving addresses.
- Account preferences.
- API keys.
- Admin-only domain and mail-provider settings.

The admin area is available to the user whose email matches `ADMIN_EMAIL`.

## API Keys

Create API keys from `/settings/apikey` when you want to call the OpenMail API from another app or script.

API documentation lives in [api.md](api.md).

## Operations

For deployment, resource setup, migrations, and provider keys, use [deployment.md](deployment.md).

Common maintenance commands:

```bash
pnpm install
pnpm db:remote:migrate
pnpm worker:deploy
pnpm email-worker:deploy
```

If incoming mail stops arriving, check Cloudflare Email Routing first, then confirm the route still points to the deployed email worker.
