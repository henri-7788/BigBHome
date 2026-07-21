# Tiny long-lived worker that runs commute recompute jobs on the Docker host itself
# (see otp/worker/server.ts for why: Vercel serverless functions can't run this long).
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY otp/worker ./otp/worker

EXPOSE 8091
CMD ["npx", "tsx", "otp/worker/server.ts"]
