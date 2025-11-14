# Объяснение работы базы данных и запросов

## Обзор архитектуры базы данных

Ваше приложение использует **PostgreSQL** (через Supabase) с **SQLAlchemy ORM** в качестве слоя абстракции. База данных настроена с пулом соединений для оптимизации производительности.

### Технические детали

- **База данных**: PostgreSQL (Supabase)
- **ORM**: SQLAlchemy
- **Пул соединений**: Настроен в зависимости от режима Supabase:
  - **Session mode** (порт 5432): пул из 2 соединений + 2 overflow
  - **Transaction mode** (порт 6543): пул из 5 соединений + 5 overflow
- **Таймауты**: 5 секунд на подключение, 20 секунд на запрос
- **Переиспользование соединений**: каждые 30 минут

---

## Структура базы данных

### Таблицы и их назначение

#### 1. **users** (Пользователи)
Хранит информацию о пользователях системы.

**Поля:**
- `id` (String, PK) - UUID пользователя
- `email` (String, UNIQUE) - Email пользователя
- `supabase_uid` (String, UNIQUE, INDEX) - ID пользователя в Supabase (для быстрого поиска)
- `name` (String) - Имя пользователя
- `password` (String) - Пароль (может быть NULL)
- `created_at` (DateTime) - Дата создания
- `updated_at` (DateTime) - Дата обновления

**Индексы:**
- `idx_user_supabase_uid` - для быстрого поиска по Supabase UID

**Связи:**
- Один пользователь → много Data Rooms
- Один пользователь → много папок
- Один пользователь → много файлов
- Один пользователь → один Google Drive токен

---

#### 2. **data_rooms** (Рабочие пространства)
Верхнеуровневые контейнеры для организации файлов пользователя.

**Поля:**
- `id` (String, PK) - UUID рабочего пространства
- `name` (String) - Название рабочего пространства
- `description` (String) - Описание (может быть NULL)
- `user_id` (String, FK → users.id) - Владелец
- `created_at` (DateTime) - Дата создания
- `updated_at` (DateTime) - Дата обновления

**Ограничения:**
- `uq_data_room_user_name` - уникальность имени для каждого пользователя

**Индексы:**
- `idx_data_room_user_name` - для быстрого поиска по user_id + name
- `idx_data_room_user_id` - для проверки владения

**Связи:**
- Один Data Room → много папок
- Один Data Room → много файлов
- Один Data Room → один владелец (User)

---

#### 3. **folders** (Папки)
Иерархическая структура папок внутри Data Room.

**Поля:**
- `id` (String, PK) - UUID папки
- `name` (String) - Название папки
- `data_room_id` (String, FK → data_rooms.id) - Принадлежность к Data Room
- `parent_folder_id` (String, FK → folders.id, NULL) - Родительская папка (NULL = корневая)
- `user_id` (String, FK → users.id) - Владелец
- `created_at` (DateTime) - Дата создания
- `updated_at` (DateTime) - Дата обновления

**Ограничения:**
- `idx_folder_unique` - функциональный индекс для уникальности имени в пределах родительской папки (case-insensitive)
  - Формула: `data_room_id || '|' || COALESCE(parent_folder_id, '') || '|' || lower(name)`

**Индексы:**
- `idx_folder_unique` - уникальность имени в пределах родителя
- `idx_folder_parent_name` - для поиска по parent_folder_id + name + data_room_id
- `idx_folder_name_scope` - для проверки конфликтов имен

**Связи:**
- Одна папка → много дочерних папок (self-reference)
- Одна папка → много файлов
- Одна папка → один Data Room
- Одна папка → один владелец (User)

---

#### 4. **files** (Файлы)
Метаданные загруженных файлов.

**Поля:**
- `id` (String, PK) - UUID файла
- `name` (String) - Имя файла
- `data_room_id` (String, FK → data_rooms.id) - Принадлежность к Data Room
- `folder_id` (String, FK → folders.id, NULL) - Папка (NULL = корневой уровень)
- `user_id` (String, FK → users.id) - Владелец
- `file_size` (BigInteger) - Размер файла в байтах
- `mime_type` (String) - MIME-тип файла
- `file_path` (String) - Путь к файлу в Supabase Storage
- `created_at` (DateTime) - Дата создания
- `updated_at` (DateTime) - Дата обновления

