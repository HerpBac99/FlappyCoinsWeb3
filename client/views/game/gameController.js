/**
 * GameController - управляет интеграцией игры с Telegram Mini App
 * Отвечает за инициализацию игры, обработку состояний и связь с UI
 */
class GameController {
    /**
     * Создает экземпляр контроллера игры
     * @param {Object} gameContainerElement - DOM элемент, содержащий игровой canvas
     */
    constructor(gameContainerElement) {
        this.container = gameContainerElement;
        this.canvas = document.getElementById('game-canvas');
        
        // Проверяем наличие canvas
        if (!this.canvas) {
            if (window.appLogger) {
                window.appLogger.error('Canvas не найден в DOM');
            }
            throw new Error('Canvas не найден в DOM');
        }
        
        // Создаем игровой движок
        this.gameEngine = null;
        
        // Данные комнаты
        this.roomData = null;
        
        // Инициализация
        this.initialized = false;
        
        // Переменные для обработки WebSocket
        this.onSocketGameUpdateHandler = this.handleGameUpdate.bind(this);
        this.onGameOverHandler = this.handleGameOver.bind(this);
        
        if (window.appLogger) {
            window.appLogger.info('GameController создан');
        }
    }
    
    /**
     * Инициализирует игру с данными из комнаты
     * @param {Object} roomData - Данные комнаты с игроками
     * @returns {boolean} true если инициализация прошла успешно
     */
    initialize(roomData) {
        try {
            // Проверяем валидность данных
            if (!roomData || !roomData.players || !Array.isArray(roomData.players)) {
                if (window.appLogger) {
                    window.appLogger.error('Невалидные данные комнаты для инициализации игры', roomData);
                }
                return false;
            }
            
            // Сохраняем данные комнаты
            this.roomData = roomData;
            
            // Создаем игровой движок
            this.gameEngine = new window.GameEngine(this.canvas);
            
            // Инициализируем игру с данными комнаты
            this.gameEngine.initFromRoomData(roomData);
            
            // Устанавливаем обработчики событий
            document.addEventListener('flappycoin:gameOver', this.onGameOverHandler);
            
            // Регистрируем обработчик WebSocket для обновлений игры
            if (window.socketService) {
                window.socketService.on('gameUpdate', this.onSocketGameUpdateHandler);
            }
            
            this.initialized = true;
            
            if (window.appLogger) {
                window.appLogger.info('Игра успешно инициализирована', {
                    roomId: roomData.roomId,
                    playersCount: roomData.players.length
                });
            }
            
            return true;
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при инициализации игры', {
                    error: error.message,
                    stack: error.stack
                });
            }
            console.error('Ошибка при инициализации игры:', error);
            return false;
        }
    }
    
    /**
     * Запускает игру после инициализации
     * @returns {boolean} true если запуск прошел успешно
     */
    startGame() {
        try {
            if (!this.initialized || !this.gameEngine) {
                if (window.appLogger) {
                    window.appLogger.error('Попытка запустить неинициализированную игру');
                }
                return false;
            }
            
            // Показываем игровую сцену
            this.container.style.display = 'block';
            
            // Запускаем игру
            this.gameEngine.startGame();
            
            if (window.appLogger) {
                window.appLogger.info('Игра запущена');
            }
            
            return true;
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при запуске игры', {
                    error: error.message
                });
            }
            console.error('Ошибка при запуске игры:', error);
            return false;
        }
    }
    
    /**
     * Останавливает и очищает игру
     * @returns {boolean} true если остановка прошла успешно
     */
    stopGame() {
        try {
            if (!this.initialized || !this.gameEngine) {
                if (window.appLogger) {
                    window.appLogger.error('Попытка остановить неинициализированную игру');
                }
                return false;
            }
            
            // Очищаем игровой движок
            this.gameEngine.cleanup();
            
            // Скрываем игровую сцену
            this.container.style.display = 'none';
            
            // Удаляем обработчики событий
            document.removeEventListener('flappycoin:gameOver', this.onGameOverHandler);
            
            // Отписываемся от WebSocket событий
            if (window.socketService) {
                window.socketService.off('gameUpdate', this.onSocketGameUpdateHandler);
            }
            
            this.initialized = false;
            this.gameEngine = null;
            
            if (window.appLogger) {
                window.appLogger.info('Игра остановлена и очищена');
            }
            
            return true;
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при остановке игры', {
                    error: error.message
                });
            }
            console.error('Ошибка при остановке игры:', error);
            return false;
        }
    }
    
    /**
     * Обрабатывает обновления игры с сервера
     * @param {Object} data - Данные обновления игры
     */
    handleGameUpdate(data) {
        // В будущем здесь можно обрабатывать синхронизацию с сервером
        if (window.appLogger) {
            window.appLogger.debug('Получено обновление игры от сервера', data);
        }
    }
    
    /**
     * Обрабатывает завершение игры
     * @param {CustomEvent} event - Событие завершения игры
     */
    handleGameOver(event) {
        const { players } = event.detail;
        
        if (window.appLogger) {
            window.appLogger.info('Получено событие завершения игры', {
                playersCount: players.length,
                scores: players.map(p => ({
                    username: p.username,
                    userId: p.userId,
                    score: p.score
                }))
            });
        }
        
        // Отправляем результаты на сервер
        if (window.socketService && window.socketService.isConnected()) {
            window.socketService.emit('gameResults', {
                roomId: this.roomData.roomId,
                players: players
            });
        }
        
        // Через 5 секунд после показа результатов, возвращаемся в комнату
        setTimeout(() => {
            // Добавляем обработчик клика для возврата в комнату
            const clickHandler = () => {
                this.canvas.removeEventListener('click', clickHandler);
                
                // Останавливаем игру
                this.stopGame();
                
                // Возвращаемся в комнату ожидания
                if (typeof app !== 'undefined' && app.showScreen) {
                    app.showScreen('room', { roomId: this.roomData.roomId });
                }
            };
            
            this.canvas.addEventListener('click', clickHandler);
        }, 3000);
    }
    
    /**
     * Проверяет, инициализирован ли контроллер игры
     * @returns {boolean} true если контроллер инициализирован
     */
    isInitialized() {
        return this.initialized;
    }
}

// Экспортируем класс в глобальное пространство имен
window.GameController = GameController; 