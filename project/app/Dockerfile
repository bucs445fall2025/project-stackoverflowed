# Use Node 18
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend
COPY . .

# Expose port 3000 for Next.js dev server
EXPOSE 3000

# Start Next.js
CMD ["npm", "run", "dev"]