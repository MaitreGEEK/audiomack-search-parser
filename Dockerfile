FROM node:24-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

RUN npx playwright install firefox

COPY . .

EXPOSE 3000

ENV PORT=3000

CMD ["node", "app.js"]