FROM node:20-bookworm
WORKDIR /app
COPY package.json /app/package.json
RUN npm install
COPY server.js /app/server.js
EXPOSE 8091
CMD ["npm", "start"]
