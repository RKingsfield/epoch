FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./

FROM deps AS base
RUN npm ci
COPY . .
RUN npm run build

FROM base AS test
RUN npm test

FROM deps AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=base /app/dist ./dist
COPY --from=frontend /frontend/out ./public
RUN chown -R node:node /app
USER node
EXPOSE 5342
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5342/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/main"]
