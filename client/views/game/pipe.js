/**
 * Класс Pipe - управляет препятствиями в игре
 * Адаптирован для работы на клиентской стороне
 */
class Pipe {
    /**
     * Создает новую трубу
     * @param {number} lastPipePosX - X-координата последней созданной трубы
     */
    constructor(lastPipePosX) {
        const { GameParams } = window.GameConstants;
        
        this._pipeObject = {
            id: Date.now(),
            posX: lastPipePosX + GameParams.DISTANCE_BETWEEN_PIPES,
            posY: Math.floor(Math.random() * (GameParams.MAX_PIPE_HEIGHT - GameParams.MIN_PIPE_HEIGHT + 1) + GameParams.MIN_PIPE_HEIGHT),
            scored: false
        };
        
        // Логируем создание новой трубы
        if (window.appLogger) {
            window.appLogger.debug('Создана новая труба', {
                id: this._pipeObject.id,
                posX: this._pipeObject.posX,
                posY: this._pipeObject.posY
            });
        }
    }

    /**
     * Обновляет позицию трубы
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    update(timeLapse) {
        const { GameParams } = window.GameConstants;
        this._pipeObject.posX -= Math.floor(timeLapse * GameParams.LEVEL_SPEED);
    }

    /**
     * Проверяет, вышла ли труба за пределы экрана
     * @returns {boolean}
     */
    canBeDropped() {
        const { GameParams } = window.GameConstants;
        return this._pipeObject.posX + GameParams.PIPE_WIDTH < 0;
    }

    /**
     * Возвращает данные трубы
     * @returns {Object}
     */
    getPipeObject() {
        return this._pipeObject;
    }
    
    /**
     * Устанавливает флаг, что труба была пройдена игроком
     */
    markAsScored() {
        this._pipeObject.scored = true;
    }
    
    /**
     * Проверяет, была ли труба уже пройдена
     * @returns {boolean}
     */
    isScored() {
        return this._pipeObject.scored;
    }
}

// Экспортируем класс в глобальное пространство имен
window.Pipe = Pipe; 