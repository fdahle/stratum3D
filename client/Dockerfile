# Use Node.js for building Vue app
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the Vue app
RUN npm run build

# Production stage - use nginx to serve built files
FROM nginx:alpine

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config (if needed)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
