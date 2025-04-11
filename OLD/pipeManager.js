/**
 * Модуль управления трубами в игре
 * Отвечает за создание, обновление и удаление труб
 * @module PipeManager
 */

const EventEmitter = require('events');
const Pipe = require('./pipe');
const { constant: Const } = require('../sharedConstants');
const logger = require('../utils/logger')('PipeManager');

// Константы для управления трубами
const PIPE_CONFIG = {
  FIRST_PIPE_POS_X: Const.SCREEN_WIDTH,
  SPAWN_PIPE_ALERT: Const.SCREEN_WIDTH,
  MAX_PIPE_CHECK_COLLISION: 3
};

/**
 * Класс для управления трубами в игре
 * @class PipeManager
 * @extends EventEmitter
 */
class PipeManager extends EventEmitter {
  /**
   * Создает экземпляр менеджера труб
   */
  constructor() {
    super();
    /*
    убираем лишние логи
    console.log('PipeManager initialized');
    console.log('Methods:', Object.keys(this));
    */
    this.pipeList = [];
    this.socket = null;
    
    // Явно добавляем методы
    this.createNewPipe = this.createNewPipe.bind(this);
    this.updatePipes = this.updatePipes.bind(this);
    this.shouldCreateNewPipe = this.shouldCreateNewPipe.bind(this);
    this.getPipeList = this.getPipeList.bind(this);
    this.getPotentialPipeHit = this.getPotentialPipeHit.bind(this);
    this.flushPipeList = this.flushPipeList.bind(this);
  }

  /**
   * Устанавливает сокет для коммуникации с клиентами
   * @param {Socket} socket - Сокет для отправки данных
   */
  setSocket(socket) {
    this.socket = socket;
  }

  /**
   * Создает новую трубу и добавляет её в список
   * @returns {Pipe} Созданная труба
   */
  createNewPipe() {
    try {
      const lastPos = this.pipeList.length > 0 
        ? this.pipeList[this.pipeList.length - 1].getPipeObject().posX
        : PIPE_CONFIG.FIRST_PIPE_POS_X;

      const newPipe = new Pipe(lastPos);
      this.pipeList.push(newPipe);
      logger.debug('createNewPipe', 'New pipe created', { 
        id: newPipe.getPipeObject().id,
        posX: newPipe.getPipeObject().posX
      });

      return newPipe;
    } catch (error) {
      logger.error('createNewPipe', 'Failed to create new pipe', error);
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
      if (this.pipeList[0]?.canBeDropped()) {
        const removedPipe = this.pipeList.shift();
        logger.debug('updatePipes', 'Pipe removed', {
          id: removedPipe.getPipeObject().id
        });
      }

      // Обновляем позиции всех оставшихся труб
      this.pipeList.forEach(pipe => pipe.update(time));

      // Проверяем необходимость создания новой трубы
      if (this.shouldCreateNewPipe()) {
        this.emit('need_new_pipe');
      }
    } catch (error) {
      logger.error('updatePipes', 'Error updating pipes', error);
      throw error;
    }
  }

  /**
   * Проверяет, нужно ли создать новую трубу
   * @returns {boolean} true если нужно создать новую трубу
   */
  shouldCreateNewPipe() {
    return this.pipeList.length > 0 && 
      this.pipeList[this.pipeList.length - 1].getPipeObject().posX < PIPE_CONFIG.SPAWN_PIPE_ALERT;
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
    const numPipes = Math.min(
      this.pipeList.length, 
      PIPE_CONFIG.MAX_PIPE_CHECK_COLLISION
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
    logger.debug('flushPipeList', 'Pipe list cleared');
  }
}

module.exports = PipeManager;