/**
 * Класс PipeManager - управляет трубами в игре
 * Отвечает за создание, обновление и удаление труб
 * Адаптирован для работы на клиентской стороне
 */
class PipeManager {
    /**
     * Создает экземпляр менеджера труб
     */
    constructor() {
        this.pipeList = [];
        
        if (window.appLogger) {
            window.appLogger.info('PipeManager инициализирован');
        }
    }

    /**
     * Создает новую трубу и добавляет её в список
     * @returns {Pipe} Созданная труба
     */
    createNewPipe() {
        try {
            const { GameParams } = window.GameConstants;
            
            const lastPos = this.pipeList.length > 0 
                ? this.pipeList[this.pipeList.length - 1].getPipeObject().posX
                : GameParams.SCREEN_WIDTH;

            const newPipe = new window.Pipe(lastPos);
            this.pipeList.push(newPipe);
            
            if (window.appLogger) {
                window.appLogger.debug('Создана новая труба', { 
                    id: newPipe.getPipeObject().id,
                    posX: newPipe.getPipeObject().posX
                });
            }

            return newPipe;
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при создании новой трубы', { error: error.message });
            }
            console.error('Ошибка при создании новой трубы:', error);
            throw error;
        }
    }

    /**
     * Обновляет состояние всех труб
     * @param {number} time - Прошедшее время для расчета движения
     */
    updatePipes(time) {
        try {
            // Удаляем трубы, вышедшие за пределы экрана
            if (this.pipeList.length > 0 && this.pipeList[0].canBeDropped()) {
                const removedPipe = this.pipeList.shift();
                if (window.appLogger) {
                    window.appLogger.debug('Труба удалена', {
                        id: removedPipe.getPipeObject().id
                    });
                }
            }

            // Обновляем позиции всех оставшихся труб
            this.pipeList.forEach(pipe => pipe.update(time));

            // Проверяем необходимость создания новой трубы
            if (this.shouldCreateNewPipe()) {
                this.createNewPipe();
            }
        } catch (error) {
            if (window.appLogger) {
                window.appLogger.error('Ошибка при обновлении труб', { error: error.message });
            }
            console.error('Ошибка при обновлении труб:', error);
        }
    }

    /**
     * Проверяет, нужно ли создать новую трубу
     * @returns {boolean} true если нужно создать новую трубу
     */
    shouldCreateNewPipe() {
        const { GameParams } = window.GameConstants;
        
        return this.pipeList.length > 0 && 
            this.pipeList[this.pipeList.length - 1].getPipeObject().posX < GameParams.SCREEN_WIDTH * 0.7;
    }

    /**
     * Возвращает список всех активных труб для отрисовки
     * @returns {Array} Массив объектов труб
     */
    getPipeList() {
        return this.pipeList.map(pipe => pipe.getPipeObject());
    }

    /**
     * Возвращает список труб для проверки столкновений
     * @returns {Array} Массив труб для проверки столкновений
     */
    getPotentialPipeHit() {
        const MAX_PIPE_CHECK_COLLISION = 3;
        
        const numPipes = Math.min(
            this.pipeList.length, 
            MAX_PIPE_CHECK_COLLISION
        );

        return this.pipeList
            .slice(0, numPipes)
            .map(pipe => pipe.getPipeObject());
    }

    /**
     * Очищает список труб
     */
    flushPipeList() {
        this.pipeList = [];
        if (window.appLogger) {
            window.appLogger.debug('Список труб очищен');
        }
    }
}

// Экспортируем класс в глобальное пространство имен
window.PipeManager = PipeManager; 