# ------------------------
# Stage 1: Build backend
# ------------------------
FROM node:20-alpine AS builder

WORKDIR /app/backend

# 1️⃣ Copy package files and install all dependencies (dev + prod)
COPY backend/package*.json ./
RUN npm install

# 2️⃣ Copy backend source
COPY backend/src ./src
COPY backend/tsconfig.json ./

# 3️⃣ Compile TypeScript
RUN npx tsc

# 4️⃣ Copy schema.sql to dist
RUN mkdir -p dist/db && cp src/db/schema.sql dist/db/

# ------------------------
# Stage 2: Runtime
# ------------------------
FROM node:20-slim

WORKDIR /app/backend

# 1️⃣ Copy only production dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev

# 2️⃣ Copy compiled backend from builder
COPY --from=builder /app/backend/dist ./dist

# 3️⃣ Copy frontend for Fastify serving
COPY frontend ./dist/frontend

# 4️⃣ Expose API port
EXPOSE 3000

# 5️⃣ Start the backend server
CMD ["node", "dist/server.js"]
