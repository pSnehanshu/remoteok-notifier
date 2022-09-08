FROM node:16.17.0-alpine

WORKDIR /var/www/rok-bot

COPY package*.json ./
RUN npm install && npm install --global ts-node prisma
COPY . .
RUN prisma generate && \
  npx tsc --noEmit

# Copy the boot.sh file and make it executable
COPY boot.sh boot.sh
RUN chmod +x boot.sh

ENV NODE_ENV=production

CMD ["./boot.sh"]
