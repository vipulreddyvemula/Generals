# node:22-alpine — Active LTS, supported through April 2027.
# Do NOT use node:16 (reached EOL September 2023).
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

# --omit=dev excludes devDependencies from the production image.
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["./startup.sh"]