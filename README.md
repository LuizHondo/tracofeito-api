# tracofeito-api

Express + Prisma + Postgres. Deploys on its own with Docker.

## Run on a server (first time)
```
git clone <repo> && cd tracofeito-api
cp .env.example .env   # set POSTGRES_PASSWORD, WEB_URL, COOKIE_DOMAIN, ASAAS_*, ...
docker compose up -d --build
```
On start the container applies migrations and loads the mock data **only if the database
has no users** (logins `admin|marina.tracos|caio.pixel|bia.aquarela|ana|joao|lu @demo.test`,
password `senha123`). Data lives in the `pgdata` volume, so redeploys keep it.
Never run `docker compose down -v`.

To drop the mock data later, delete the `@demo.test` users and remove `SEED_IF_EMPTY=1 npx tsx prisma/seed.ts &&` from the Dockerfile CMD.

## Auto-deploy
Push to `main` runs `.github/workflows/deploy.yml`, which SSHes in, pulls and rebuilds.
Repo secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH` (the server's clone must be able to `git pull`, e.g. via a deploy key).

## Local dev
`npm i && npx prisma generate && npx prisma migrate dev && npm run seed && npm run dev`

`src/shared` is a copy of the validation/pricing code that also lives in the web repo (`lib/shared`); keep them in sync.
See `docs/deploy.md` for the webhook and env var reference.
