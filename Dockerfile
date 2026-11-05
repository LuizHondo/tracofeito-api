FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production
EXPOSE 4000
# Migrate, seed mock data only when the DB is empty, then start. ponytail: one instance only (in-process renewal cron).
CMD ["sh", "-c", "npx prisma migrate deploy && SEED_IF_EMPTY=1 npx tsx prisma/seed.ts && exec npx tsx src/server.ts"]
