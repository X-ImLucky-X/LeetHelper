FROM node:20-bullseye

# Install compilers and runtimes
RUN apt-get update && apt-get install -y \
    g++ \
    default-jdk \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package.json (if any)
COPY package.json ./
RUN npm install --production || true

# Copy application files
COPY . .

# Expose port
EXPOSE 5173

# Start the server
CMD ["node", "server.js"]
