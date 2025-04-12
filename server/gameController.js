/**
 * Модуль управления игровым процессом
 * Интегрируется с системой комнат и отвечает за запуск, обновление
 * и завершение игровых сессий для каждой комнаты
 */

const { gameConfig } = require('./gameConfig');
const PlayersManager = require('./playersManager');
const PipeManager = require('./pipeManager');
const CollisionEngine = require('./collisionEngine');

// Хранилище игровых сессий по комнатам
const gameInstances = new Map();

/**
 * Класс, управляющий игровой сессией для конкретной комнаты
 */
class GameInstance {
    /**
     * Создает новый экземпляр игры для комнаты
     * @param {string} roomId - ID комнаты
     * @param {Object} io - Socket.IO сервер для отправки обновлений
     */
    constructor(roomId, io) {
        this.roomId = roomId;
        this.io = io;
        this.isRunning = false;
        this.lastUpdateTime = null;
        this.gameLoopInterval = null;
        
        // Создаем менеджеры для игровых объектов
        this.playersManager = new PlayersManager(gameConfig);
        this.pipeManager = new PipeManager(gameConfig);
        
        // Подписываемся на событие необходимости создания новой трубы
        this.pipeManager.on('need_new_pipe', () => {
            this.pipeManager.createNewPipe();
        });
        
        // Подписываемся на событие готовности всех игроков
        this.playersManager.on('start-game', () => {
            this.startGame();
        });
        
        // Создаем первую трубу
        this.pipeManager.createNewPipe();
    }
    
    /**
     * Добавляет игрока в игровую сессию
     * @param {Object} userData - Данные пользователя
     * @returns {Object} Созданный игрок
     */
    addPlayer(userData) {
        return this.playersManager.addPlayer(userData);
    }
    
    /**
     * Удаляет игрока из игровой сессии
     * @param {string} userId - ID игрока
     */
    removePlayer(userId) {
        this.playersManager.removePlayer(userId);
        
        // Если все игроки вышли, останавливаем игру
        if (this.playersManager.getPlayers().length === 0) {
            this.stopGame();
        }
    }
    
    /**
     * Запускает игровую сессию
     */
    startGame() {
        if (this.isRunning) {
            console.log(`Игра в комнате ${this.roomId} уже запущена`);
            return;
        }
        
        console.log(`Запуск игры в комнате ${this.roomId}`);
        
        // Сбрасываем состояние всех игроков
        this.playersManager.resetPlayersForNewGame();
        
        // Очищаем список труб и создаем начальную трубу
        this.pipeManager.flushPipeList();
        this.pipeManager.createNewPipe();
        
        // Устанавливаем флаг запущенной игры
        this.isRunning = true;
        this.lastUpdateTime = Date.now();
        
        // Отправляем событие начала игры всем клиентам в комнате
        this.io.to(this.roomId).emit('gameStarted', {
            players: this.playersManager.getPlayersData(),
            pipes: this.pipeManager.getPipeList()
        });
        
        // Запускаем игровой цикл (60 FPS)
        this.gameLoopInterval = setInterval(() => this.gameLoop(), 1000 / 60);
    }
    
    /**
     * Основной игровой цикл
     */
    gameLoop() {
        try {
            const now = Date.now();
            let elapsedTime = 0;
            
            // Вычисляем время, прошедшее с последнего обновления
            if (this.lastUpdateTime) {
                elapsedTime = now - this.lastUpdateTime;
            }
            
            this.lastUpdateTime = now;
            
            // Если все игроки покинули игру, завершаем её
            if (this.playersManager.getPlayers().length === 0) {
                this.gameOver();
                return;
            }
            
            // Обновляем позиции игроков
            this.playersManager.updatePlayers(elapsedTime);
            
            // Обновляем позиции труб
            this.pipeManager.updatePipes(elapsedTime);
            
            // Проверяем столкновения
            const pipes = this.pipeManager.getPotentialPipeHit();
            const players = this.playersManager.getActivePlayers();
            
            if (CollisionEngine.checkCollisions(pipes, players, gameConfig)) {
                // Если не осталось живых игроков, завершаем игру
                if (!this.playersManager.arePlayersStillAlive()) {
                    this.gameOver();
                    return;
                }
            }
            
            // Отправляем обновленное состояние всем игрокам в комнате
            this.io.to(this.roomId).emit('gameStateUpdate', {
                players: this.playersManager.getPlayersData(),
                pipes: this.pipeManager.getPipeList()
            });
        } catch (error) {
            console.error(`Ошибка в игровом цикле для комнаты ${this.roomId}:`, error);
        }
    }
    
