/**
 * Класс игрока
 * Управляет состоянием, позицией и характеристиками игрока
 * @module Player
 */

// Перечисления состояний игрока
const PlayerState = {
    WaitingInLobby: 1,  // Ожидание в лобби
    Playing: 2,         // Активная игра
    Died: 3             // Проиграл
};

// Константы физики
const GRAVITY_SPEED = 0.05;
const JUMP_SPEED = -0.6;
const MAX_ROTATION = -10;
const MIN_ROTATION = 60;
const ROTATION_SPEED = 8;

class Player {
    /**
     * Создает нового игрока
     * @param {Object} userData - Данные пользователя из Telegram
     * @param {Object} gameConfig - Конфигурация игры
     */
    constructor(userData, gameConfig) {
        this.userData = userData;
        this.config = gameConfig;
        this._speedY = 0;
        this._rank = 1;
        this._lastPipe = 0;
        
        // Создаем объект с данными игрока для отправки клиенту
        this._playerData = {
            id: userData.id,
            username: userData.username || 'Player',
            photoUrl: userData.photo_url || 'assets/default-avatar.png',
            rotation: 0,
            score: 0,
            bestScore: userData.bestScore || 0,
            skin: userData.skin || 'bitcoin',
            state: PlayerState.WaitingInLobby,
            posX: 0,
            posY: 0
        };
        
        // Инициализация позиции игрока в зависимости от ориентации игры
        this.resetPosition();
    }

    /**
     * Обновляет состояние игрока
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    update(timeLapse) {
        switch (this._playerData.state) {
            case PlayerState.Playing:
                this._updatePlayingState(timeLapse);
                break;
            case PlayerState.Died:
                this._updateDiedState(timeLapse);
                break;
            default:
                break;
        }
    }

    /**
     * Обновляет состояние игрока в режиме игры
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    _updatePlayingState(timeLapse) {
        this._speedY += GRAVITY_SPEED;
        this._playerData.posY += Math.round(timeLapse * this._speedY);
        
        this._playerData.rotation += Math.round(this._speedY * ROTATION_SPEED);
        this._playerData.rotation = Math.min(
            this._playerData.rotation,
            MIN_ROTATION
        );
    }

    /**
     * Обновляет состояние игрока после смерти
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    _updateDiedState(timeLapse) {
        this._playerData.posX -= Math.floor(timeLapse * this.config.LEVEL_SPEED);
    }

    /**
     * Выполняет прыжок игрока
     */
    jump() {
        this._speedY = JUMP_SPEED;
        this._playerData.rotation = MAX_ROTATION;
    }

    /**
     * Устанавливает состояние "мертв" для игрока
     * @param {number} nbPlayersLeft - Количество оставшихся игроков
     */
    die(nbPlayersLeft) {
        if (this._playerData.state !== PlayerState.Died) {
            this._rank = nbPlayersLeft;
            this._playerData.state = PlayerState.Died;
            console.log(`Игрок ${this._playerData.username} умер. Ранг: ${this._rank}`);
        }
    }

    /**
     * Подготавливает игрока к новой игре
     */
    resetPosition() {
        // Позиция по X зависит от ширины экрана (для вертикальной ориентации - по центру)
        this._playerData.posX = Math.floor(this.config.SCREEN_WIDTH / 3);
        
        // Позиция по Y - примерно на 1/3 высоты экрана
        this._playerData.posY = Math.floor(this.config.SCREEN_HEIGHT / 3);
        
        this._speedY = 0;
        this._rank = 0;
        this._playerData.score = 0;
        this._playerData.rotation = 0;
    }

    /**
     * Обновляет счет игрока
     * @param {number} pipeID - ID текущей трубы
     */
    updateScore(pipeID) {
        if (pipeID !== this._lastPipe) {
            this._playerData.score++;
            this._lastPipe = pipeID;
        }
    }

    /**
     * Отправляет игроку его счет и таблицу рекордов
     * @param {Object} socket - Сокет игрока
     * @param {number} totalPlayers - Количество игроков
     * @param {Array} highScores - Таблица рекордов
     */
    sendScore(socket, totalPlayers, highScores) {
        if (this._playerData.score > this._playerData.bestScore) {
            this._playerData.bestScore = this._playerData.score;
        }

        socket.emit('gameResults', {
            score: this._playerData.score,
            bestScore: this._playerData.bestScore,
            rank: this._rank,
            totalPlayers: totalPlayers,
            highscores: highScores
        });
    }

    // Геттеры
    getUserId() { return this._playerData.id; }
    getUsername() { return this._playerData.username; }
    getState() { return this._playerData.state; }
    getScore() { return this._playerData.score; }
    getBestScore() { return this._playerData.bestScore; }
    getPlayerData() { return { ...this._playerData }; }
    isPlaying() { return this._playerData.state === PlayerState.Playing; }
    isDead() { return this._playerData.state === PlayerState.Died; }

    /**
     * Устанавливает состояние готовности игрока
     * @param {boolean} isReady - Состояние готовности
     */
    setReadyState(isReady) {
        this._playerData.state = isReady 
            ? PlayerState.Playing 
            : PlayerState.WaitingInLobby;
    }
}

module.exports = {
    Player,
    PlayerState
}; 