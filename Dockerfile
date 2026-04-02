# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Values only needed so `vinext build` can load auth/LLM modules; override at runtime.
ENV MONGODB_URI=mongodb://mongo:27017/feedback_poc
ENV AUTH_SECRET=build-time-placeholder-min-32-chars-long
ENV AUTH_GOOGLE_ID=build
ENV AUTH_GOOGLE_SECRET=build
ENV AUTH_GITHUB_ID=build
ENV AUTH_GITHUB_SECRET=build
ENV LLM_API_KEY=build
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
RUN apt-get update -y && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app /app
EXPOSE 3000
CMD ["npm", "run", "start"]
