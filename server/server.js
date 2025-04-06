// Подключаем необходимые модули
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const http = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

// Импортируем модуль управления комнатами
const { 
    initRooms, 
    createRoom, 
    joinRoom, 
    leaveRoom, 
    setPlayerReady, 
    getRooms, 
    getRoom,
    updatePlayerScore
} = require('./rooms');

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

// Инициализация комнат
initRooms();

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
            
            // Отправляем ответ клиенту
            socket.emit('joined', { success: true, userData: users[userData.id] });
            
            // Сохраняем ID пользователя в объекте сокета для использования в других обработчиках
            socket.userId = userData.id;
            
        } catch (error) {
            console.error('Ошибка при обработке события join:', error);
            socket.emit('error', { message: 'Ошибка сервера при обработке присоединения' });
        }
    });

    // Обработка события создания комнаты
    socket.on('createRoom', () => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Не авторизован' });
            return;
        }

        try {
            const users = fs.readJsonSync(usersFilePath);
            const userData = users[socket.userId];
            
            if (!userData) {
                socket.emit('error', { message: 'Пользователь не найден' });
                return;
            }

            const room = createRoom(userData);
            
            // Присоединяем сокет к комнате
            socket.join(`room_${room.id}`);
            
            // Отправляем информацию о созданной комнате
            socket.emit('roomCreated', { roomId: room.id });
            
            // Обновляем список комнат для всех
            io.emit('roomsUpdated', getRooms());
            
        } catch (error) {
            console.error('Ошибка при создании комнаты:', error);
            socket.emit('error', { message: 'Ошибка сервера при создании комнаты' });
        }
    });

    // Обработка события присоединения к комнате
    socket.on('joinRoom', (roomId) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Не авторизован' });
            return;
        }

        try {
            const users = fs.readJsonSync(usersFilePath);
            const userData = users[socket.userId];
            
            if (!userData) {
                socket.emit('error', { message: 'Пользователь не найден' });
                return;
            }

            const result = joinRoom(roomId, userData);
            
            if (result.success) {
                // Присоединяем сокет к комнате
                socket.join(`room_${roomId}`);
                
                // Отправляем обновление всем в комнате
                io.to(`room_${roomId}`).emit('roomUpdated', getRoom(roomId));
                
                // Обновляем список комнат для всех
                io.emit('roomsUpdated', getRooms());
            } else {
                socket.emit('error', { message: result.error });
            }
            
        } catch (error) {
            console.error('Ошибка при присоединении к комнате:', error);
            socket.emit('error', { message: 'Ошибка сервера при присоединении к комнате' });
        }
    });

    // Обработка события готовности игрока
    socket.on('ready', (roomId) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Не авторизован' });
            return;
        }

        try {
            const result = setPlayerReady(roomId, socket.userId);
            
            if (result.success) {
                // Отправляем обновление всем в комнате
                io.to(`room_${roomId}`).emit('roomUpdated', getRoom(roomId));
                
                // Если все игроки готовы, начинаем отсчет
                if (result.allReady) {
                    // Запускаем отсчет перед началом игры
                    const countdownTime = parseInt(process.env.COUNTDOWN_TIME) || 3;
                    let countdown = countdownTime;
                    
                    const countdownInterval = setInterval(() => {
                        io.to(`room_${roomId}`).emit('countdown', countdown);
                        countdown--;
                        
                        if (countdown < 0) {
                            clearInterval(countdownInterval);
                            io.to(`room_${roomId}`).emit('gameStart', getRoom(roomId));
                        }
                    }, 1000);
                }
            } else {
                socket.emit('error', { message: result.error });
            }
            
        } catch (error) {
            console.error('Ошибка при установке готовности:', error);
            socket.emit('error', { message: 'Ошибка сервера при установке готовности' });
        }
    });

    // Обработка события обновления позиции игрока
    socket.on('updatePosition', (data) => {
        if (!socket.userId || !data.roomId) return;
        
        // Передаем всем в комнате, кроме отправителя
        socket.to(`room_${data.roomId}`).emit('playerMoved', {
            playerId: socket.userId,
            position: data.position
        });
    });

    // Обработка события обновления счета игрока
    socket.on('updateScore', (data) => {
        if (!socket.userId || !data.roomId) return;
        
        try {
            // Обновляем счет игрока
            updatePlayerScore(data.roomId, socket.userId, data.score);
            
            // Отправляем обновленные данные комнаты всем игрокам
            io.to(`room_${data.roomId}`).emit('scoreUpdated', {
                playerId: socket.userId,
                score: data.score,
                room: getRoom(data.roomId)
            });
        } catch (error) {
            console.error('Ошибка при обновлении счета:', error);
        }
    });

    // Обработка события отключения
    socket.on('disconnect', () => {
        console.log(`Соединение закрыто: ${socket.id}`);
        
        if (socket.userId) {
            try {
                // Находим все комнаты игрока и выходим из них
                const rooms = getRooms();
                
                for (const roomId in rooms) {
                    if (rooms[roomId].players.some(p => p.id === socket.userId)) {
                        const result = leaveRoom(roomId, socket.userId);
                        
                        if (result.success) {
                            // Отправляем обновление всем в комнате
                            io.to(`room_${roomId}`).emit('roomUpdated', getRoom(roomId));
                        }
                    }
                }
                
                // Обновляем список комнат для всех
                io.emit('roomsUpdated', getRooms());
                
            } catch (error) {
                console.error('Ошибка при обработке отключения:', error);
            }
        }
    });
});

// API-эндпоинт для получения списка комнат
app.get('/api/rooms', (req, res) => {
    try {
        res.json(getRooms());
    } catch (error) {
        console.error('Ошибка при получении списка комнат:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API-эндпоинт для получения данных пользователя
app.get('/api/user/:id', (req, res) => {
    try {
        const users = fs.readJsonSync(usersFilePath);
        const userData = users[req.params.id];
        
        if (userData) {
            res.json(userData);
        } else {
            res.status(404).json({ error: 'Пользователь не найден' });
        }
    } catch (error) {
        console.error('Ошибка при получении данных пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, () => {
    console.log(`Сервер запущен на ${HOST}:${PORT}`);
}); 