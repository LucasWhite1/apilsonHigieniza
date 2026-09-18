FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src

ENV NODE_ENV=production
ENV PORT=4545
EXPOSE 4545
CMD ["node", "src/server.js"]