**Ограничения:**
- `idx_file_unique` - функциональный индекс для уникальности имени в пределах папки (case-insensitive)
  - Формула: `data_room_id || '|' || COALESCE(folder_id, '') || '|' || lower(name)`

**Индексы:**
- `idx_file_unique` - уникальность имени в пределах папки
- `idx_file_folder_name` - для поиска по folder_id + name + data_room_id
- `idx_file_name_scope` - для проверки конфликтов имен

**Связи:**
- Один файл → один Data Room
- Один файл → одна папка (или NULL)
- Один файл → один владелец (User)

---

#### 5. **google_drive_tokens** (Токены Google Drive)
OAuth токены для интеграции с Google Drive.

**Поля:**
- `id` (String, PK) - UUID записи
- `user_id` (String, FK → users.id, UNIQUE) - Пользователь (один токен на пользователя)
- `access_token` (Text) - Access token для API
- `refresh_token` (Text) - Refresh token для обновления
- `expires_at` (DateTime) - Время истечения токена
- `created_at` (DateTime) - Дата создания
- `updated_at` (DateTime) - Дата обновления

**Связи:**
- Один токен → один пользователь (User)

---

## Основные запросы к базе данных

### Аутентификация (`middleware/auth.py`)

#### 1. Поиск пользователя по Supabase UID (с кешированием)
```python
# Сначала проверяется кеш в памяти
cached_user_id = get_user_id_from_cache(supabase_uid)

# Если в кеше нет, выполняется запрос:
User.query.filter_by(supabase_uid=supabase_uid).first()
```
**Использует индекс:** `idx_user_supabase_uid`

#### 2. Поиск пользователя по email (fallback)
```python
User.query.filter_by(email=email).first()
```
**Используется:** если пользователь найден, но у него нет `supabase_uid`

#### 3. Создание нового пользователя
```python
user = User(email=email, supabase_uid=supabase_uid, name=name)
db.session.add(user)
db.session.flush()  # Получаем user.id

# Создание дефолтного Data Room
default_data_room = DataRoom(name=f'Data Room ({name})', user_id=user.id)
db.session.add(default_data_room)
db.session.commit()
```

---

### Data Rooms (`routes/data_room_routes.py`)

#### 1. Получение Data Room пользователя (GET /api/data-rooms)
```python
DataRoom.query.filter_by(user_id=g.user.id).first()
```
**Если не найден:** создается автоматически

#### 2. Получение Data Room с содержимым (GET /api/data-rooms/:id)
**Оптимизированный запрос (~4 запроса вместо N+1):**

**Запрос 1:** Получение Data Room
```python
DataRoom.query.filter_by(id=id, user_id=g.user.id).first()
```

**Запрос 2:** Получение корневых папок с подсчетом дочерних элементов
```python
# Подзапрос для подсчета дочерних папок
child_count_subq = db.session.query(
    Folder.parent_folder_id,
    func.count(Folder.id).label('child_count')
).group_by(Folder.parent_folder_id).subquery()

# Подзапрос для подсчета файлов
file_count_subq = db.session.query(
    File.folder_id,
    func.count(File.id).label('file_count')
).group_by(File.folder_id).subquery()

# Основной запрос с JOIN
root_folders_with_counts = db.session.query(
    Folder,
    func.coalesce(child_count_subq.c.child_count, 0).label('child_count'),
    func.coalesce(file_count_subq.c.file_count, 0).label('file_count')
).outerjoin(child_count_subq, Folder.id == child_count_subq.c.parent_folder_id
).outerjoin(file_count_subq, Folder.id == file_count_subq.c.folder_id
).filter(
    Folder.data_room_id == id,
    Folder.parent_folder_id.is_(None)
).order_by(Folder.name.asc()).all()
```

**Запрос 3:** Получение корневых файлов
```python
File.query.filter_by(
    data_room_id=id,
    folder_id=None
).order_by(File.name.asc()).all()
```

#### 3. Обновление Data Room (PUT /api/data-rooms/:id)
```python
data_room = DataRoom.query.filter_by(id=id, user_id=g.user.id).first()
data_room.name = data['name']
db.session.commit()
```

---

### Папки (`routes/folder_routes.py`)

