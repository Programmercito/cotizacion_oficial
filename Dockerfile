# Use the official Playwright image as the base
FROM  mcr.microsoft.com/playwright:v1.58.2-noble

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including better-sqlite3 which will be compiled for Linux)
RUN npm install

# Copy the application code
# .dockerignore will prevent copying node_modules and the database
COPY . .

# Ensure the directory for the database exists
RUN mkdir -p /opt/osbo

# Hardcode the database path as an environment variable
# This matches what is in your .env: base=/opt/osbo/datausd
ENV base=/opt/osbo/datausd

# Create a volume point for the database directory
VOLUME /opt/osbo

# Command to run the test
CMD ["npx", "playwright", "test"]
