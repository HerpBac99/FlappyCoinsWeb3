/**
 * Модуль трубы - препятствия в игре
 * Управляет позицией, движением и состоянием одной трубы
 */

class Pipe {
    /**
     * Создает новую трубу
     * @param {number} lastPipePosX - X-координата последней созданной трубы
     * @param {Object} gameConfig - Конфигурация игры с константами
     */
    constructor(lastPipePosX, gameConfig) {
        this.config = gameConfig;
        
        // Для вертикальной ориентации увеличиваем расстояние между трубами
        const distanceBetweenPipes = this.config.DISTANCE_BETWEEN_PIPES;
        
        // Создаем объект данных трубы
        this._pipeData = {
            id: Date.now(), // Уникальный ID трубы на основе времени
            posX: lastPipePosX + distanceBetweenPipes,
            // Генерируем случайную высоту в диапазоне MIN_PIPE_HEIGHT-MAX_PIPE_HEIGHT
            posY: Math.floor(
                Math.random() * 
                (this.config.MAX_PIPE_HEIGHT - this.config.MIN_PIPE_HEIGHT + 1) + 
                this.config.MIN_PIPE_HEIGHT
            ),
            scored: false // Флаг, прошел ли игрок через эту трубу
        };
    }

    /**
     * Обновляет позицию трубы
     * @param {number} timeLapse - Время, прошедшее с последнего обновления
     */
    update(timeLapse) {
        // Двигаем трубу влево на основе прошедшего времени и скорости игры
        this._pipeData.posX -= Math.floor(timeLapse * this.config.LEVEL_SPEED);
    }

    /**
     * Проверяет, вышла ли труба за пределы экрана
     * @returns {boolean} true если трубу можно удалить
     */
    canBeDropped() {
        return this._pipeData.posX + this.config.PIPE_WIDTH < 0;
    }

    /**
     * Возвращает данные трубы
     * @returns {Object} Объект с данными о трубе
     */
    getPipeData() {
        return { ...this._pipeData };
    }
    
    /**
     * Отмечает трубу как пройденную игроком для начисления очков
     */
    markAsScored() {
        this._pipeData.scored = true;
    }
    
    /**
     * Проверяет, отмечена ли труба как пройденная
     * @returns {boolean}
     */
    isScored() {
        return this._pipeData.scored;
    }
    
    /**
     * Получает ID трубы
     * @returns {number}
     */
    getId() {
        return this._pipeData.id;
    }
}

module.exports = Pipe; 