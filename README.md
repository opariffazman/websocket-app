# Docker Connect

A WebSocket-based demo app for teaching Docker. Single image can run as either server or client.

## Demo Scenario: "Works on My Machine" Problem

This project intentionally demonstrates common development issues that Docker solves.

### What Happens on Fresh EC2

On a fresh EC2 instance with default Node.js installation:

1. **Install Node.js with default commands** ✅
2. **npm install succeeds** ✅ - Dependencies download fine
3. **npm run server FAILS** ❌ - Multiple dependency issues!

```bash
# Install default Node.js (gives LTS version 18 or 20)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Check version
node --version
# v20.x.x (LTS)

# This works fine
npm install
# ✅ All packages downloaded

# This fails!
npm run server
# 🔍 Validating system dependencies...
#
# ❌ ERROR: Node.js version 25+ (latest) is required!
#    Current version: v20.x.x (detected)
#    Required version: v25.x or higher
#
#    Why version 25+?
#    - This app uses latest Node.js features (v25.2.1)
#    - Default "apt-get install nodejs" gives LTS (v18-v20)
#    - Installing specific versions is complex and error-prone
```

### Why Does This Happen?

**Two Dependency Issues:**

1. **Node.js Version Mismatch**
   - App requires Node.js 25+ (latest/current - v25.2.1)
   - Default installation gives LTS (v18-v20)
   - Upgrading to specific versions is complex

2. **Native Build Tools**
   - App uses `bcrypt` (password hashing library)
   - Requires: Python 3, Make, GCC/G++ compiler
   - Not installed by default on fresh EC2

### The Manual Fix (Complex & Time-consuming)

```bash
# Fix 1: Install latest Node.js 25
# Option A: Use nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 25
nvm use 25

# Option B: Download and compile from source (tedious!)
wget https://nodejs.org/dist/v25.2.1/node-v25.2.1.tar.gz
tar -xzf node-v25.2.1.tar.gz
cd node-v25.2.1
./configure
make
sudo make install

# Fix 2: Install build tools
sudo apt-get update
sudo apt-get install -y python3 make g++

# Finally, rebuild and run
npm rebuild bcrypt
npm run server
```

### The Docker Solution (Simple & Instant)

```bash
docker build -t docker-connect .
docker run -d -p 8080:8080 -e MODE=server docker-connect
# ✅ Works immediately!
```

**Why Docker Works:**
- Uses exact Node.js version (25-alpine) in Dockerfile
- Includes all build tools in the image
- Same environment everywhere
- No manual dependency management

## Local Setup (Without Docker)

### Prerequisites
- **Node.js 25+ installed** (not LTS! - v25.2.1 or higher)
- **System build tools** (python3, make, g++)

### Install Dependencies
```bash
npm install
```

**Note:** On fresh EC2 or minimal Linux:
- Default installations give Node.js LTS (v18-v20) which is too old
- npm install may succeed but the app will fail when running
- See demo scenario above for why Docker is the better solution

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

## Docker Setup

### Build Image
```bash
docker build -t docker-connect .
```

### Run as Server
```bash
docker run -d \
  -p 8080:8080 \
  -e MODE=server \
  --name docker-server \
  docker-connect
```

Access dashboard at `http://localhost:8080`

### Run as Client
```bash
docker run -d \
  -e MODE=client \
  -e SERVER_URL=ws://YOUR_SERVER_IP:8080 \
  -e CLIENT_NAME="Your Name" \
  -e CLIENT_LOCATION="Your City" \
  --name docker-client \
  docker-connect
```

### Environment Variables

| Variable | Default | Description | Used By |
|----------|---------|-------------|---------|
| `MODE` | `server` | Run mode: `server` or `client` | Both |
| `PORT` | `8080` | Server port | Server |
| `SERVER_URL` | `ws://localhost:8080` | WebSocket server URL | Client |
| `CLIENT_NAME` | `Anonymous` | Client display name | Client |
| `CLIENT_LOCATION` | `Unknown` | Client location | Client |

## Teaching Demo Script

### Step 1: Show the Problem (Fresh EC2)

SSH into a fresh EC2 instance and demo the failure:

```bash
# Install Node.js using default LTS
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Check what version we got
node --version
# v20.18.0 (or similar LTS version)

# Clone/upload project
git clone YOUR_REPO
cd docker-connect

# This succeeds!
npm install
# ✅ All packages installed

# But this fails!
npm run server
# 🔍 Validating system dependencies...
#
# ❌ ERROR: Node.js version 25+ (latest) is required!
#    Current version: v20.18.0 (detected)
#    Required version: v25.x or higher
#
#    Why version 25+?
#    - This app uses latest Node.js features (v25.2.1)
#    - Default "apt-get install nodejs" gives LTS (v18-v20)
#    - Installing specific versions is complex and error-prone
```

Students see: **"It installed but won't run!"** - Classic version mismatch problem!

### Step 2: Show the Docker Solution

On the same EC2:

```bash
# Install Docker
sudo apt-get install -y docker.io
sudo usermod -aG docker ubuntu
# Log out and back in

# Build and run with Docker
docker build -t docker-connect .
docker run -d -p 8080:8080 -e MODE=server --name docker-server docker-connect

# Check it's working
docker logs docker-server
# ✅ All system dependencies validated
# 🐳 Docker Connect Server running on port 8080
```

Access `http://EC2_IP:8080` - it works!

### Step 3: Students Connect

Students build and run as clients:

```bash
docker build -t docker-connect .
docker run -d \
  -e MODE=client \
  -e SERVER_URL=ws://INSTRUCTOR_EC2_IP:8080 \
  -e CLIENT_NAME="Student Name" \
  -e CLIENT_LOCATION="City" \
  --name docker-client \
  docker-connect
```

They appear on the dashboard in real-time!

### Key Learning Points

1. **npm install ≠ app will run** - Package downloads don't guarantee runtime success
2. **Version mismatches are common** - Default installations give LTS, not latest
3. **"Works on my machine"** - Different Node versions, different OS packages
4. **Manual fixes are tedious** - Installing specific versions requires nvm or compilation
5. **Docker solves everything** - Exact Node version (25), build tools, same environment everywhere
6. **Consistency** - Same Docker image works on any machine, any OS

## Useful Commands

```bash
# View logs
docker logs -f CONTAINER_NAME

# Stop container
docker stop CONTAINER_NAME

# Remove container
docker rm CONTAINER_NAME

# List running containers
docker ps
```

## Project Structure

```
.
├── Dockerfile          # Single image for both modes
├── entrypoint.sh       # Minimal startup script
├── package.json        # Dependencies (includes bcrypt)
├── app.js              # Combined server & client application
└── public/
    └── index.html      # Dashboard UI
```

## How It Works

- Single file (`app.js`) contains both server and client code
- `MODE` environment variable determines which to run
- Shared validation logic eliminates redundancy
- Server hosts WebSocket endpoint and web dashboard
- Clients connect via WebSocket and send heartbeats
- Dashboard shows all connected clients in real-time
- **Validation checks** demonstrate dependency issues without Docker

## License

MIT
