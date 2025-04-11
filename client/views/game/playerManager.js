/**
 * Класс PlayerManager - управляет всеми игроками в игре
 * Адаптирован для работы на клиентской стороне
 */
class PlayerManager {
    /**
     * Создает экземпляр менеджера игроков
     */
    constructor() {
        this.playersList = [];
        this.positionCounter = 0;
        
        if (window.appLogger) {
            window.appLogger.info('PlayerManager инициализирован');
        }
    }

    /**
     * Добавляет нового игрока в список
     * @param {string} userId - ID игрока
     * @param {string} username - Имя пользователя
     * @param {string} skin - Скин монеты
     * @param {string} photoUrl - URL аватара
     * @returns {Player} Созданный игрок
     */
    addPlayer(userId, username, skin = 'bitcoin', photoUrl = null) {
        try {
            // Создаем игрока
            const player = new window.Player(userId, username, skin, photoUrl);
            
            // Добавляем в список
            this.playersList.push(player);
            
            if (window.appLogger) {
                window.appLogger.info('Игрок добавлен в список', { 
                    userId,
                    username,
                    playersCount: this.playersList.length 
                });
            }
            
            return player;
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при добавлении игрока', { error: error.message });
            }
            console.error('Ошибка при добавлении игрока:', error);
            throw error;
        }
    }
    
    /**
     * Находит игрока по ID и возвращает его индекс в списке
     * @param {string} userId - ID игрока для поиска
     * @returns {number} Индекс игрока или -1, если не найден
     */
    findPlayerIndex(userId) {
        return this.playersList.findIndex(player => player.getPlayerObject().userId === userId);
    }

    /**
     * Удаляет игрока из списка
     * @param {string} userId - ID игрока
     * @returns {boolean} true если игрок был удален, false если не найден
     */
    removePlayer(userId) {
        const playerIndex = this.findPlayerIndex(userId);
        
        if (playerIndex === -1) {
            if (window.appLogger) {
                window.appLogger.warn('Попытка удалить несуществующего игрока', { userId });
            }
            return false;
        }
        
        // Удаляем игрока
        const player = this.playersList[playerIndex];
        this.playersList.splice(playerIndex, 1);
        
        if (window.appLogger) {
            window.appLogger.info('Игрок удален из списка', { 
                userId, 
                username: player.getPlayerObject().username,
                remainingPlayers: this.playersList.length 
            });
        }
        
        return true;
    }

    /**
     * Обновляет состояние всех игроков
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    updatePlayers(timeLapse) {
        this.playersList.forEach(player => player.update(timeLapse));
    }

    /**
     * Подготавливает всех игроков к новой игре
     */
    preparePlayersForGame() {
        this.positionCounter = 0;
        
        this.playersList.forEach(player => {
            player.prepareForGame(this.positionCounter++);
        });
        
        if (window.appLogger) {
            window.appLogger.info('Все игроки подготовлены к игре', { 
                playersCount: this.playersList.length 
            });
        }
        
        return this.getPlayersData();
    }

    /**
     * Возвращает данные всех игроков
     * @returns {Array} Массив с данными игроков
     */
    getPlayersData() {
        return this.playersList.map(player => player.getPlayerObject());
    }

    /**
     * Возвращает данные только активных игроков
     * @returns {Array} Массив с данными активных игроков
     */
    getActivePlayers() {
        return this.playersList
            .filter(player => player.isActive())
            .map(player => player.getPlayerObject());
    }

    /**
     * Проверяет, есть ли еще живые игроки
     * @returns {boolean} true если есть активные игроки
     */
    hasActivePlayers() {
        return this.playersList.some(player => player.isActive());
    }

    /**
     * Очищает список игроков
     */
    clearAllPlayers() {
        this.playersList = [];
        this.positionCounter = 0;
        
        if (window.appLogger) {
            window.appLogger.info('Список игроков очищен');
        }
    }
    
    /**
     * Инициализирует игроков из данных комнаты
     * @param {Array} playersData - Массив данных игроков из комнаты
     */
    initPlayersFromRoomData(playersData) {
        // Очищаем текущий список
        this.clearAllPlayers();
        
        // Добавляем игроков из данных комнаты
        if (Array.isArray(playersData) && playersData.length > 0) {
            playersData.forEach(playerData => {
                this.addPlayer(
                    playerData.userId, 
                    playerData.username, 
                    playerData.skin, 
                    playerData.photoUrl
                );
            });
            
            if (window.appLogger) {
                window.appLogger.info('Игроки инициализированы из данных комнаты', { 
                    playersCount: this.playersList.length 
                });
            }
        }
    }
}

// Экспортируем класс в глобальное пространство имен
window.PlayerManager = PlayerManager; 