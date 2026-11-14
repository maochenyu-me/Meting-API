FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

ARG UID
ARG GID
ARG PORT

ENV UID=${UID:-1010}
ENV GID=${GID:-1010}
ENV PORT=${PORT:-3000}

RUN addgroup -g ${GID} --system meting \
    && adduser -G meting --system -D -s /bin/sh -u ${UID} meting

RUN chown -R meting:meting /app
USER meting

EXPOSE ${PORT}

CMD ["node", "/app/node.js"]
