# Инструкция по развертыванию системы управления договорами

## Обзор системы

Система управления договорами представляет собой веб-приложение для автоматизации документооборота, включающее:

- Управление жизненным циклом договоров от создания до завершения
- Автоматическую генерацию PDF-документов (договоры и акты выполненных работ)
- Разграничение прав доступа по организациям и ролям
- Систему уведомлений о изменениях статусов и комментариях
- Дашборд с аналитикой и календарем

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Frontend | React 19, TypeScript, Tailwind CSS 4 |
| Backend | Node.js, Express 4, tRPC 11 |
| База данных | MySQL / TiDB |
| ORM | Drizzle ORM |
| Аутентификация | JWT + Cookie-based sessions |
| Файловое хранилище | Amazon S3 |

## Системные требования

### Минимальные требования для сервера

- **ОС**: Ubuntu 22.04 LTS или аналогичный Linux-дистрибутив
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 20 GB SSD
- **Node.js**: версия 22.x или выше
- **pnpm**: версия 10.x или выше

### База данных

- MySQL 8.0+ или TiDB (рекомендуется для облачного развертывания)
- Минимум 1 GB выделенной памяти

## Переменные окружения

Создайте файл `.env` в корне проекта со следующими переменными:

```env
# База данных
DATABASE_URL=mysql://user:password@host:3306/database_name

# Аутентификация
JWT_SECRET=your-secure-jwt-secret-key-min-32-chars

# OAuth (опционально, для Manus OAuth)
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im/login

# Владелец системы
OWNER_OPEN_ID=owner-open-id
OWNER_NAME=Owner Name

# API интеграции (опционально)
BUILT_IN_FORGE_API_URL=https://api.forge.example.com
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-api-key
VITE_FRONTEND_FORGE_API_URL=https://api.forge.example.com

# S3 хранилище (для файлов)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
```

## Пошаговая инструкция развертывания

### Шаг 1: Клонирование репозитория

```bash
git clone <repository-url> contract-management-system
cd contract-management-system
```

### Шаг 2: Установка зависимостей

```bash
pnpm install
```

### Шаг 3: Настройка базы данных

1. Создайте базу данных MySQL:

```sql
CREATE DATABASE contract_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'contract_user'@'%' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON contract_management.* TO 'contract_user'@'%';
FLUSH PRIVILEGES;
```

2. Выполните миграции:

```bash
pnpm db:push
```

### Шаг 4: Инициализация предустановленных пользователей

Предустановленные пользователи создаются автоматически при первом входе в систему. Учетные данные:

| Роль | Логин | Пароль | Организация | ИНН |
|------|-------|--------|-------------|-----|
| Начальник ИТ | it_head | it@rogakopita | ООО "Рога и копыта" | 7707083893 |
| Директор | director_roga | dir@rogakopita | ООО "Рога и копыта" | 7707083893 |
| Директор | director_hlyp | dir@hlyp | Хлыпало и КО | 1111111111 |

### Шаг 5: Сборка приложения

```bash
pnpm build
```

### Шаг 6: Запуск в production-режиме

```bash
pnpm start
```

Приложение будет доступно по адресу `http://localhost:3000`.

## Развертывание с использованием Docker

### Dockerfile

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Установка pnpm
RUN npm install -g pnpm@10

# Копирование файлов зависимостей
COPY package.json pnpm-lock.yaml ./

# Установка зависимостей
RUN pnpm install --frozen-lockfile

# Копирование исходного кода
COPY . .

# Сборка приложения
RUN pnpm build

# Открытие порта
EXPOSE 3000

# Запуск приложения
CMD ["pnpm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: contract_management
      MYSQL_USER: contract_user
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
    restart: unless-stopped

volumes:
  mysql_data:
```

### Запуск с Docker Compose

```bash
docker-compose up -d
```

## Настройка обратного прокси (Nginx)

```nginx
server {
    listen 80;
    server_name contracts.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name contracts.example.com;

    ssl_certificate /etc/letsencrypt/live/contracts.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/contracts.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Увеличенный лимит для загрузки файлов
    client_max_body_size 10M;
}
```

## Мониторинг и логирование

### Просмотр логов приложения

```bash
# При запуске через pnpm
pnpm start 2>&1 | tee -a /var/log/contract-management.log

# При запуске через Docker
docker-compose logs -f app
```

### Рекомендуемые метрики для мониторинга

- Время отклика API эндпоинтов
- Количество активных сессий
- Использование памяти Node.js процесса
- Размер и производительность базы данных
- Доступность S3 хранилища

## Резервное копирование

### База данных

```bash
# Создание резервной копии
mysqldump -u contract_user -p contract_management > backup_$(date +%Y%m%d).sql

# Восстановление из резервной копии
mysql -u contract_user -p contract_management < backup_20260103.sql
```

### Файлы (S3)

Рекомендуется настроить версионирование и репликацию S3 bucket для обеспечения сохранности файлов.

## Обновление системы

```bash
# Остановка приложения
pm2 stop contract-management

# Получение обновлений
git pull origin main

# Установка новых зависимостей
pnpm install

# Выполнение миграций
pnpm db:push

# Пересборка приложения
pnpm build

# Запуск приложения
pm2 start contract-management
```

## Устранение неполадок

### Проблема: Приложение не запускается

1. Проверьте наличие всех переменных окружения
2. Убедитесь в доступности базы данных
3. Проверьте логи: `pnpm start 2>&1`

### Проблема: Ошибки подключения к базе данных

1. Проверьте корректность DATABASE_URL
2. Убедитесь, что MySQL сервер запущен
3. Проверьте права пользователя базы данных

### Проблема: Файлы не загружаются

1. Проверьте настройки S3 (ключи доступа, имя bucket)
2. Убедитесь, что размер файла не превышает 10 MB
3. Проверьте CORS настройки S3 bucket

## Контакты поддержки

При возникновении вопросов по развертыванию обращайтесь к администратору системы или создайте issue в репозитории проекта.

---

**Версия документа**: 2.1  
**Дата обновления**: 03 января 2026  
**Автор**: Manus AI
