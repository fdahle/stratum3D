# Ubuntu 22.04 LTS — ships gdal-bin and pdal in its universe repo
FROM ubuntu:22.04

# Prevent interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive

# Install GDAL, PDAL, and supporting utilities in one layer
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    pdal \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 via the official NodeSource distribution
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app/server

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy server code
COPY . .

# Create necessary data directories (these are also created at runtime via
# the volume mount, but pre-creating them avoids permission edge cases)
RUN mkdir -p data/layers data/shapes data/3D data/pointclouds data/geotiffs

# Expose server port
EXPOSE 3000

# Default command
CMD ["node", "index.js"]
