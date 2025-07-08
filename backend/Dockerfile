# --- 1단계: 개발 환경 (dev stage) ---
FROM node:20-alpine AS dev

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

CMD ["yarn", "dev"]

# --- 2단계: 프로덕션 빌드 (build stage) ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --production

COPY . .
RUN yarn build

# --- 3단계: 프로덕션 실행 환경 (prod stage) ---
FROM node:20-alpine AS prod

WORKDIR /app

COPY --from=build /app ./

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]