FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install --global pnpm@11.17.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

ARG NEXT_PUBLIC_SERVER_API
ENV NEXT_PUBLIC_SERVER_API=$NEXT_PUBLIC_SERVER_API
ENV NODE_ENV=production
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
