/**
 * Модуль определения столкновений в игре
 * Отвечает за проверку столкновений птицы с трубами и землей
 * Использует константы из общего конфигурационного файла
 */
const { constant: Const } = require('../sharedConstants');
const createLogger = require('../utils/logger');

const logger = createLogger('CollisionEngine');

/**
 * Проверяет столкновение конкретной птицы с конкретной трубой
 * @param {Object} pipe - Объект трубы с координатами и размерами
 * @param {Object} birdInstance - Экземпляр игрока (птицы)
 * @returns {boolean} true если произошло столкновение, false если нет
 */
const checkBirdCollision = (pipe, birdInstance) => {
  const bird = birdInstance.getPlayerObject();
  
  const birdCenterX = bird.posX + (Const.BIRD_WIDTH / 2);
  const birdCenterY = bird.posY + (Const.BIRD_HEIGHT / 2);
  const pipeCenterX = pipe.posX + (Const.PIPE_WIDTH / 2);

  const horizontalCollision = (
    (bird.posX + Const.BIRD_WIDTH) > pipe.posX && 
    bird.posX < (pipe.posX + Const.PIPE_WIDTH)
  );

  if (horizontalCollision) {
    if (birdCenterX >= pipeCenterX && !pipe.scored) {
      birdInstance.updateScore(pipe.id);
      pipe.scored = true;
      logger.debug(`Score updated for player ${bird.nick}`);
    }

    if (!pipe.scored) {
      const upperCollision = bird.posY < pipe.posY;
      const lowerCollision = (bird.posY + Const.BIRD_HEIGHT) > (pipe.posY + Const.HEIGHT_BETWEEN_PIPES);

      if (upperCollision || lowerCollision) {
        logger.info(`Collision detected for player ${bird.nick}`);
        return true;
      }
    }
  }

  const groundCollision = bird.posY + Const.BIRD_HEIGHT > Const.FLOOR_POS_Y;
  if (groundCollision) {
    logger.info(`Ground collision for player ${bird.nick}`);
    return true;
  }

  return false;
};

/**
 * Проверяет столкновения всех активных птиц со всеми активными трубами
 * @param {Array} pipes - Массив труб
 * @param {Array} birdsList - Массив игроков
 * @returns {boolean}
 */
const checkCollision = (pipes, birdsList) => {
  let thereIsCollision = false;

  for (const pipe of pipes) {
    for (const bird of birdsList) {
      if (checkBirdCollision(pipe, bird)) {
        bird.sorryYouAreDie(birdsList.length);
        thereIsCollision = true;
      }
    }
  }

  return thereIsCollision;
};

module.exports = {
  checkCollision
};