#### 1. Получение всех папок Data Room (GET /api/folders)
```python
# Проверка владения
data_room = DataRoom.query.filter_by(id=data_room_id, user_id=g.user.id).first()

# Получение папок
folders = Folder.query.filter_by(data_room_id=data_room_id
).order_by(Folder.name.asc()).all()
```

#### 2. Получение содержимого папки (GET /api/folders/:id/contents)
**Оптимизированный запрос (~4 запроса):**

**Запрос 1:** Получение папки с DataRoom (JOIN для избежания lazy loading)
```python
folder = Folder.query.options(
    joinedload(Folder.data_room)
).join(DataRoom).filter(
    Folder.id == id,
    DataRoom.user_id == g.user.id
).first()
```

**Запрос 2:** Проверка существования папки (только если нужна для 403 vs 404)
```python
folder_exists = Folder.query.filter_by(id=id).first()
```

**Запрос 3:** Получение дочерних папок с подсчетами (аналогично Data Room)
```python
# Используются те же подзапросы для подсчета
children_with_counts = db.session.query(
    Folder,
    func.coalesce(child_count_subq.c.child_count, 0).label('child_count'),
    func.coalesce(file_count_subq.c.file_count, 0).label('file_count')
).outerjoin(...).filter(
    Folder.parent_folder_id == id
).order_by(Folder.name.asc()).all()
```

**Запрос 4:** Получение файлов в папке
```python
files_data = File.query.filter_by(folder_id=id
).order_by(File.name.asc()).all()
```

#### 3. Создание папки (POST /api/folders)
```python
# Проверка владения через EXISTS (быстрее чем SELECT)
ownership_exists = db.session.query(
    exists().where(
        DataRoom.id == data_room_id,
        DataRoom.user_id == g.user.id
    )
).scalar()

# Создание папки (уникальность проверяется индексом)
new_folder = Folder(
    name=name,
    parent_folder_id=parent_id,
    data_room_id=data_room_id,
    user_id=g.user.id
)
db.session.add(new_folder)
db.session.commit()
```
**При конфликте:** `IntegrityError` с проверкой `idx_folder_unique`

#### 4. Переименование папки (PATCH /api/folders/:id/rename)
```python
folder = Folder.query.join(DataRoom).filter(
    Folder.id == id,
    DataRoom.user_id == g.user.id
).first()

folder.name = name
db.session.commit()
```
**При конфликте:** `IntegrityError` с проверкой `idx_folder_unique`

#### 5. Перемещение папки (PATCH /api/folders/:id/move)
```python
folder = Folder.query.join(DataRoom).filter(
    Folder.id == id,
    DataRoom.user_id == g.user.id
).first()

# Проверка нового родителя
if new_parent_id:
    new_parent = Folder.query.filter_by(
        id=new_parent_id,
        data_room_id=folder.data_room_id
    ).first()

folder.parent_folder_id = new_parent_id
db.session.commit()
```

#### 6. Удаление папки (DELETE /api/folders/:id)
**Рекурсивное удаление:**
```python
def delete_folder_recursive(folder_id):
    # Получение дочерних папок
    child_folders = Folder.query.filter_by(parent_folder_id=folder_id).all()
    
    # Рекурсивное удаление дочерних папок
    for child_folder in child_folders:
        delete_folder_recursive(child_folder.id)
    
    # Получение файлов
    files = File.query.filter_by(folder_id=folder_id).all()
    
    # Удаление файлов (включая физические файлы из Supabase Storage)
    for file in files:
        if file.file_path:
            delete_supabase_file(file.file_path)
        db.session.delete(file)
    
    # Удаление самой папки
    folder = Folder.query.filter_by(id=folder_id).first()
    if folder:
        db.session.delete(folder)
```

---

### Файлы (`routes/file_routes.py`)

#### 1. Получение файлов (GET /api/files)
```python
query = File.query.filter_by(user_id=g.user.id)

if folder_id:
    query = query.filter_by(folder_id=folder_id)
elif data_room_id:
    query = query.filter_by(data_room_id=data_room_id)

files = query.order_by(File.created_at.desc()).all()
```

#### 2. Получение подписанного URL для просмотра (GET /api/files/:id/view)
```python
file = File.query.filter_by(id=id, user_id=g.user.id).first()
signed_url = get_signed_url(file.file_path)
```

