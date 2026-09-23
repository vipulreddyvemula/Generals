# node:22-alpine — Active LTS, supported through April 2027.
# Do NOT use node:16 (reached EOL September 2023).
FROM node:22-alpine

WORKDIR /app

RUN npm install --global pnpm@11.17.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN pnpm prisma generate

COPY . .
RUN pnpm run build

EXPOSE 3001

CMD ["./startup.sh"]
