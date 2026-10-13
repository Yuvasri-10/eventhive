FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
# Run as the unprivileged user that ships with the node image
USER node
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
