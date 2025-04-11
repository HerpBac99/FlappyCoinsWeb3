/**
 * Модуль управления игроками
 * Отвечает за создание, удаление и обновление игроков
 * Управляет состояниями игроков, их счетом и синхронизацией
 * @module PlayersManager
 */

const { EventEmitter } = require('events');
const { PlayerState, ServerState } = require('./enums');
const Player = require('./player');
const ScoreSystem = require('./scoreSystem');
const createLogger = require('../utils/logger');

// Создаем переменную логгера на уровне модуля
let logger;

// Константы
const NB_AVAILABLE_BIRDS_COLOR = 4;

class PlayersManager extends EventEmitter {
  constructor() {
    super();
    this.playersList = [];
    this.posOnGrid = 0;
    this.scores = new ScoreSystem();

    // Создаем логгер для PlayerManager
    logger = createLogger('PlayersManager');
    
    // Подписываемся на событие готовности всех игроков
    this.on('players-ready', () => {
      logger.info('onPlayersReady', 'All players are ready to play');
      
      // Проверяем, что игроков достаточно для начала игры
      if (this.playersList.length >= 1) {
        logger.info('onPlayersReady', `Starting game with ${this.playersList.length} players`);
        
        // Сообщаем серверу о готовности всех игроков
        global.io.sockets.emit('all_ready_confirmed');
        
        // Запускаем таймер для начала игры
        setTimeout(() => {
          // Если игра все еще в режиме ожидания, запускаем ее
          if (global._gameState === ServerState.WaitingForPlayers) {
            logger.info('onPlayersReady', 'Starting game after countdown');
            global.startGameLoop();
          }
        }, 5000); // Ждем 5 секунд после подтверждения готовности
      } else {
        logger.info('onPlayersReady', `Not enough players to start (${this.playersList.length}/2)`);
      }
    });
  }

  /**
   * Создает нового игрока и добавляет его в список
   * @param {Socket} playerSocket - Сокет подключившегося игрока
   * @param {string} id - Уникальный идентификатор игрока
   * @param {string} [nickname=''] - Никнейм игрока (опционально)
   * @returns {Player} Созданный игрок
   * @throws {Error} Если не удалось создать игрока
   */
  addNewPlayer(playerSocket, id, nickname = '') {
    try {
      console.log(`[DEBUG] Adding new player with socket ID: ${id}, nickname: "${nickname}", socket data:`, playerSocket.data);
      
      const birdColor = Math.floor(Math.random() * NB_AVAILABLE_BIRDS_COLOR);
      const newPlayer = new Player(playerSocket, id, birdColor, nickname);
      
      console.log(`[DEBUG] New player created with ID: ${id}, nickname: "${newPlayer.getNick()}", state: ${newPlayer.getState()}`);
      
      this.playersList.push(newPlayer);
      logger.info('addNewPlayer', `New player connected. Current players: ${this.playersList.length}`);
      
      return newPlayer;
    } catch (error) {
      logger.error('addNewPlayer', 'Failed to add new player', error);
      throw new Error('Player creation failed');
    }
  }

  /**
   * Удаляет игрока из списка при отключении
   * @param {Player} player - Игрок для удаления
   */
  removePlayer(player) {
    const playerIndex = this.playersList.indexOf(player);
    
    if (playerIndex === -1) {
      logger.error('removePlayer', `Player not found in playerList: ${player.getNick()}`);
      return;
    }

    this.playersList.splice(playerIndex, 1);
    logger.info('removePlayer', `Player removed. Remaining players: ${this.playersList.length}`);
  }

  /**
   * Обновляет состояние готовности игрока и проверяет готовность всех игроков
   * @param {Player} player - Игрок, изменивший состояние
   * @param {boolean} isReady - Новое состояние готовности
   */
  changeLobbyState(player, isReady) {
    const playerIndex = this.playersList.indexOf(player);
    
    if (playerIndex === -1) {
      logger.error('changeLobbyState', `Player not found: ${player.getNick()}`);
      return;
    }

    this.playersList[playerIndex].setReadyState(isReady);
    logger.info('changeLobbyState', `Player ${player.getNick()} set to ${isReady ? 'ready' : 'not ready'}`);

    // Подробно логируем состояние каждого игрока после изменения
    this.playersList.forEach((p, index) => {
      logger.debug('changeLobbyState', 
        `Player[${index}]: ${p.getNick()}, state=${p.getState() === PlayerState.Playing ? 'ready' : 'not ready'}`
      );
    });

    // Проверяем готовность всех игроков
    // Требуется как минимум 1 игрок, и все игроки должны быть в состоянии Playing
    if (this.playersList.length > 0) {
      const allReady = this.playersList.every(p => p.getState() === PlayerState.Playing);
      
      logger.info('changeLobbyState', 
        `All players ready check: ${allReady} (${this.playersList.length} players total)`
      );
      
      if (allReady) {
        logger.info('changeLobbyState', 'Emitting players-ready event');
        this.emit('players-ready');
      }
    }
  }

