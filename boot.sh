#!/bin/sh

# Run migrations
prisma migrate deploy

# Start the app
ts-node src/index.ts
