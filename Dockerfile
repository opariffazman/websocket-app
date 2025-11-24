FROM node:25-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production

# Copy application file
COPY app.js ./
COPY public ./public

# Copy entrypoint script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Expose port (used only in server mode)
EXPOSE 8080

# Set default mode to server
ENV MODE=server

# Use entrypoint script
ENTRYPOINT ["./entrypoint.sh"]
