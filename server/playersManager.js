/**
 * Модуль управления игроками
 * Отвечает за создание, удаление и обновление игроков
 * Управляет состояниями игроков, их счетом и синхронизацией
 * @module PlayersManager
 */

const { EventEmitter } = require('events');
const { Player, PlayerState } = require('./player');

// Количество доступных скинов птиц
const AVAILABLE_SKINS = ['bitcoin', 'ethereum', 'dogecoin'];

class PlayersManager extends EventEmitter {
    /**
     * Создает новый экземпляр PlayersManager
     * @param {Object} gameConfig - Конфигурация игры с константами
     */
    constructor(gameConfig) {
        super();
        this.config = gameConfig;
        this.playersList = [];
        this.playersMap = new Map(); // Map для быстрого доступа к игрокам по ID
        
        // Подписываемся на событие готовности всех игроков
        this.on('players-ready', () => {
            console.log('Все игроки готовы к игре');
            
            // Проверяем, что игроков достаточно для начала игры
            if (this.playersList.length >= 1) {
                console.log(`Начинаем игру с ${this.playersList.length} игроками`);
                
                // Эмитим событие для запуска игры
                this.emit('start-game');
            } else {
                console.log(`Недостаточно игроков для начала игры: ${this.playersList.length}/1`);
            }
        });
    }

    /**
     * Добавляет нового игрока
     * @param {Object} userData - Данные пользователя из Telegram
     * @returns {Player} Созданный игрок
     */
    addPlayer(userData) {
        try {
            // Проверяем, есть ли уже такой игрок
            if (this.playersMap.has(userData.id)) {
                console.log(`Игрок ${userData.username} уже в списке!`);
                return this.playersMap.get(userData.id);
            }
            
            // Если скин не задан, выбираем случайный
            if (!userData.skin) {
                userData.skin = AVAILABLE_SKINS[Math.floor(Math.random() * AVAILABLE_SKINS.length)];
            }
            
            // Создаем нового игрока
            const newPlayer = new Player(userData, this.config);
            
            // Добавляем игрока в список и Map
            this.playersList.push(newPlayer);
            this.playersMap.set(userData.id, newPlayer);
            
            console.log(`Новый игрок добавлен: ${userData.username}`);
            
            return newPlayer;
        } catch (error) {
            console.error('Ошибка при добавлении игрока:', error);
            throw error;
        }
    }

    /**
     * Удаляет игрока из списка
     * @param {string} userId - ID игрока для удаления
     * @returns {boolean} Успешность операции
     */
    removePlayer(userId) {
        try {
            // Проверяем наличие игрока
            if (!this.playersMap.has(userId)) {
                console.warn(`Игрок с ID ${userId} не найден`);
                return false;
            }
            
            // Получаем игрока для логирования
            const player = this.playersMap.get(userId);
            
            // Удаляем из Map
            this.playersMap.delete(userId);
            
            // Удаляем из списка
            this.playersList = this.playersList.filter(p => p.getUserId() !== userId);
            
            console.log(`Игрок ${player.getUsername()} удален. Осталось: ${this.playersList.length}`);
            
            return true;
        } catch (error) {
            console.error('Ошибка при удалении игрока:', error);
            return false;
        }
    }

    /**
     * Обновляет состояние готовности игрока
     * @param {string} userId - ID игрока
     * @param {boolean} isReady - Новое состояние готовности
     * @returns {Object} Результат операции
     */
    changePlayerReadyState(userId, isReady) {
        try {
            // Проверяем наличие игрока
            if (!this.playersMap.has(userId)) {
                console.warn(`Игрок с ID ${userId} не найден при изменении готовности`);
                return { success: false, error: 'Игрок не найден' };
            }
            
            const player = this.playersMap.get(userId);
            
            // Обновляем состояние игрока
            player.setReadyState(isReady);
            
            console.log(`Игрок ${player.getUsername()} ${isReady ? 'готов' : 'не готов'}`);
            
            // Проверяем готовность всех игроков
            const allPlayers = this.playersList;
            if (allPlayers.length > 0) {
                const allReady = allPlayers.every(p => p.isPlaying());
                
                if (allReady) {
                    console.log('Все игроки готовы, эмитим событие players-ready');
                    this.emit('players-ready');
                }
                
                return { 
                    success: true, 
                    player: player.getPlayerData(),
                    allReady
                };
            }
            
            return { success: true, player: player.getPlayerData(), allReady: false };
        } catch (error) {
            console.error('Ошибка при изменении состояния готовности:', error);
            return { success: false, error: 'Внутренняя ошибка сервера' };
        }
    }

    /**
     * Обновляет состояние всех игроков
     * @param {number} timeLapse - Прошедшее время
     */
    updatePlayers(timeLapse) {
        this.playersList.forEach(player => player.update(timeLapse));
    }

    /**
     * Проверяет, есть ли еще живые игроки
     * @returns {boolean} true если есть хотя бы один живой игрок
     */
    arePlayersStillAlive() {
        return this.playersList.some(p => p.isPlaying());
    }

    /**
     * Сбрасывает состояние всех игроков для новой игры
     * @returns {Array} Данные игроков после сброса
     */
    resetPlayersForNewGame() {
        this.playersList.forEach(player => player.resetPosition());
        return this.getPlayersData();
    }

    /**
     * Возвращает список всех игроков
     * @returns {Array} Массив игроков
     */
    getPlayers() {
        return [...this.playersList];
    }

    /**
     * Возвращает данные всех игроков
     * @returns {Array} Массив данных игроков
     */
    getPlayersData() {
        return this.playersList.map(player => player.getPlayerData());
    }

    /**
     * Возвращает список активных игроков (не умерших)
     * @returns {Array} Массив активных игроков
     */
    getActivePlayers() {
        return this.playersList.filter(p => p.isPlaying());
    }

    /**
     * Возвращает данные активных игроков
     * @returns {Array} Массив данных активных игроков
     */
    getActivePlayersData() {
        return this.getActivePlayers().map(player => player.getPlayerData());
    }

    /**
     * Отправляет счет всем игрокам
     * @param {Object} io - Socket.IO сервер
     * @param {string} roomId - ID комнаты
     * @param {Array} highScores - Таблица рекордов
     */
    sendPlayersScore(io, roomId, highScores) {
        const totalPlayers = this.playersList.length;
        
        // Отправляем счет каждому игроку
        this.playersList.forEach(player => {
            const socket = io.sockets.sockets.get(player.getSocketId());
            if (socket) {
                player.sendScore(socket, totalPlayers, highScores);
            }
        });
        
        // Также отправляем общие результаты всем в комнате
        const resultsData = this.playersList.map(player => ({
            id: player.getUserId(),
            username: player.getUsername(),
            score: player.getScore(),
            rank: player.getRank()
        }));
        
        io.to(roomId).emit('gameOver', { results: resultsData });
    }
}

module.exports = PlayersManager; 