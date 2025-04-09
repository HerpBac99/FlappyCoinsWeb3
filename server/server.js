// Подключаем необходимые модули
const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const http = require('http');
const socketIO = require('socket.io');
const roomsManager = require('./rooms');
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

    // Обработка события создания игровой комнаты
    socket.on('createRoom', (playerData) => {
        console.log(`Запрос на создание комнаты от игрока: ${JSON.stringify(playerData)}`);
        
        try {
            // Проверяем валидность данных игрока
            if (!playerData || !playerData.userId) {
                socket.emit('error', { message: 'Неверные данные игрока' });
                return;
            }
            
            // Создаем новую комнату
            const result = roomsManager.createRoom(playerData);
            
            // Добавляем сокет в комнату Socket.IO
            socket.join(`room_${result.roomId}`);
            
            // Сохраняем ID комнаты в объекте сокета
            socket.roomId = result.roomId;
            
            // Отправляем ответ клиенту
            socket.emit('roomCreated', { 
                roomId: result.roomId,
                players: result.room.players
            });
            
            console.log(`Комната создана: ${result.roomId}, игрок: ${playerData.username} (${playerData.userId})`);
            
        } catch (error) {
            console.error('Ошибка при создании комнаты:', error);
            socket.emit('error', { message: 'Ошибка при создании комнаты' });
        }
    });
    
    // Обработка события присоединения к комнате
    socket.on('joinRoom', (data) => {
        console.log(`Запрос на присоединение к комнате: ${JSON.stringify(data)}`);
        
        try {
            // Проверяем валидность данных
            if (!data || !data.roomId || !data.userId) {
                socket.emit('error', { message: 'Неверные данные для присоединения к комнате' });
                return;
            }
            
            // Присоединяем игрока к комнате
            const result = roomsManager.joinRoom(data.roomId, {
                userId: data.userId,
                username: data.username || 'Аноним',
                photoUrl: data.photoUrl || 'assets/default-avatar.png'
            });
            
            // Проверяем результат операции
            if (!result.success) {
                socket.emit('roomError', { 
                    code: result.error, 
                    message: result.message 
                });
                return;
            }
            
            // Добавляем сокет в комнату Socket.IO
            socket.join(`room_${data.roomId}`);
            
            // Сохраняем ID комнаты в объекте сокета
            socket.roomId = data.roomId;
            
            // Отправляем ответ клиенту
            socket.emit('roomJoined', { room: result.room });
            
            // Если это новый игрок, уведомляем остальных участников комнаты
            if (result.isNewPlayer) {
                // Находим данные нового игрока
                const newPlayer = result.room.players.find(p => p.userId === data.userId);
                
                // Отправляем уведомление остальным участникам (кроме текущего)
                socket.to(`room_${data.roomId}`).emit('playerJoined', {
                    player: newPlayer,
                    players: result.room.players
                });
            }
            
            console.log(`Игрок ${data.username} (${data.userId}) присоединился к комнате ${data.roomId}`);
            
        } catch (error) {
            console.error('Ошибка при присоединении к комнате:', error);
            socket.emit('error', { message: 'Ошибка при присоединении к комнате' });
        }
    });
    
    // Обработка события изменения статуса готовности
    socket.on('toggleReady', (data) => {
        console.log(`Запрос на изменение статуса готовности: ${JSON.stringify(data)}`);
        
        try {
            // Проверяем валидность данных
            if (!data || !data.roomId || !data.userId) {
                socket.emit('error', { message: 'Неверные данные для изменения статуса' });
                return;
            }
            
            // Изменяем статус готовности игрока
            const result = roomsManager.togglePlayerReady(data.roomId, data.userId, data.isReady);
            
            // Проверяем результат операции
            if (!result.success) {
                socket.emit('roomError', { 
                    code: result.error, 
                    message: result.message 
                });
                return;
            }
            
            // Отправляем уведомление всем игрокам в комнате
            io.to(`room_${data.roomId}`).emit('playerStatusChanged', {
                userId: data.userId,
                isReady: data.isReady
            });
            
            console.log(`Статус игрока ${data.userId} в комнате ${data.roomId} изменен на: ${data.isReady ? 'готов' : 'не готов'}`);
            
            // Если все игроки готовы, запускаем обратный отсчет
            if (result.allPlayersReady) {
                console.log(`Все игроки в комнате ${data.roomId} готовы, запускаем обратный отсчет`);
                
                // Запускаем обратный отсчет
                const countdownResult = roomsManager.startCountdown(data.roomId, (room) => {
                    // Колбэк после окончания обратного отсчета - запуск игры
                    io.to(`room_${data.roomId}`).emit('startGame', {
                        roomId: data.roomId,
                        players: room.players
                    });
                    
                    console.log(`Игра в комнате ${data.roomId} запущена`);
                });
                
                // Отправляем уведомление о запуске обратного отсчета
                if (countdownResult.success) {
                    io.to(`room_${data.roomId}`).emit('allPlayersReady', {
                        countdownTime: countdownResult.countdownTime
                    });
                    
                    console.log(`Обратный отсчет запущен в комнате ${data.roomId}`);
                }
            }
            
        } catch (error) {
            console.error('Ошибка при изменении статуса готовности:', error);
            socket.emit('error', { message: 'Ошибка при изменении статуса готовности' });
        }
    });
    
    /**
     * Удаляет игрока из комнаты и отправляет уведомления
     * @param {string} roomId - ID комнаты
     * @param {string} userId - ID игрока
     * @param {string} reason - Причина выхода ("disconnect" или "leave")
     */
    function removePlayerFromRoom(roomId, userId, reason = 'leave') {
        try {
            // Получаем комнату и игрока до удаления
            const room = roomsManager.getRoom(roomId);
            if (!room) {
                console.log(`Комната ${roomId} не найдена при выходе игрока ${userId}`);
                return false;
            }
            
            // Находим данные игрока до удаления
            const player = room.players.find(p => p.userId === userId);
            if (!player) {
                console.log(`Игрок ${userId} не найден в комнате ${roomId} при выходе`);
                return false;
            }
            
            // Проверяем, был ли активен обратный отсчет
            const countdownActive = room.countdown !== null;
            
            // Удаляем игрока из комнаты
            const result = roomsManager.removePlayer(roomId, userId);
            
            // Если успешно удалили игрока
            if (result.success) {
                // Если это явный выход, удаляем сокет из комнаты Socket.IO
                if (reason === 'leave') {
                    socket.leave(`room_${roomId}`);
                    socket.roomId = null;
                }
                
                // Если комната не была удалена, уведомляем оставшихся игроков
                if (!result.roomDeleted) {
                    // Отправляем уведомление об отключении игрока
                    io.to(`room_${roomId}`).emit('playerLeft', {
                        userId: userId,
                        username: player.username,
                        players: result.room.players,
                        preserveStatuses: true
                    });
                    
                    // Если был активен обратный отсчет и осталось меньше 2 игроков, отменяем отсчет
                    if (countdownActive && result.room.players.length < 2) {
                        roomsManager.cancelCountdown(roomId);
                        
                        io.to(`room_${roomId}`).emit('countdownCancelled', {
                            reason: reason === 'disconnect' ? 'notEnoughPlayers' : 'playerLeft',
                            playerId: userId,
                            playerName: player.username,
                            playersCount: result.room.players.length
                        });
                        console.log(`Отменен обратный отсчет в комнате ${roomId} из-за недостаточного количества игроков (${result.room.players.length})`);
                    }
                    
                    console.log(`Игрок ${player.username} (${userId}) ${reason === 'disconnect' ? 'отключился от' : 'вышел из'} комнаты ${roomId}`);
                } else {
                    // Если комната была удалена из-за отсутствия игроков
                    console.log(`Комната ${roomId} удалена после выхода игрока ${player.username} (${userId}), так как в ней не осталось игроков`);
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`Ошибка при удалении игрока ${userId} из комнаты ${roomId}:`, error);
            return false;
        }
    }
    
    // Обработка события отключения
    socket.on('disconnect', () => {
        console.log(`Соединение закрыто: ${socket.id}, userId: ${socket.userId}, roomId: ${socket.roomId}`);
        
        // Если игрок был в комнате, удаляем его из неё
        if (socket.roomId && socket.userId) {
            removePlayerFromRoom(socket.roomId, socket.userId, 'disconnect');
        }
    });
    
    // Обработка события явного выхода из комнаты
    socket.on('leaveRoom', (data) => {
        console.log(`Запрос на выход из комнаты: ${JSON.stringify(data)}`);
        
        try {
            // Проверяем валидность данных
            if (!data || !data.roomId || !data.userId) {
                socket.emit('error', { message: 'Неверные данные для выхода из комнаты' });
                return;
            }
            
            // Удаляем игрока из комнаты
            const success = removePlayerFromRoom(data.roomId, data.userId, 'leave');
            
            if (!success) {
                socket.emit('error', { message: 'Ошибка при выходе из комнаты' });
            }
        } catch (error) {
            console.error('Ошибка при выходе игрока из комнаты:', error);
            socket.emit('error', { message: 'Ошибка при выходе из комнаты' });
        }
    });
    
    // Обработка события поиска или создания комнаты
    socket.on('findOrCreateRoom', (playerData) => {
        console.log(`Запрос на поиск или создание комнаты от игрока: ${JSON.stringify(playerData)}`);
        
        try {
            // Проверяем валидность данных игрока
            if (!playerData || !playerData.userId) {
                socket.emit('error', { message: 'Неверные данные игрока' });
                return;
            }
            
            // Ищем доступную комнату или создаем новую
            const result = roomsManager.findOrCreateRoom(playerData);
            
            // Добавляем сокет в комнату Socket.IO
            socket.join(`room_${result.roomId}`);
            
            // Сохраняем ID комнаты в объекте сокета
            socket.roomId = result.roomId;
            
            if (result.operation === 'joined') {
                // Если присоединились к существующей комнате
                console.log(`Игрок ${playerData.username} (${playerData.userId}) присоединился к существующей комнате ${result.roomId}`);
                
                // Отправляем ответ клиенту
                socket.emit('roomJoined', { 
                    roomId: result.roomId,
                    room: result.room
                });
                
                // Если это новый игрок, уведомляем остальных участников комнаты
                if (result.isNewPlayer) {
                    // Находим данные нового игрока
                    const newPlayer = result.room.players.find(p => p.userId === playerData.userId);
                    
                    // Отправляем уведомление остальным участникам (кроме текущего)
                    socket.to(`room_${result.roomId}`).emit('playerJoined', {
                        player: newPlayer,
                        players: result.room.players
                    });
                }
            } else {
                // Если создали новую комнату
                console.log(`Создана новая комната: ${result.roomId}, игрок: ${playerData.username} (${playerData.userId})`);
                
                // Отправляем ответ клиенту
                socket.emit('roomCreated', { 
                    roomId: result.roomId,
                    players: result.room.players
                });
            }
        } catch (error) {
            console.error('Ошибка при поиске или создании комнаты:', error);
            socket.emit('error', { message: 'Ошибка при поиске или создании комнаты' });
        }
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