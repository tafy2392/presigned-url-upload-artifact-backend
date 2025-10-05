# Use an official lightweight Node.js image as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the rest of your application code into the container
COPY . .

# Expose the port your app will run on
EXPOSE 3000

# Define the command to run your app
CMD [ "node", "server.js" ]
