FlappyCoin/
├── client/                # Клиентская часть (HTML, JS, Canvas)
│   ├── index.html         # Главная страница Mini App
│   ├── style/ 			   # Стили для всех страниц 
│   │   ├── mainMenu.css   # Стиль для главного меню
│   ├── game.js            # Логика игры (Canvas, управление)
│   └── assets/            # Спрайты монет и фоны
├── server/                # Серверная часть
│   ├── server.js          # Основной сервер (Express + Socket.IO)
│   ├── telegramUsers.json # Хранение данных игроков
│   └── rooms.js           # Логика игровых комнат
├── .env                   # Переменные окружения
├── Dockerfile             # Конфигурация Docker
├── docker-compose.yml     # Запуск контейнеров
└── architecture.md        # Документация архитектуры