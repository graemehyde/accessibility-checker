# Use the official Playwright image — includes Chromium + all system deps
FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Install Node dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

# Create output directory for reports
RUN mkdir -p /reports

# Default report output goes to /reports so it can be bind-mounted
ENV OUTPUT_DIR=/reports

ENTRYPOINT ["node", "src/index.js"]
# Usage:  docker run --rm -e GEMINI_API_KEY=... accessibility-checker <url>
