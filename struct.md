FlappyCoin/
├── client/                # Клиентская часть (SPA приложение)
│   ├── index.html         # Единая HTML-страница (SPA)
│   ├── app.js             # Основной контроллер SPA
│   ├── telegram.js        # Функции для работы с Telegram WebApp API
│   ├── logger.js          # Система логирования клиентской части
│   ├── views/             # Компоненты для различных экранов
│   │   ├── mainMenu.js    # Компонент главного меню
│   │   └── roomView.js    # Компонент игровой комнаты
│   ├── services/          # Сервисы приложения
│   │   └── socketService.js # Менеджер WebSocket соединения
│   ├── style/             # Стили для всех экранов
│   │   ├── app.css        # Общие стили приложения
│   │   ├── mainMenu.css   # Стиль для главного меню
│   │   └── room.css       # Стиль для игровой комнаты
│   └── assets/            # Спрайты монет и фоны
│       ├── bitcoin.png    # Изображение биткоина
│       ├── default-avatar.png # Изображение аватара по умолчанию
│       ├── background-blur.jpg # Фоновое изображение для комнаты
│       └── main-menu.png  # Фоновое изображение для меню
├── server/                # Серверная часть
│   ├── server.js          # Основной сервер (Express + Socket.IO)
│   ├── rooms.js           # Логика игровых комнат
│   └── telegramUsers.json # Хранение данных игроков
├── .env                   # Переменные окружения
├── Dockerfile             # Конфигурация Docker
├── docker-compose.yml     # Запуск контейнеров
└── architecture.md        # Документация архитектуры