  /**
   * Возвращает список игроков, опционально фильтруя по состоянию
   * @param {PlayerState} [specificState] - Состояние для фильтрации игроков
   * @returns {Array} Массив игроков или их данных
   */
  getPlayerList(specificState) {
    //console.log(`[DEBUG] getPlayerList called with specificState: ${specificState}`);
    
    // Логируем детальную информацию о каждом игроке в списке
    this.playersList.forEach((player, index) => {
      console.log(`[DEBUG] Player[${index}]: ID=${player.getID()}, nickname="${player.getNick()}", state=${player.getState()}`);
    });
    
    // Фильтруем и возвращаем игроков в соответствии с запросом
    const result = specificState 
      ? this.playersList.filter(p => p.getState() === specificState)
      : this.playersList.map(p => p.getPlayerObject());
    
    console.log(`[DEBUG] getPlayerList returning ${result.length} players`);
    return result;
  }

  /**
   * Возвращает список игроков, находящихся в игре или погибших
   * @returns {Array} Массив активных игроков
   */
  getOnGamePlayerList() {
    return this.playersList
      .filter(p => [PlayerState.Playing, PlayerState.Died].includes(p.getState()))
      .map(p => p.getPlayerObject());
  }

  /**
   * Возвращает текущее количество игроков
   * @returns {number} Количество игроков
   */
  getNumberOfPlayers() {
    return this.playersList.length;
  }

  /**
   * Обновляет состояние всех игроков
   * @param {number} time - Прошедшее время для расчета физики
   */
  updatePlayers(time) {
    this.playersList.forEach(player => player.update(time));
  }

  /**
   * Проверяет, остались ли живые игроки
   * @returns {boolean} true если есть хотя бы один живой игрок
   */
  arePlayersStillAlive() {
    return this.playersList.some(p => p.getState() === PlayerState.Playing);
  }

  /**
   * Сбрасывает состояние всех игроков для новой игры
   * @returns {Array} Массив обновленных данных игроков
   */
  resetPlayersForNewGame() {
    this.posOnGrid = 0;
    return this.playersList.map(player => {
      player.preparePlayer(this.posOnGrid++);
      return player.getPlayerObject();
    });
  }

  /**
   * Сохраняет и отправляет счет игроков
   * Обновляет таблицу рекордов
   */
  async sendPlayerScore() {
    try {
      // Сохраняем счет каждого игрока
      this.playersList.forEach(player => {
        this.scores.savePlayerScore(player, player.getScore());
      });

      // Получаем и отправляем таблицу рекордов
      const highScores = await this.scores.getHighScores();
      this.playersList.forEach(player => {
        player.sendScore(this.playersList.length, highScores);
      });
    } catch (error) {
      logger.error('sendPlayerScore', 'Failed to send player scores', error);
      throw error;
    }
  }

  /**
   * Подготавливает нового игрока к игре
   * @param {Player} player - Новый игрок
   * @param {string} nickname - Никнейм игрока
   */
  prepareNewPlayer(player, nickname) {
    console.log(`[DEBUG] prepareNewPlayer - Before: player ID=${player.getID()}, nickname="${player.getNick()}", state=${player.getState()}`);
    
    // Устанавливаем никнейм только если он отличается от текущего
    if (player.getNick() !== nickname) {
      console.log(`[DEBUG] prepareNewPlayer - Updating nickname from "${player.getNick()}" to "${nickname}"`);
      player.setNick(nickname);
    } else {
      console.log(`[DEBUG] prepareNewPlayer - Nickname already set to "${nickname}", no update needed`);
    }
    
    this.scores.setPlayerHighScore(player);
    console.log(`[DEBUG] prepareNewPlayer - After setPlayerHighScore: best_score=${player.getHighScore()}`);
    
    player.preparePlayer(this.posOnGrid++);
    console.log(`[DEBUG] prepareNewPlayer - After preparePlayer: state=${player.getState()}, position=${this.posOnGrid-1}`);
  }

  /**
   * Проверяет, все ли игроки готовы к игре
   * @returns {boolean} true если все игроки готовы
   */
  checkAllPlayersReady() {
    // Проверяем наличие игроков - минимум 1 игрок для начала игры
    if (this.playersList.length === 0) {
      logger.info('checkAllPlayersReady', 'No players in the list, cannot start the game');
      return false;
    }
    
    // Проверяем, все ли игроки готовы (в состоянии Playing)
    const allReady = this.playersList.every(p => p.getState() === PlayerState.Playing);
    
    logger.info('checkAllPlayersReady', 
      allReady 
        ? `All ${this.playersList.length} players are ready to play` 
        : `Not all players are ready (${this.playersList.length} total)`
    );
    
    return allReady;
  }
}

module.exports = PlayersManager;
