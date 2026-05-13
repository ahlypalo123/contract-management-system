# Этап 1: Сборка приложения
FROM node:22-alpine AS builder

WORKDIR /app

# Установка pnpm
RUN npm install -g pnpm@10

# Копирование файлов зависимостей
COPY package.json pnpm-lock.yaml ./

# Копирование папки с патчами для pnpm
COPY patches ./patches

# Установка ВСЕХ зависимостей (включая devDependencies для сборки)
RUN pnpm install --frozen-lockfile

# Копирование исходного кода
COPY . .

# Сборка приложения (vite build + esbuild для сервера)
RUN pnpm build

# Этап 2: Production образ
FROM node:22-alpine

WORKDIR /app

# Установка pnpm для установки production зависимостей
RUN npm install -g pnpm@10

# Копирование файлов зависимостей
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Установка только production зависимостей
RUN pnpm install --frozen-lockfile --prod

# Копирование собранного приложения из builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Открытие порта
EXPOSE 3000

# Переменные окружения по умолчанию
ENV NODE_ENV=production
ENV PORT=3000

# Запуск приложения
CMD ["node", "dist/index.js"]
