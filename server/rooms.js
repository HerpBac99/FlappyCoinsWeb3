// Модуль для управления игровыми комнатами
const { v4: uuidv4 } = require('uuid');

// Хранилище комнат в памяти сервера
const rooms = new Map();

// Максимальное количество игроков в комнате
const MAX_PLAYERS_PER_ROOM = 6;

// Время обратного отсчета перед началом игры (в секундах)
const COUNTDOWN_TIME = 5;

// Добавляем хранилище таймеров удаления комнат
const roomDeletionTimers = new Map();

// Время ожидания перед удалением пустой комнаты (в миллисекундах)
const ROOM_DELETION_TIMEOUT = 30000; // 30 секунд

/**
 * Создает новую игровую комнату и добавляет первого игрока
 * @param {Object} player - Объект с данными игрока
 * @returns {Object} - Объект с данными созданной комнаты
 */
function createRoom(player) {
    // Генерируем уникальный ID для комнаты
    const roomId = uuidv4().substring(0, 8);
    
    // Создаем объект комнаты
    const room = {
        id: roomId,
        createdAt: new Date().toISOString(),
        createdBy: player.userId,
        players: [{
            userId: player.userId,
            username: player.username,
            photoUrl: player.photoUrl,
            isReady: false,
            joinedAt: new Date().toISOString()
        }],
        isGameStarted: false,
        countdown: null // Таймер обратного отсчета
    };
    
    // Сохраняем комнату в Map
    rooms.set(roomId, room);
    
    console.log(`Создана новая комната: ${roomId}, игрок: ${player.username} (${player.userId})`);
    
    return { roomId, room };
}

/**
 * Добавляет игрока в существующую комнату
 * @param {string} roomId - ID комнаты
 * @param {Object} player - Объект с данными игрока
 * @returns {Object} - Объект с результатом операции
 */
function joinRoom(roomId, player) {
    // Проверяем существование комнаты
    if (!rooms.has(roomId)) {
        console.log(`Комната не найдена: ${roomId}`);
        return { success: false, error: 'ROOM_NOT_FOUND', message: 'Комната не найдена' };
    }
    
    const room = rooms.get(roomId);
    
    // Проверяем, не началась ли уже игра
    if (room.isGameStarted) {
        console.log(`Попытка присоединиться к уже начатой игре: ${roomId}`);
        return { success: false, error: 'GAME_ALREADY_STARTED', message: 'Игра уже началась' };
    }
    
    // Проверяем, не заполнена ли комната
    if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
        console.log(`Комната заполнена: ${roomId}`);
        return { success: false, error: 'ROOM_FULL', message: 'Комната заполнена' };
    }
    
    // Проверяем, не присоединился ли игрок уже к комнате
    const existingPlayerIndex = room.players.findIndex(p => p.userId === player.userId);
    if (existingPlayerIndex !== -1) {
        // Игрок уже в комнате, обновляем его данные
        room.players[existingPlayerIndex] = {
            ...room.players[existingPlayerIndex],
            username: player.username,
            photoUrl: player.photoUrl,
            lastActive: new Date().toISOString()
        };
        console.log(`Игрок ${player.username} (${player.userId}) уже в комнате ${roomId}, обновлены данные`);
        
        return { success: true, room, isNewPlayer: false };
    }
    
    // Добавляем игрока в комнату
    room.players.push({
        userId: player.userId,
        username: player.username,
        photoUrl: player.photoUrl,
        isReady: false,
        joinedAt: new Date().toISOString()
    });
    
    console.log(`Игрок ${player.username} (${player.userId}) присоединился к комнате ${roomId}`);
    
    return { success: true, room, isNewPlayer: true };
}

/**
 * Изменяет статус готовности игрока
 * @param {string} roomId - ID комнаты
 * @param {string} userId - ID игрока
 * @param {boolean} isReady - Новый статус готовности
 * @returns {Object} - Объект с результатом операции
 */
function togglePlayerReady(roomId, userId, isReady) {
    // Проверяем существование комнаты
    if (!rooms.has(roomId)) {
        console.log(`Комната не найдена: ${roomId}`);
        return { success: false, error: 'ROOM_NOT_FOUND', message: 'Комната не найдена' };
    }
    
    const room = rooms.get(roomId);
    
    // Проверяем, не началась ли уже игра
    if (room.isGameStarted) {
        console.log(`Попытка изменить статус в уже начатой игре: ${roomId}`);
        return { success: false, error: 'GAME_ALREADY_STARTED', message: 'Игра уже началась' };
    }
    
    // Находим игрока в комнате
    const playerIndex = room.players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) {
        console.log(`Игрок ${userId} не найден в комнате ${roomId}`);
        return { success: false, error: 'PLAYER_NOT_FOUND', message: 'Игрок не найден в комнате' };
    }
    
    // Обновляем статус готовности игрока
    room.players[playerIndex].isReady = isReady;
    console.log(`Игрок ${room.players[playerIndex].username} (${userId}) изменил статус: ${isReady ? 'готов' : 'не готов'}`);
    
    // Проверяем, все ли игроки готовы
    const allPlayersReady = room.players.length > 1 && room.players.every(p => p.isReady);
    
    return { 
        success: true, 
        room, 
        player: room.players[playerIndex],
        allPlayersReady
    };
}

