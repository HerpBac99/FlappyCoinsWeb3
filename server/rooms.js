// Модуль управления игровыми комнатами
require('dotenv').config();

// Максимальное количество игроков в комнате
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS_PER_ROOM) || 5;

// Время ожидания в комнате (в секундах)
const ROOM_WAITING_TIME = parseInt(process.env.ROOM_WAITING_TIME) || 30;

// Объект для хранения комнат
let rooms = {};

/**
 * Инициализация комнат
 * Сбрасывает все существующие комнаты
 */
function initRooms() {
    rooms = {};
    console.log('Комнаты инициализированы');
}

/**
 * Генерация уникального ID для комнаты
 * @returns {string} ID комнаты
 */
function generateRoomId() {
    // Генерируем 6-значный код комнаты
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Создает новую игровую комнату
 * @param {Object} creator - Данные создателя комнаты
 * @returns {Object} Созданная комната
 */
function createRoom(creator) {
    // Генерируем уникальный ID комнаты
    const roomId = generateRoomId();
    
    // Создаем объект комнаты
    const room = {
        id: roomId,
        createdAt: new Date().toISOString(),
        status: 'waiting', // waiting, countdown, playing, finished
        players: [{
            id: creator.id,
            username: creator.username || 'Аноним',
            photoUrl: creator.photo_url || null,
            score: 0,
            ready: false,
            isCreator: true
        }],
        startTime: null,
        finishTime: null
    };
    
    // Добавляем комнату в хранилище
    rooms[roomId] = room;
    
    console.log(`Создана комната ${roomId}`);
    
    // Устанавливаем таймер на удаление комнаты, если игра не начнется
    setTimeout(() => {
        // Проверяем, существует ли еще комната и в статусе ожидания
        if (rooms[roomId] && rooms[roomId].status === 'waiting') {
            console.log(`Время ожидания истекло для комнаты ${roomId}, удаляем`);
            delete rooms[roomId];
        }
    }, ROOM_WAITING_TIME * 1000);
    
    return room;
}

/**
 * Присоединяет игрока к комнате
 * @param {string} roomId - ID комнаты
 * @param {Object} player - Данные игрока
 * @returns {Object} Результат операции
 */
function joinRoom(roomId, player) {
    // Проверяем существование комнаты
    if (!rooms[roomId]) {
        return { success: false, error: 'Комната не найдена' };
    }
    
    // Проверяем статус комнаты
    if (rooms[roomId].status !== 'waiting') {
        return { success: false, error: 'Нельзя присоединиться к комнате, игра уже началась' };
    }
    
    // Проверяем, не превышено ли максимальное количество игроков
    if (rooms[roomId].players.length >= MAX_PLAYERS) {
        return { success: false, error: 'Комната заполнена' };
    }
    
    // Проверяем, не присоединился ли игрок уже к этой комнате
    if (rooms[roomId].players.some(p => p.id === player.id)) {
        return { success: false, error: 'Вы уже присоединились к этой комнате' };
    }
    
    // Добавляем игрока в комнату
    rooms[roomId].players.push({
        id: player.id,
        username: player.username || 'Аноним',
        photoUrl: player.photo_url || null,
        score: 0,
        ready: false,
        isCreator: false
    });
    
    console.log(`Игрок ${player.id} присоединился к комнате ${roomId}`);
    
    return { success: true, room: rooms[roomId] };
}

/**
 * Удаляет игрока из комнаты
 * @param {string} roomId - ID комнаты
 * @param {string} playerId - ID игрока
 * @returns {Object} Результат операции
 */
function leaveRoom(roomId, playerId) {
    // Проверяем существование комнаты
    if (!rooms[roomId]) {
        return { success: false, error: 'Комната не найдена' };
    }
    
    // Находим индекс игрока в комнате
    const playerIndex = rooms[roomId].players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
        return { success: false, error: 'Игрок не найден в комнате' };
    }
    
    // Проверяем, не в игре ли комната
    if (rooms[roomId].status === 'playing' || rooms[roomId].status === 'countdown') {
        // Помечаем игрока как отключенного, но не удаляем
        rooms[roomId].players[playerIndex].disconnected = true;
    } else {
        // Если это создатель комнаты, удаляем всю комнату
        if (rooms[roomId].players[playerIndex].isCreator) {
            console.log(`Создатель комнаты ${roomId} вышел, удаляем комнату`);
            delete rooms[roomId];
            return { success: true, roomDeleted: true };
        }
        
        // Удаляем игрока из комнаты
        rooms[roomId].players.splice(playerIndex, 1);
        
        // Если в комнате не осталось игроков, удаляем комнату
        if (rooms[roomId].players.length === 0) {
            console.log(`В комнате ${roomId} не осталось игроков, удаляем`);
            delete rooms[roomId];
            return { success: true, roomDeleted: true };
        }
    }
    
    console.log(`Игрок ${playerId} покинул комнату ${roomId}`);
    
    return { success: true };
}

/**
 * Устанавливает статус готовности игрока
 * @param {string} roomId - ID комнаты
 * @param {string} playerId - ID игрока
 * @returns {Object} Результат операции
 */
function setPlayerReady(roomId, playerId) {
    // Проверяем существование комнаты
    if (!rooms[roomId]) {
        return { success: false, error: 'Комната не найдена' };
    }
    
    // Находим игрока в комнате
    const player = rooms[roomId].players.find(p => p.id === playerId);
    
    if (!player) {
        return { success: false, error: 'Игрок не найден в комнате' };
    }
    
    // Устанавливаем статус готовности
    player.ready = true;
    
    console.log(`Игрок ${playerId} готов в комнате ${roomId}`);
    
    // Проверяем, все ли игроки готовы
    const allReady = rooms[roomId].players.every(p => p.ready);
    
    if (allReady) {
        // Меняем статус комнаты на обратный отсчет
        rooms[roomId].status = 'countdown';
        console.log(`Все игроки готовы в комнате ${roomId}, начинаем обратный отсчет`);
    }
    
    return { success: true, allReady };
}

/**
 * Обновляет счёт игрока
 * @param {string} roomId - ID комнаты
 * @param {string} playerId - ID игрока
 * @param {number} score - Новый счёт
 * @returns {boolean} Успешность операции
 */
function updatePlayerScore(roomId, playerId, score) {
    // Проверяем существование комнаты
    if (!rooms[roomId]) {
        return false;
    }
    
    // Находим игрока в комнате
    const player = rooms[roomId].players.find(p => p.id === playerId);
    
    if (!player) {
        return false;
    }
    
    // Обновляем счет
    player.score = score;
    
    return true;
}

/**
 * Получает список всех комнат
 * @returns {Object} Объект со всеми комнатами
 */
function getRooms() {
    return rooms;
}

/**
 * Получает информацию о конкретной комнате
 * @param {string} roomId - ID комнаты
 * @returns {Object|null} Объект комнаты или null, если комната не найдена
 */
function getRoom(roomId) {
    return rooms[roomId] || null;
}

module.exports = {
    initRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    setPlayerReady,
    getRooms,
    getRoom,
    updatePlayerScore
}; 