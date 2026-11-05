# Deploy

Three pieces: Postgres 18, the API (`apps/api`, Express) and the web app (`apps/web`, Next.js).
Run **one API instance** only: the renewal job is an in-process `node-cron` timer
(see the `ponytail:` note in `apps/api/src/jobs/renewals.ts`).

## 1. Postgres

Create a database and a user. Set `DATABASE_URL` for the API. Back it up daily; the
renewal job and all payments depend on it.

## 2. API

```
npm ci
cd apps/api
npx prisma generate          # src/generated is not committed
npx prisma migrate deploy    # apply migrations
npx tsx src/server.ts        # listens on $PORT (default 4000)
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | API port (default 4000) |
| `NODE_ENV=production` | Makes the session cookie `secure` |
| `WEB_URL` | Public web URL, used in emailed links |
| `COOKIE_DOMAIN` | Shared parent domain, e.g. `.example.com` (see section 4) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email. Unset = emails are only logged to the console, so renewal and verification mails are lost |
| `BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_TOKEN_KEY` | Bunny Stream video |
| `ASAAS_API_KEY` | Production key of the platform's Asaas account |
| `ASAAS_WEBHOOK_TOKEN` | Secret you choose; Asaas must send it back (section 3) |
| `ASAAS_BASE_URL` | Unset = sandbox (`https://api-sandbox.asaas.com/v3`). **Set to `https://api.asaas.com/v3` in production** |

## 3. Webhooks

- **Asaas** → `POST https://<api>/webhooks/payments`. In Asaas, set the authentication
  token to the value of `ASAAS_WEBHOOK_TOKEN` and enable `PAYMENT_CONFIRMED`,
  `PAYMENT_RECEIVED` and `PAYMENT_REFUNDED`. Payments and refunds only change access
  when these arrive.
- **Bunny Stream** → `POST https://<api>/webhooks/video` (video status updates).

Both endpoints are public by design; the payment one rejects requests without the token.

## 4. Web

```
cd apps/web
API_URL=https://<api> npx next build
API_URL=https://<api> npx next start
```

The web app proxies `/api/*` to `API_URL`, so browser calls are same-origin. If the API
is also reached directly from another host, give both a shared parent domain
(`app.example.com`, `api.example.com`) and set `COOKIE_DOMAIN=.example.com`.

## 5. Before taking money

- Asaas sub-accounts must be enabled for the platform account (sandbox returned 403 on
  `POST /accounts`; see the spike findings in
  `openspec/changes/add-course-marketplace/design.md`).
- Boleto charges cannot be refunded through the Asaas API; refunds of those fail with
  `refund_failed` and must be handled manually.
- Review consumer-law refund rules, invoicing and the privacy policy (buyer CPF/CNPJ is
  stored per charge); see `.TODO`.