/**
 * Запускает обратный отсчет перед началом игры
 * @param {string} roomId - ID комнаты
 * @param {Function} onCountdownEnd - Колбэк, вызываемый по окончанию отсчета
 * @returns {Object} - Объект с результатом операции
 */
function startCountdown(roomId, onCountdownEnd) {
    // Проверяем существование комнаты
    if (!rooms.has(roomId)) {
        console.log(`Комната не найдена: ${roomId}`);
        return { success: false, error: 'ROOM_NOT_FOUND', message: 'Комната не найдена' };
    }
    
    const room = rooms.get(roomId);
    
    // Проверяем, не началась ли уже игра
    if (room.isGameStarted) {
        console.log(`Попытка запустить обратный отсчет в уже начатой игре: ${roomId}`);
        return { success: false, error: 'GAME_ALREADY_STARTED', message: 'Игра уже началась' };
    }
    
    // Проверяем, не запущен ли уже обратный отсчет
    if (room.countdown) {
        console.log(`Обратный отсчет уже запущен для комнаты ${roomId}`);
        return { success: true, countdownTime: COUNTDOWN_TIME };
    }
    
    console.log(`Запуск обратного отсчета для комнаты ${roomId}`);
    
    // Запускаем обратный отсчет
    room.countdown = setTimeout(() => {
        // По окончанию отсчета запускаем игру
        room.isGameStarted = true;
        room.countdown = null;
        
        console.log(`Начало игры в комнате ${roomId}`);
        
        // Вызываем колбэк с данными комнаты
        onCountdownEnd(room);
    }, COUNTDOWN_TIME * 1000);
    
    return { success: true, countdownTime: COUNTDOWN_TIME };
}

/**
 * Получает данные комнаты по ID
 * @param {string} roomId - ID комнаты
 * @returns {Object|null} - Объект комнаты или null, если комната не найдена
 */
function getRoom(roomId) {
    return rooms.has(roomId) ? rooms.get(roomId) : null;
}

/**
 * Удаляет игрока из комнаты
 * @param {string} roomId - ID комнаты
 * @param {string} userId - ID игрока
 * @returns {Object} - Объект с результатом операции
 */
function removePlayer(roomId, userId) {
    // Проверяем существование комнаты
    if (!rooms.has(roomId)) {
        console.log(`Комната не найдена: ${roomId}`);
        return { success: false, error: 'ROOM_NOT_FOUND', message: 'Комната не найдена' };
    }
    
    const room = rooms.get(roomId);
    
    // Находим индекс игрока в комнате
    const playerIndex = room.players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) {
        console.log(`Игрок ${userId} не найден в комнате ${roomId}`);
        return { success: false, error: 'PLAYER_NOT_FOUND', message: 'Игрок не найден в комнате' };
    }
    
    // Получаем данные игрока для лога
    const player = room.players[playerIndex];
    
    // Удаляем игрока из комнаты
    room.players.splice(playerIndex, 1);
    console.log(`Игрок ${player.username} (${userId}) удален из комнаты ${roomId}`);
    
    // Если комната пуста, удаляем её немедленно
    if (room.players.length === 0) {
        // Если есть активный таймер обратного отсчета, очищаем его
        if (room.countdown) {
            clearTimeout(room.countdown);
            room.countdown = null;
        }
        
        // Если есть таймер удаления комнаты, очищаем его
        if (roomDeletionTimers.has(roomId)) {
            clearTimeout(roomDeletionTimers.get(roomId));
            roomDeletionTimers.delete(roomId);
        }
        
        // Удаляем комнату сразу
        console.log(`Удаление пустой комнаты ${roomId} немедленно`);
        rooms.delete(roomId);
        
        return { 
            success: true, 
            roomDeleted: true,
            player 
        };
    }
    
    // Если удаленный игрок был создателем комнаты, назначаем нового создателя
    if (room.createdBy === userId) {
        // Назначаем создателем первого оставшегося игрока
        room.createdBy = room.players[0].userId;
        console.log(`Новый создатель комнаты ${roomId}: ${room.players[0].username} (${room.createdBy})`);
    }
    
    return { success: true, roomDeleted: false, room, player };
}

/**
 * Получает список всех активных комнат
 * @returns {Array} - Массив объектов комнат
 */
