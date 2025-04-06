// Подключаем необходимые модули
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

// Проверяем существование файла с пользователями, если его нет - создаем пустой
const usersFilePath = process.env.USERS_FILE_PATH || './server/telegramUsers.json';
if (!fs.existsSync(usersFilePath)) {
    fs.writeJsonSync(usersFilePath, {}, { spaces: 2 });
    console.log(`Создан пустой файл пользователей: ${usersFilePath}`);
}

// Создаем экземпляр Express приложения
const app = express();

// Настройка статических файлов
app.use(express.static(path.join(__dirname, '../client')));
app.use(express.json());

// Создаем HTTP или HTTPS сервер в зависимости от наличия SSL сертификатов
let server;
if (process.env.NODE_ENV === 'production') {
    try {
        // Для продакшн используем HTTPS
        const sslOptions = {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH)
        };
        server = https.createServer(sslOptions, app);
        console.log('Запущен HTTPS сервер с SSL');
    } catch (error) {
        console.error('Ошибка при чтении SSL сертификатов:', error);
        console.log('Запуск HTTP сервера в качестве запасного варианта');
        server = http.createServer(app);
    }
} else {
    // Для разработки используем HTTP
    server = http.createServer(app);
    console.log('Запущен HTTP сервер для разработки');
}

// Инициализируем Socket.IO
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Обработка подключений Socket.IO
io.on('connection', (socket) => {
    console.log(`Новое соединение: ${socket.id}`);

    // Обработка события присоединения игрока
    socket.on('join', (userData) => {
        console.log(`Игрок присоединился: ${JSON.stringify(userData)}`);
        
        try {
            // Проверяем валидность данных пользователя Telegram
            if (!userData || !userData.id) {
                socket.emit('error', { message: 'Неверные данные пользователя' });
                return;
            }

            // Загружаем существующих пользователей
            const users = fs.readJsonSync(usersFilePath);
            
            // Добавляем или обновляем данные пользователя
            users[userData.id] = {
                ...users[userData.id],
                ...userData,
                lastSeen: new Date().toISOString(),
                socketId: socket.id
            };
            
            // Сохраняем обновленные данные
            fs.writeJsonSync(usersFilePath, users, { spaces: 2 });
            
            // Сохраняем ID пользователя в объекте сокета для использования в других обработчиках
            socket.userId = userData.id;
            socket.userData = users[userData.id];
            
            // Отправляем ответ клиенту
            socket.emit('joined', { success: true, userData: users[userData.id] });
            
            console.log(`Пользователь ${users[userData.id].username} (${userData.id}) авторизован`);
            
        } catch (error) {
            console.error('Ошибка при обработке события join:', error);
            socket.emit('error', { message: 'Ошибка сервера при обработке присоединения' });
        }
    });

    // Обработка события отключения
    socket.on('disconnect', () => {
        console.log(`Соединение закрыто: ${socket.id}`);
    });
});

// API-эндпоинт для получения данных пользователя
app.get('/api/user/:id', (req, res) => {
    try {
        console.log(`Запрос данных пользователя с ID: ${req.params.id}`);
        
        // Проверяем существование файла с пользователями
        if (!fs.existsSync(usersFilePath)) {
            console.log(`Файл с пользователями не найден: ${usersFilePath}`);
            return res.status(404).json({ error: 'Данные пользователей не найдены' });
        }
        
        const users = fs.readJsonSync(usersFilePath);
        const userData = users[req.params.id];
        
        if (userData) {
            console.log(`Данные пользователя найдены: ${req.params.id}`);
            res.json(userData);
        } else {
            console.log(`Пользователь не найден: ${req.params.id}`);
            res.status(404).json({ error: 'Пользователь не найден' });
        }
    } catch (error) {
        console.error('Ошибка при получении данных пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обработчик для получения логов от клиента
app.post('/api/log', (req, res) => {
    try {
        const logsData = req.body;
        
        if (!logsData || !logsData.logs || !Array.isArray(logsData.logs)) {
            return res.status(400).json({ success: false, error: 'Некорректные данные логов' });
        }
        
        // Получаем дополнительную информацию
        const userAgent = logsData.userAgent || 'Неизвестно';
        const timestamp = logsData.timestamp || new Date().toISOString();
        const userData = logsData.userData || {};
        
        // Логируем на сервере
        console.log('Получены логи от клиента:');
        console.log(`Пользователь: ${userData.username || 'Неизвестно'} (${userData.id || 'Нет ID'})`);
        console.log(`Всего логов: ${logsData.logs.length}`);
        console.log(`Время: ${timestamp}`);
        console.log(`User-Agent: ${userAgent}`);
        
        // Логируем ошибки, которые были в клиентских логах
        const errorLogs = logsData.logs.filter(log => log.level === 'error');
        if (errorLogs.length > 0) {
            console.error('Ошибки на стороне клиента:');
            errorLogs.forEach(log => {
                console.error(`[${log.timestamp}] ${log.message} (${log.caller})`);
                if (log.data) {
                    console.error('Данные:', log.data);
                }
            });
        }
        
        // Здесь можно добавить сохранение логов в базу данных или файл
        
        return res.json({ success: true });
    } catch (error) {
        console.error('Ошибка при обработке логов:', error);
        return res.status(500).json({ success: false, error: 'Ошибка при обработке логов' });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, () => {
    console.log(`Сервер запущен на ${HOST}:${PORT}`);
}); 