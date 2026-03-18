# Use Ubuntu as base with GDAL, PDAL, and Node.js
FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    pdal \
    libpdal-dev \
    python3-pip \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install MeshLab for 3D model processing (optional but recommended)
RUN apt-get update && apt-get install -y \
    meshlab \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app/server

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy server code
COPY . .

# Create necessary directories
RUN mkdir -p data/shapes data/3D data/pointclouds data/geotiffs

# Expose server port
EXPOSE 3000

# Default command
CMD ["node", "index.js"]
