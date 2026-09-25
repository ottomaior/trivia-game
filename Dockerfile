# syntax=docker/dockerfile:1

FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/motion/package.json apps/motion/
# apps/motion is design tooling (Remotion); only its plain-Node art generator
# runs here, from apps/web's build, so its dependencies are never installed.
RUN pnpm install --frozen-lockfile --filter '!@trivia/motion'
COPY . .
RUN pnpm build
# Drop dev dependencies (Vite, TypeScript, Playwright…) before copying out.
RUN CI=true pnpm install --frozen-lockfile --prod --filter '!@trivia/motion'

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
