FROM node:22-alpine
WORKDIR /app/BackEnd
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node index.js db.js ./
USER node
EXPOSE 3001
CMD ["node", "index.js"]
