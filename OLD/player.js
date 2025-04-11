/**
 * Класс игрока
 * Управляет состоянием, позицией и характеристиками игрока
 * @module Player
 */

const { ServerState, PlayerState } = require('./enums');
const { constant: Const } = require('../sharedConstants');
const logger = require('../utils/logger')('Player');

// Константы
const MAX_BIRDS_IN_A_ROW = 1;
const START_BIRD_POS_X = 50;
const SPACE_BETWEEN_BIRDS_X = 120;
const START_BIRD_POS_Y = 100;
const SPACE_BETWEEN_BIRDS_Y = 50;
const GRAVITY_SPEED = 0.05;
const JUMP_SPEED = -0.6;
const MAX_ROTATION = -10;
const MIN_ROTATION = 60;
const ROTATION_SPEED = 8;

class Player {
  /**
   * Создает нового игрока
   * @param {Socket} socket - Сокет подключения игрока
   * @param {string} uid - Уникальный идентификатор игрока
   * @param {number} color - Цвет игрока
   * @param {string} [nickname=''] - Никнейм игрока
   */
  constructor(socket, uid, color, nickname = '') {
    this._socket = socket;
    this._speedY = 0;
    this._rank = 1;
    this._lastPipe = 0;
    this._playerTinyObject = {
      id: uid,
      nick: nickname,
      color: color,
      rotation: 0,
      score: 0,
      best_score: 0,
      state: PlayerState.OnLoginScreen,
      posX: 0,
      posY: 0
    };

    if (nickname && nickname.trim() !== '') {
      this._playerTinyObject.state = PlayerState.WaitingInLobby;
    }

    logger.functionCall('constructor', { uid, color, nickname });
  }

  /**
   * Обновляет состояние игрока
   * @param {number} timeLapse - Время, прошедшее с последнего обновления
   */
  update(timeLapse) {
    try {
      switch (this._playerTinyObject.state) {
        case PlayerState.Playing:
          this._updatePlayingState(timeLapse);
          break;
        case PlayerState.Died:
          this._updateDiedState(timeLapse);
          break;
        default:
          break;
      }
    } catch (error) {
      logger.error('update', 'Error updating player state', error);
    }
  }

  /**
   * Обновляет состояние игрока в режиме игры
   * @param {number} timeLapse - Время, прошедшее с последнего обновления
   */
  _updatePlayingState(timeLapse) {
    this._speedY += GRAVITY_SPEED;
    this._playerTinyObject.posY += Math.round(timeLapse * this._speedY);
    
    this._playerTinyObject.rotation += Math.round(this._speedY * ROTATION_SPEED);
    this._playerTinyObject.rotation = Math.min(
      this._playerTinyObject.rotation,
      MIN_ROTATION
    );
  }

  /**
   * Обновляет состояние игрока после смерти
   * @param {number} timeLapse - Время, прошедшее с последнего обновления
   */
  _updateDiedState(timeLapse) {
    this._playerTinyObject.posX -= Math.floor(timeLapse * Const.LEVEL_SPEED);
  }

  /**
   * Выполняет прыжок игрока
   */
  jump() {
    this._speedY = JUMP_SPEED;
    this._playerTinyObject.rotation = MAX_ROTATION;
    logger.debug('jump', 'Player performed jump');
  }

  /**
   * Устанавливает никнейм игрока
   * @param {string} nick - Новый никнейм
   */
  setNick(nick) {
    // Валидация никнейма: если пустой, генерируем временный
    if (!nick || nick.trim() === '') {
      nick = 'Player_' + Math.floor(Math.random() * 10000);
      logger.warn('setNick', `Empty nickname received. Generated random nickname: ${nick}`);
    }
    
    this._playerTinyObject.nick = nick;
    logger.info('setNick', `Player nickname set to: ${nick}`);
  }

