# Websocket App

A WebSocket-based demo app with Dockerfile & simple CI/CD that push to GitHub Container Registry (ghcr.io).

## Setup with NPM

### Prerequisites
- **Node.js 25+ installed** (not LTS! - v25.2.1 or higher)

### Install Dependencies
```bash
npm install
```

### Run as Server
```bash
npm run server
```
Server will start on `http://localhost:8080`

### Run as Client
```bash
# Set environment variables for client
export SERVER_URL=ws://localhost:8080
export CLIENT_NAME="Your Name"
export CLIENT_LOCATION="Your City"

npm run client
```

## Setup with Docker

### Build Image
```bash
docker build -t websocket-app .
```

### Run as Server
```bash
docker run -d \
  -p 8080:8080 \
  -e MODE=server \
  --name ws-server \
  websocket-app
```

Access dashboard at `http://localhost:8080`

### Run as Client
```bash
docker run -d \
  -e MODE=client \
  -e SERVER_URL=ws://YOUR_SERVER_IP:8080 \
  -e CLIENT_NAME="Your Name" \
  -e CLIENT_LOCATION="Your City" \
  --name ws-client \
  websocket-app
```

### Environment Variables

| Variable | Default | Description | Used By |
|----------|---------|-------------|---------|
| `MODE` | `server` | Run mode: `server` or `client` | Both |
| `PORT` | `8080` | Server port | Server |
| `SERVER_URL` | `ws://localhost:8080` | WebSocket server URL | Client |
| `CLIENT_NAME` | `Anonymous` | Client display name | Client |
| `CLIENT_LOCATION` | `Unknown` | Client location | Client |

