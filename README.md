# WebArchive

Кусочек старого интернета: каталог флеш-игр с поиском, пагинацией и фильтрами,
а также общий чат. Проект стилизован под интерфейсы старых настольных систем.

## Стек

- **Фронтенд:** React 18, Vite, Tailwind CSS v4
- **Тесты:** Vitest, React Testing Library
- **Контейнеризация:** Docker, Docker Compose, nginx
- **CI/CD:** GitHub Actions → GitHub Container Registry (ghcr.io)

## Структура проекта

WebArchive/
├── FrontEnd/ # React + Vite приложение
│ ├── src/
│ │ ├── components/
│ │ │ ├── ArchivePage.jsx # каталог игр: поиск, пагинация
│ │ │ ├── GameCard.jsx # карточка игры
│ │ │ └── *.test.jsx # тесты
│ │ └── test/setup.js
│ ├── Dockerfile # multi-stage: сборка → nginx
│ ├── nginx.conf
│ └── package.json
├── storage/ # статика: обложки, аватарки, .swf файлы игр
│ ├── covers/
│ ├── avatars/
│ └── games/
├── docker-compose.yml
└── .github/workflows/
└── docker-publish.yml # CI/CD пайплайн


## Запуск локально (для разработки)

Требуется Node.js 22+.

```bash
cd FrontEnd
npm install
npm run dev
Открываете http://localhost:5173

# запуск в докере
docker compose up --build
Откройте http://localhost:8080

# тесты
cd FrontEnd
npm test


# Готовый образ доступен по адресу:
ghcr.io/kk5086617-jpg/realwebarchive:latest

##  Планы развития
- Бэкенд на Express + TypeScript
- База данных MSSQL в отдельном контейнере
- Авторизация пользователей
- Профиль со стенкой
- Комментарии и оценки игр
- Общий чат