  /**
   * Устанавливает состояние "мертв" для игрока
   * @param {number} nbPlayersLeft - Количество оставшихся игроков
   */
  sorryYouAreDie(nbPlayersLeft) {
    if (this._playerTinyObject.state !== PlayerState.Died) {
      this._rank = nbPlayersLeft;
      this._playerTinyObject.state = PlayerState.Died;
      logger.info('sorryYouAreDie', `Player ${this._playerTinyObject.nick} died. Rank: ${this._rank}`);
    }
  }

  /**
   * Подготавливает игрока к новой игре
   * @param {number} pos - Позиция на стартовой сетке
   */
  preparePlayer(pos) {
    const line = Math.floor(pos / MAX_BIRDS_IN_A_ROW);
    const col = Math.floor(pos % MAX_BIRDS_IN_A_ROW);
    const randomMoveX = Math.floor(Math.random() * (SPACE_BETWEEN_BIRDS_X / 2 + 1));

    this._playerTinyObject.posY = START_BIRD_POS_Y + line * SPACE_BETWEEN_BIRDS_Y;
    this._playerTinyObject.posX = START_BIRD_POS_X + col * SPACE_BETWEEN_BIRDS_X + randomMoveX;

    this._speedY = 0;
    this._rank = 0;
    this._playerTinyObject.score = 0;
    this._playerTinyObject.rotation = 0;

    if (this._playerTinyObject.nick !== '') {
      this._playerTinyObject.state = PlayerState.WaitingInLobby;
      logger.debug('preparePlayer', 'Player state set to WaitingInLobby');
    }

    logger.debug('preparePlayer', 'Player prepared for new game', {
      pos,
      state: this._playerTinyObject.state
    });
  }

  /**
   * Обновляет счет игрока
   * @param {number} pipeID - ID текущей трубы
   */
  updateScore(pipeID) {
    if (pipeID !== this._lastPipe) {
      this._playerTinyObject.score++;
      this._lastPipe = pipeID;
      logger.debug('updateScore', `Player score updated to: ${this._playerTinyObject.score}`);
    }
  }

  /**
   * Отправляет игроку его счет и таблицу рекордов
   * @param {number} NBPlayers - Количество игроков
   * @param {Array} HighScores - Таблица рекордов
   */
  sendScore(NBPlayers, HighScores) {
    if (this._playerTinyObject.score > this._playerTinyObject.best_score) {
      this._playerTinyObject.best_score = this._playerTinyObject.score;
    }

    this._socket.emit('ranking', {
      score: this._playerTinyObject.score,
      bestScore: this._playerTinyObject.best_score,
      rank: this._rank,
      nbPlayers: NBPlayers,
      highscores: HighScores
    });

    logger.debug('sendScore', 'Score sent to player', {
      score: this._playerTinyObject.score,
      bestScore: this._playerTinyObject.best_score
    });
  }

  // Геттеры
  getNick() { return this._playerTinyObject.nick; }
  getID() { return this._playerTinyObject.id; }
  getState() { return this._playerTinyObject.state; }
  getScore() { return this._playerTinyObject.score; }
  getHighScore() { return this._playerTinyObject.best_score; }
  getPlayerObject() { return this._playerTinyObject; }
  isReadyToPlay() { return this._playerTinyObject.state === PlayerState.Playing; }

  /**
   * Устанавливает состояние готовности игрока
   * @param {boolean} readyState - Состояние готовности
   */
  setReadyState(readyState) {
    this._playerTinyObject.state = readyState 
      ? PlayerState.Playing 
      : PlayerState.WaitingInLobby;
    logger.info('setReadyState', `Player ${this._playerTinyObject.nick} is ${readyState ? 'ready' : 'not ready'}`);
  }

  /**
   * Устанавливает лучший счет игрока
   * @param {number} score - Новый лучший счет
   */
  setBestScore(score) {
    this._playerTinyObject.best_score = score;
    logger.info('setBestScore', `Player ${this._playerTinyObject.nick} new best score: ${score}`);
  }
}

module.exports = Player;