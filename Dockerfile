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

# RECOMMENDED CHANGE: Removed `|| true` to guarantee dependencies build successfully
RUN npm install --production

# Copy application files
COPY . .

# Expose port (Optional but fine to keep for documentation)
EXPOSE 5173

# Start the server
CMD ["node", "server.js"]