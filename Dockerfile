# API Express uniquement — le front est sur Vercel (afromoney.vercel.app)
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server/index.js"]