    /**
     * Завершает игру и отображает результаты
     */
    gameOver() {
        console.log(`Игра в комнате ${this.roomId} завершена`);
        
        // Останавливаем игровой цикл
        this.stopGame();
        
        // Отправляем результаты игрокам
        const highScores = []; // TODO: Реализовать получение таблицы рекордов
        this.playersManager.sendPlayersScore(this.io, this.roomId, highScores);
        
        // Отправляем событие завершения игры всем в комнате
        this.io.to(this.roomId).emit('gameOver', {
            roomId: this.roomId
        });
        
        // Через заданное время сбрасываем состояние игры и переводим всех в режим ожидания
        setTimeout(() => {
            // Сбрасываем состояние игроков
            this.playersManager.resetPlayersForNewGame();
            
            // Очищаем список труб
            this.pipeManager.flushPipeList();
            
            // Отправляем событие возврата в лобби
            this.io.to(this.roomId).emit('backToLobby', {
                players: this.playersManager.getPlayersData()
            });
        }, gameConfig.TIME_BETWEEN_GAMES);
    }
    
    /**
     * Останавливает игровой цикл
     */
    stopGame() {
        this.isRunning = false;
        
        if (this.gameLoopInterval) {
            clearInterval(this.gameLoopInterval);
            this.gameLoopInterval = null;
        }
        
        this.lastUpdateTime = null;
    }
    
    /**
     * Обрабатывает прыжок игрока
     * @param {string} userId - ID игрока
     */
    handlePlayerJump(userId) {
        if (!this.isRunning) return;
        
        // Получаем игрока по ID
        const player = this.playersManager.playersMap.get(userId);
        
        if (player && player.isPlaying()) {
            // Вызываем прыжок
            player.jump();
        }
    }
    
    /**
     * Обрабатывает изменение состояния готовности игрока
     * @param {string} userId - ID игрока
     * @param {boolean} isReady - Новое состояние готовности
     * @returns {Object} Результат операции
     */
    handlePlayerReadyState(userId, isReady) {
        return this.playersManager.changePlayerReadyState(userId, isReady);
    }
}

/**
 * Создает новую игровую сессию для комнаты
 * @param {string} roomId - ID комнаты
 * @param {Object} io - Socket.IO сервер
 * @returns {GameInstance} Экземпляр игры
 */
function createGameInstance(roomId, io) {
    // Если уже есть игровая сессия для этой комнаты, возвращаем её
    if (gameInstances.has(roomId)) {
        return gameInstances.get(roomId);
    }
    
    // Создаем новую игровую сессию
    const gameInstance = new GameInstance(roomId, io);
    gameInstances.set(roomId, gameInstance);
    
    console.log(`Создана новая игровая сессия для комнаты ${roomId}`);
    
    return gameInstance;
}

/**
 * Удаляет игровую сессию для комнаты
 * @param {string} roomId - ID комнаты
 */
function removeGameInstance(roomId) {
    if (gameInstances.has(roomId)) {
        const gameInstance = gameInstances.get(roomId);
        
        // Останавливаем игру
        gameInstance.stopGame();
        
        // Удаляем экземпляр игры
        gameInstances.delete(roomId);
        
        console.log(`Удалена игровая сессия для комнаты ${roomId}`);
    }
}

/**
 * Получает игровую сессию для комнаты
 * @param {string} roomId - ID комнаты
 * @returns {GameInstance|null} Экземпляр игры или null, если не найден
 */
function getGameInstance(roomId) {
    return gameInstances.get(roomId) || null;
}

module.exports = {
    createGameInstance,
    getGameInstance,
    removeGameInstance
}; 