#### 3. Переименование файла (PUT /api/files/:id)
```python
file = File.query.filter_by(id=id, user_id=g.user.id).first()
file.name = name
db.session.commit()
```
**При конфликте:** `IntegrityError` с проверкой `idx_file_unique`

#### 4. Получение URL для загрузки (POST /api/files/upload-url)
```python
# Проверка владения
data_room = DataRoom.query.filter_by(id=data_room_id, user_id=g.user.id).first()

# Создание подписанного URL (без запросов к БД)
upload_info = create_signed_upload_url(...)
```

#### 5. Завершение загрузки (POST /api/files/upload-complete)
```python
# Проверка владения
data_room = DataRoom.query.filter_by(id=data_room_id, user_id=g.user.id).first()

# Создание записи файла
new_file = File(
    name=file_name,
    data_room_id=data_room_id,
    folder_id=folder_id,
    user_id=g.user.id,
    file_size=file_size,
    mime_type=mime_type,
    file_path=file_path
)
db.session.add(new_file)
db.session.commit()
```
**При конфликте:** `IntegrityError` с проверкой `idx_file_unique`

#### 6. Удаление файла (DELETE /api/files/:id)
```python
file = File.query.filter_by(id=id, user_id=g.user.id).first()

# Удаление из БД
db.session.delete(file)
db.session.commit()

# Асинхронное удаление из Supabase Storage (в фоновом потоке)
if file.file_path:
    threading.Thread(target=delete_async, daemon=True).start()
```

---

### Google Drive (`routes/google_drive_routes.py`)

#### 1. Импорт файла из Google Drive (POST /api/google-drive/import)
```python
# Скачивание файла из Google Drive (без запросов к БД)
download_result = google_drive_service.download_file(user_id, file_id)

# Проверка конфликтов имен
conflicts = check_name_conflicts(file_name, data_room_id, folder_id)

# Загрузка в Supabase Storage
file_path = upload_to_supabase(...)

# Создание записи файла
new_file = File(...)
db.session.add(new_file)
db.session.commit()
```

#### 2. Массовый импорт (POST /api/google-drive/import-multiple)
Аналогично импорту одного файла, но в цикле для каждого файла.

---

## Оптимизации производительности

### 1. **Избежание N+1 запросов**
- Использование `joinedload()` для предзагрузки связанных объектов
- Подзапросы для подсчета дочерних элементов вместо отдельных запросов

### 2. **Индексы**
- Все внешние ключи индексированы
- Составные индексы для частых запросов (например, `idx_folder_name_scope`)
- Функциональные индексы для уникальности (case-insensitive)

### 3. **Кеширование**
- Кеш в памяти для `supabase_uid → user_id` (`utils/user_cache.py`)
- Опциональный Redis кеш (`utils/cache.py`)

### 4. **Пул соединений**
- Настроен в зависимости от режима Supabase
- Переиспользование соединений для снижения задержек

### 5. **Асинхронные операции**
- Удаление файлов из Supabase Storage выполняется в фоновом потоке
- Не блокирует ответ API

---

## Обработка ошибок

### Ограничения целостности
- **Уникальность имен:** проверяется через `IntegrityError` при нарушении `idx_folder_unique` или `idx_file_unique`
- **Внешние ключи:** автоматически проверяются при вставке/обновлении

### Retry логика
- При ошибках подключения к БД выполняется до 3 попыток с экспоненциальной задержкой
- Автоматический rollback при ошибках

---

## Мониторинг производительности

Система отслеживает:
- Время выполнения запросов (`utils/performance_monitor.py`)
- Количество запросов к БД на эндпоинт
- Общее время запроса

Логи выводятся в консоль в формате:
```
[Performance] Data room endpoint - Total: 45.23ms, Queries: 3, Query Time: 12.45ms
```

---

## Резюме

Ваша база данных использует:
- **5 таблиц** с четкими связями
- **Оптимизированные запросы** с минимизацией N+1 проблем
- **Индексы** для быстрого поиска
- **Пул соединений** для эффективного использования ресурсов
- **Кеширование** для часто используемых данных
- **Мониторинг** производительности запросов

Все операции выполняются через SQLAlchemy ORM, что обеспечивает безопасность (защита от SQL-инъекций) и удобство работы с данными.
