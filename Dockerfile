FROM node:18-alpine

WORKDIR /app

# Copy backend package files first (better caching)
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Copy app source
COPY backend ./backend
COPY frontend ./frontend

# Expose API port
EXPOSE 3000

# Default env (can be overridden by compose)
ENV NODE_ENV=production

# Start server
CMD ["node", "backend/server.js"]
