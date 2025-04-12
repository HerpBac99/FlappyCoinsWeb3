/**
 * Модуль управления трубами в игре
 * Отвечает за создание, обновление и удаление труб
 * @module PipeManager
 */

const EventEmitter = require('events');
const Pipe = require('./pipe');

class PipeManager extends EventEmitter {
    /**
     * Создает экземпляр менеджера труб
     * @param {Object} gameConfig - Конфигурация игры с константами
     */
    constructor(gameConfig) {
        super();
        this.config = gameConfig;
        this.pipeList = [];
        
        // Константы для управления трубами
        this.PIPE_CONFIG = {
            FIRST_PIPE_POS_X: this.config.SCREEN_WIDTH, // Начальная позиция первой трубы
            SPAWN_PIPE_ALERT: this.config.SCREEN_WIDTH * 0.6, // Порог для создания новой трубы
            MAX_PIPE_CHECK_COLLISION: 3 // Максимальное количество труб для проверки столкновений
        };
        
        // Привязываем методы к объекту для использования в колбэках
        this.createNewPipe = this.createNewPipe.bind(this);
        this.updatePipes = this.updatePipes.bind(this);
        this.shouldCreateNewPipe = this.shouldCreateNewPipe.bind(this);
        this.getPipeList = this.getPipeList.bind(this);
        this.getPotentialPipeHit = this.getPotentialPipeHit.bind(this);
        this.flushPipeList = this.flushPipeList.bind(this);
    }

    /**
     * Создает новую трубу и добавляет её в список
     * @returns {Pipe} Созданная труба
     */
    createNewPipe() {
        try {
            // Определяем позицию последней трубы или используем значение по умолчанию
            const lastPos = this.pipeList.length > 0 
                ? this.pipeList[this.pipeList.length - 1].getPipeData().posX
                : this.PIPE_CONFIG.FIRST_PIPE_POS_X;

            // Создаем новую трубу
            const newPipe = new Pipe(lastPos, this.config);
            this.pipeList.push(newPipe);
            
            return newPipe;
        } catch (error) {
            console.error('createNewPipe: Ошибка при создании новой трубы', error);
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
                this.pipeList.shift();
            }

            // Обновляем позиции всех оставшихся труб
            this.pipeList.forEach(pipe => pipe.update(time));

            // Проверяем необходимость создания новой трубы
            if (this.shouldCreateNewPipe()) {
                this.emit('need_new_pipe');
            }
        } catch (error) {
            console.error('updatePipes: Ошибка обновления труб', error);
            throw error;
        }
    }

    /**
     * Проверяет, нужно ли создать новую трубу
     * @returns {boolean} true если нужно создать новую трубу
     */
    shouldCreateNewPipe() {
        return this.pipeList.length > 0 && 
            this.pipeList[this.pipeList.length - 1].getPipeData().posX < this.PIPE_CONFIG.SPAWN_PIPE_ALERT;
    }

    /**
     * Возвращает список всех активных труб для отрисовки
     * @returns {Array} Массив объектов труб
     */
    getPipeList() {
        return this.pipeList.map(pipe => pipe.getPipeData());
    }

    /**
     * Возвращает список труб для проверки столкновений
     * @returns {Array} Массив труб для проверки столкновений
     */
    getPotentialPipeHit() {
        const numPipes = Math.min(
            this.pipeList.length, 
            this.PIPE_CONFIG.MAX_PIPE_CHECK_COLLISION
        );

        return this.pipeList
            .slice(0, numPipes)
            .map(pipe => pipe.getPipeData());
    }

    /**
     * Очищает список труб
     */
    flushPipeList() {
        this.pipeList = [];
    }
}

module.exports = PipeManager; 