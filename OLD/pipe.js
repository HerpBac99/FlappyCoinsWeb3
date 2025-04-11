/**
 * Модуль трубы - препятствия в игре
 * Управляет позицией, движением и состоянием одной трубы
 */

const { constant: Const } = require('../sharedConstants');

/**
 * Класс Pipe - управляет препятствиями в игре
 */
class Pipe {
  /**
   * Создает новую трубу
   * @param {number} lastPipePosX - X-координата последней созданной трубы
   */
  constructor(lastPipePosX) {
    this._pipeTinyObject = {
      id: Date.now(),
      posX: lastPipePosX + Const.DISTANCE_BETWEEN_PIPES,
      posY: Math.floor(Math.random() * (Const.MAX_PIPE_HEIGHT - Const.MIN_PIPE_HEIGHT + 1) + Const.MIN_PIPE_HEIGHT),
      scored: false
    };
  }

  /**
   * Обновляет позицию трубы
   * @param {number} timeLapse - Время, прошедшее с последнего обновления
   */
  update(timeLapse) {
    this._pipeTinyObject.posX -= Math.floor(timeLapse * Const.LEVEL_SPEED);
  }

  /**
   * Проверяет, вышла ли труба за пределы экрана
   * @returns {boolean}
   */
  canBeDropped() {
    return this._pipeTinyObject.posX + Const.PIPE_WIDTH < 0;
  }

  /**
   * Возвращает данные трубы
   * @returns {Object}
   */
  getPipeObject() {
    return this._pipeTinyObject;
  }
}

module.exports = Pipe;