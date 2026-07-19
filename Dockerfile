FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
COPY shared/ shared/
RUN cd frontend && npm run build

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./

FROM deps AS base
RUN npm ci
COPY . .
RUN npm run build

FROM base AS test
RUN npm test && npm run test:e2e

FROM deps AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=base /app/dist ./dist
COPY --from=frontend /app/frontend/out ./public
RUN chown -R node:node /app
USER node
EXPOSE 5342
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5342/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
# shared/ in tsconfig include shifts rootDir to project root → output lands in dist/src/
CMD ["node", "dist/src/main"]
