# Tiny long-lived worker that runs commute recompute jobs on the Docker host itself
# (see otp/worker/server.ts for why: Vercel serverless functions can't run this long).
# Only installs the two packages this actually needs — not the whole Next.js app's deps.
# Needs Node 22+: @supabase/supabase-js requires a global WebSocket implementation to
# construct its (unused, but always-initialized) realtime client — Node 20 doesn't have
# one built in, Node 22 does.
FROM node:22-alpine
WORKDIR /app

COPY otp/worker/package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY public/data ./public/data
COPY otp/worker/server.ts ./otp/worker/server.ts

EXPOSE 8091
CMD ["npx", "tsx", "otp/worker/server.ts"]
