FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
RUN bun add serve

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun -e "fetch('http://localhost:' + (process.env.PORT || '3000')).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "bun -e \"const url=process.env.VITE_API_URL||process.env.API_URL||'/api';require('fs').writeFileSync('dist/config.js','window.__RUNTIME_CONFIG__='+JSON.stringify({apiBaseUrl:url}))\" && bunx serve dist -s -l tcp://0.0.0.0:${PORT:-3000}"]
