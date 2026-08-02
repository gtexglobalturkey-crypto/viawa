FROM node:22-bookworm-slim AS build

WORKDIR /opt/viawa
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY src ./src
COPY vite-plugins ./vite-plugins
COPY document-service ./document-service
RUN npm run document-service:typecheck && npm run document-service:build

FROM node:22-bookworm-slim AS runtime

LABEL org.opencontainers.image.title="VIAWA Document Service"
LABEL org.opencontainers.image.description="Authenticated production DOCX generation runtime"

WORKDIR /opt/viawa
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      libreoffice-writer fontconfig fonts-dejavu-core fonts-liberation2 fonts-noto-core locales \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp/viawa-document-service /opt/viawa/templates \
    && chown -R node:node /opt/viawa /tmp/viawa-document-service

COPY --from=build --chown=node:node /opt/viawa/node_modules ./node_modules
COPY --from=build --chown=node:node /opt/viawa/document-service/dist ./document-service/dist
COPY --chown=node:node resources/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx \
  ./templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx

ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 \
    DOCUMENT_TEMPLATE_PATH=/opt/viawa/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx \
    DOCUMENT_TEMP_ROOT=/tmp/viawa-document-service
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "document-service/dist/server.js"]
