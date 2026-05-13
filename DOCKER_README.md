# Развертывание системы управления договорами через Docker

Это руководство описывает, как быстро развернуть систему управления договорами используя Docker и Docker Compose.

## Требования

- **Docker** версия 20.10 или выше
- **Docker Compose** версия 1.29 или выше
- **Свободные порты**: 3000 (приложение), 3306 (MySQL), 9000 и 9001 (MinIO, опционально)

Установите Docker и Docker Compose с официального сайта: https://docs.docker.com/get-docker/

## Быстрый старт (2 команды)

### 1. Сборка Docker образа

```bash
docker build -t contract-management:latest .
```

Эта команда создает Docker образ приложения. Процесс может занять 5-10 минут в зависимости от скорости интернета.

### 2. Запуск контейнеров

```bash
docker-compose up -d
```

Эта команда запускает все необходимые сервисы (приложение, MySQL, MinIO) в фоновом режиме.

## Проверка статуса

После запуска проверьте, что все контейнеры работают:

```bash
docker-compose ps
```

Вы должны увидеть три контейнера:
- `contract-management-app` - основное приложение
- `contract-management-db` - MySQL база данных
- `contract-management-minio` - S3 хранилище (если включено)

## Доступ к приложению

После успешного запуска приложение доступно по адресу:

```
http://localhost:3000
```

### Предустановленные пользователи для входа:

1. **Начальник управления ИТ**
   - Организация: ООО "Рога и копыта"
   - ИНН: 7707083893
   - Право согласования: Нет

2. **Директор (Рога и копыта)**
   - Организация: ООО "Рога и копыта"
   - ИНН: 7707083893
   - Право согласования: Да

3. **Директор (Хлыпало и КО)**
   - Организация: Хлыпало и КО
   - ИНН: 1111111111
   - Право согласования: Да

## Конфигурация

### Переменные окружения

Создайте файл `.env` в корне проекта на основе `env.example`:

```bash
cp env.example .env
```

Отредактируйте `.env` и измените значения по необходимости:

```env
# База данных
MYSQL_ROOT_PASSWORD=rootpassword123
MYSQL_PASSWORD=contractpass123
MYSQL_USER=contract_user

# Безопасность (ВАЖНО: измените в production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars

# Порты
APP_PORT=3000
DB_PORT=3306
```

### Использование внешнего S3 (AWS)

Если вы хотите использовать AWS S3 вместо локального MinIO, отредактируйте `.env`:

```env
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=your-bucket-name
```

И исключите MinIO из docker-compose:

```bash
docker-compose --profile without-minio up -d
```

## Управление контейнерами

### Просмотр логов

```bash
# Логи всех сервисов
docker-compose logs -f

# Логи только приложения
docker-compose logs -f app

# Логи только базы данных
docker-compose logs -f db
```

### Остановка приложения

```bash
docker-compose down
```

### Перезапуск приложения

```bash
docker-compose restart app
```

### Полная очистка (включая данные)

```bash
docker-compose down -v
```

**Внимание**: эта команда удалит все данные в базе данных и хранилище!

## Доступ к сервисам

### MySQL база данных

```bash
docker-compose exec db mysql -u contract_user -p contract_management
```

Введите пароль: `contractpass123` (или значение из `.env`)

### MinIO консоль (если включено)

```
http://localhost:9001
```

Логин: `minioadmin`
Пароль: `minioadmin`

## Устранение неполадок

### Приложение не запускается

1. Проверьте логи:
   ```bash
   docker-compose logs app
   ```

2. Убедитесь, что порт 3000 не занят:
   ```bash
   lsof -i :3000
   ```

3. Проверьте, что MySQL запущена и здорова:
   ```bash
   docker-compose ps
   ```

### Ошибка подключения к БД / Таблица не найдена

1. Проверьте, что MySQL контейнер запущен:
   ```bash
   docker-compose logs db
   ```

2. Проверьте переменные окружения в `.env`

3. Если таблицы не созданы (ошибка `predefined_users` not found), удалите volume и перезапустите:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```
   **Важно**: файл `init-db.sql` выполняется MySQL только при первом запуске (когда volume пустой). Если вы ранее запускали контейнер со старым init-db.sql, нужно удалить volume (`docker-compose down -v`) и запустить заново.

4. Перезагрузите контейнеры:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Файлы не загружаются

1. Проверьте, что MinIO запущен (если используется локально):
   ```bash
   docker-compose logs minio
   ```

2. Проверьте права доступа к S3 (если используется AWS)

3. Убедитесь, что размер файла не превышает 10 MB

### Порт уже занят

Если порт 3000 уже используется, измените его в `.env`:

```env
APP_PORT=3001
```

Затем перезагрузите контейнеры:

```bash
docker-compose down
docker-compose up -d
```

Приложение будет доступно по адресу `http://localhost:3001`

## Производственное развертывание

Для развертывания в production среде:

1. **Измените JWT_SECRET** на длинный случайный ключ
2. **Используйте внешнюю MySQL БД** вместо контейнера
3. **Используйте AWS S3** вместо MinIO
4. **Настройте SSL/HTTPS** через обратный прокси (Nginx)
5. **Включите логирование и мониторинг**
6. **Регулярно создавайте резервные копии БД**

Подробнее см. в файле `DEPLOYMENT.md`

## Обновление приложения

Для обновления приложения до новой версии:

```bash
# Остановить текущие контейнеры
docker-compose down

# Получить новый код
git pull origin main

# Пересобрать образ
docker build -t contract-management:latest .

# Запустить новую версию
docker-compose up -d
```

## Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs`
2. Прочитайте файл `DEPLOYMENT.md` для более подробной информации
3. Создайте issue в репозитории проекта

---

**Версия**: 1.0  
**Дата обновления**: 03 января 2026