function getAllRooms() {
    return Array.from(rooms.values());
}

/**
 * Удаляет комнату по ID
 * @param {string} roomId - ID комнаты
 * @returns {boolean} - true, если комната была удалена, false если комнаты не существовало
 */
function deleteRoom(roomId) {
    // Проверяем существование комнаты
    if (!rooms.has(roomId)) {
        console.log(`Попытка удаления несуществующей комнаты: ${roomId}`);
        return false;
    }
    
    // Если есть активный таймер, очищаем его
    const room = rooms.get(roomId);
    if (room.countdown) {
        clearTimeout(room.countdown);
    }
    
    // Если есть таймер удаления, очищаем его
    if (roomDeletionTimers.has(roomId)) {
        clearTimeout(roomDeletionTimers.get(roomId));
        roomDeletionTimers.delete(roomId);
    }
    
    // Удаляем комнату
    const result = rooms.delete(roomId);
    console.log(`Комната ${roomId} удалена`);
    
    return result;
}

/**
 * Ищет доступную комнату или создает новую, если нет свободных
 * @param {Object} player - Объект с данными игрока
 * @returns {Object} - Объект с данными о найденной или созданной комнате и типе операции
 */
function findOrCreateRoom(player) {
    // Ищем все активные комнаты
    const activeRooms = getAllRooms();
    
    console.log(`Поиск доступной комнаты для игрока ${player.username} (${player.userId}). Всего комнат: ${activeRooms.length}`);
    
    // Логируем состояние всех активных комнат
    if (activeRooms.length > 0) {
        activeRooms.forEach(room => {
            console.log(`Проверка комнаты ${room.id}: игроков ${room.players.length}/${MAX_PLAYERS_PER_ROOM}, игра началась: ${room.isGameStarted}`);
        });
    }
    
    // Ищем комнату с менее чем максимальным количеством игроков и не начатой игрой
    const availableRoom = activeRooms.find(room => 
        room.players.length < MAX_PLAYERS_PER_ROOM && 
        !room.isGameStarted &&
        // Проверяем, что игрок еще не в этой комнате
        !room.players.some(p => p.userId === player.userId) &&
        // Дополнительно убеждаемся, что комната активна и в ней есть игроки
        room.players.length > 0
    );
    
    // Если нашли доступную комнату, присоединяем игрока к ней
    if (availableRoom) {
        console.log(`Найдена доступная комната ${availableRoom.id} для игрока ${player.username} (${player.userId})`);
        const joinResult = joinRoom(availableRoom.id, player);
        
        if (joinResult.success) {
            return {
                operation: 'joined',
                roomId: availableRoom.id,
                room: joinResult.room,
                isNewPlayer: joinResult.isNewPlayer
            };
        } else {
            console.log(`Не удалось присоединиться к комнате ${availableRoom.id}: ${joinResult.error} - ${joinResult.message}`);
        }
    } else {
        console.log(`Не найдено доступных комнат для игрока ${player.username} (${player.userId})`);
    }
    
    // Если не нашли доступной комнаты или не смогли присоединиться, создаем новую
    console.log(`Создание новой комнаты для игрока ${player.username} (${player.userId}), доступные комнаты не найдены`);
    const createResult = createRoom(player);
    
    return {
        operation: 'created',
        roomId: createResult.roomId,
        room: createResult.room
    };
}

/**
 * Отменяет обратный отсчет перед началом игры
 * @param {string} roomId - ID комнаты
 * @returns {Object} - Объект с результатом операции
 */
function cancelCountdown(roomId) {
    // Проверяем существование комнаты
    if (!rooms.has(roomId)) {
        console.log(`Комната не найдена при отмене отсчета: ${roomId}`);
        return { success: false, error: 'ROOM_NOT_FOUND', message: 'Комната не найдена' };
    }
    
    const room = rooms.get(roomId);
    
    // Проверяем наличие активного отсчета
    if (!room.countdown) {
        console.log(`Нет активного отсчета для отмены в комнате ${roomId}`);
        return { success: false, error: 'NO_ACTIVE_COUNTDOWN', message: 'Нет активного отсчета для отмены' };
    }
    
    // Отменяем таймер отсчета
    clearTimeout(room.countdown);
    room.countdown = null;
    
    console.log(`Отменен обратный отсчет в комнате ${roomId}`);
    
    return { success: true, room };
}

// Экспортируем функции модуля
module.exports = {
    createRoom,
    joinRoom,
    togglePlayerReady,
    startCountdown,
    cancelCountdown,
    getRoom,
    removePlayer,
    getAllRooms,
    deleteRoom,
    findOrCreateRoom,
    MAX_PLAYERS_PER_ROOM,
    COUNTDOWN_TIME
};