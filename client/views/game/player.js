/**
 * Класс Player - управляет состоянием и поведением игрока
 * Адаптирован для работы на клиентской стороне
 */
class Player {
    /**
     * Создает нового игрока
     * @param {string} userId - Уникальный идентификатор игрока
     * @param {string} username - Имя пользователя
     * @param {string} skin - Скин монеты (птицы)
     * @param {string} photoUrl - URL фото игрока
     */
    constructor(userId, username, skin = 'bitcoin', photoUrl = null) {
        const { PlayerState, GameParams } = window.GameConstants;
        
        this._speedY = 0;
        this._rank = 1;
        this._lastPipe = 0;
        this._playerObject = {
            userId: userId,
            username: username,
            skin: skin,
            photoUrl: photoUrl,
            rotation: 0,
            score: 0,
            bestScore: 0,
            state: PlayerState.WAITING,
            posX: 0,
            posY: 0
        };
        
        if (window.appLogger) {
            window.appLogger.info('Создан новый игрок', {
                userId,
                username,
                skin
            });
        }
    }

    /**
     * Обновляет состояние игрока
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    update(timeLapse) {
        const { PlayerState, GameParams } = window.GameConstants;
        
        try {
            switch (this._playerObject.state) {
                case PlayerState.PLAYING:
                    this._updatePlayingState(timeLapse);
                    break;
                case PlayerState.DIED:
                    this._updateDiedState(timeLapse);
                    break;
                default:
                    break;
            }
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при обновлении состояния игрока', { error: error.message });
            }
            console.error('Ошибка при обновлении состояния игрока:', error);
        }
    }

    /**
     * Обновляет состояние игрока в режиме игры
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    _updatePlayingState(timeLapse) {
        const { GameParams } = window.GameConstants;
        
        this._speedY += GameParams.GRAVITY_SPEED;
        this._playerObject.posY += Math.round(timeLapse * this._speedY);
        
        this._playerObject.rotation += Math.round(this._speedY * GameParams.ROTATION_SPEED);
        this._playerObject.rotation = Math.min(
            this._playerObject.rotation,
            GameParams.MIN_ROTATION
        );
    }

    /**
     * Обновляет состояние игрока после смерти
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    _updateDiedState(timeLapse) {
        const { GameParams } = window.GameConstants;
        this._playerObject.posX -= Math.floor(timeLapse * GameParams.LEVEL_SPEED);
    }

    /**
     * Выполняет прыжок игрока
     */
    jump() {
        const { GameParams } = window.GameConstants;
        
        this._speedY = GameParams.JUMP_SPEED;
        this._playerObject.rotation = GameParams.MAX_ROTATION;
        
        if (window.appLogger) {
            window.appLogger.debug('Игрок выполнил прыжок', {
                userId: this._playerObject.userId,
                username: this._playerObject.username
            });
        }
    }

    /**
     * Устанавливает состояние "мертв" для игрока
     * @param {number} playersLeft - Количество оставшихся игроков
     */
    die(playersLeft) {
        const { PlayerState } = window.GameConstants;
        
        if (this._playerObject.state !== PlayerState.DIED) {
            this._rank = playersLeft;
            this._playerObject.state = PlayerState.DIED;
            
            if (window.appLogger) {
                window.appLogger.info('Игрок погиб', {
                    userId: this._playerObject.userId,
                    username: this._playerObject.username,
                    rank: this._rank,
                    score: this._playerObject.score
                });
            }
        }
    }

    /**
     * Подготавливает игрока к новой игре
     * @param {number} pos - Позиция на стартовой сетке
     */
    prepareForGame(pos) {
        const { PlayerState, GameParams } = window.GameConstants;
        
        const line = Math.floor(pos / 1); // MAX_BIRDS_IN_A_ROW = 1
        
        // Устанавливаем начальную позицию
        this._playerObject.posY = GameParams.START_BIRD_POS_Y + line * GameParams.SPACE_BETWEEN_BIRDS_Y;
        this._playerObject.posX = GameParams.START_BIRD_POS_X;

        // Сбрасываем физические параметры
        this._speedY = 0;
        this._rank = 0;
        this._playerObject.score = 0;
        this._playerObject.rotation = 0;
        this._playerObject.state = PlayerState.PLAYING;
        
        if (window.appLogger) {
            window.appLogger.debug('Игрок подготовлен к игре', {
                userId: this._playerObject.userId,
                username: this._playerObject.username,
                position: pos,
                posX: this._playerObject.posX,
                posY: this._playerObject.posY
            });
        }
    }

    /**
     * Обновляет счет игрока
     * @param {number} pipeId - ID пройденной трубы
     */
    updateScore(pipeId) {
        if (pipeId !== this._lastPipe) {
            this._playerObject.score++;
            this._lastPipe = pipeId;
            
            // Обновляем лучший счет, если текущий выше
            if (this._playerObject.score > this._playerObject.bestScore) {
                this._playerObject.bestScore = this._playerObject.score;
            }
            
            if (window.appLogger) {
                window.appLogger.debug('Обновлен счет игрока', {
                    userId: this._playerObject.userId,
                    username: this._playerObject.username,
                    score: this._playerObject.score,
                    bestScore: this._playerObject.bestScore
                });
            }
        }
    }

    /**
     * Возвращает данные игрока
     * @returns {Object} Объект с данными игрока
     */
    getPlayerObject() {
        return this._playerObject;
    }

    /**
     * Проверяет, активен ли игрок
     * @returns {boolean} true если игрок активен в игре
     */
    isActive() {
        const { PlayerState } = window.GameConstants;
        return this._playerObject.state === PlayerState.PLAYING;
    }

    /**
     * Проверяет, мертв ли игрок
     * @returns {boolean} true если игрок погиб
     */
    isDead() {
        const { PlayerState } = window.GameConstants;
        return this._playerObject.state === PlayerState.DIED;
    }

    /**
     * Устанавливает лучший счет игрока
     * @param {number} score - Новый лучший счет
     */
    setBestScore(score) {
        this._playerObject.bestScore = score;
    }
}

// Экспортируем класс в глобальное пространство имен
window.Player = Player; 