FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY . .
RUN cd client && npm run build

FROM node:20-alpine

RUN apk add --no-cache docker-cli docker-cli-compose

RUN addgroup -S mikus && adduser -S mikus -G mikus

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/client/dist ./client/dist
COPY server ./server

RUN mkdir -p /app/stacks /app/data && chown -R mikus:mikus /app/stacks /app/data

USER mikus

EXPOSE 3001

ENV PORT=3001
ENV NODE_ENV=production

CMD ["node", "server/index.js"]
