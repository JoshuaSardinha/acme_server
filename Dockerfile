# Dockerfile
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Create and switch to an app directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies (including dev dependencies for build)
COPY package*.json ./
RUN npm install

# Copy the rest of your source code
COPY . .

# Build the NestJS application
RUN npm run build

# Expose the port your app listens on
EXPOSE 3000

COPY wait-for-it.sh /usr/src/app/wait-for-it.sh
COPY entrypoint.sh /usr/src/app/entrypoint.sh
RUN chmod +x /usr/src/app/wait-for-it.sh /usr/src/app/entrypoint.sh

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]

# Start the Node app
CMD ["npm", "run", "start:prod"]
