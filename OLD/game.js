/**
 * Основной серверный модуль игры
 * Управляет игровым процессом, обрабатывает подключения игроков,
 * синхронизирует состояния и обеспечивает многопользовательский режим
 */

// Изменяем импорт
const enums = require('./enums');

// Импортируем необходимые модули
var PlayersManager    = require('./playersManager'),    // Управление игроками
    PipeManager       = require('./pipeManager'),       // Управление трубами
    CollisionEngine   = require('./collisionEngine'),   // Определение столкновений
    Const             = require('../sharedConstants').constant,  // Общие константы
    https             = require('https'),               // Для HTTPS сервера
    createLogger = require('../utils/logger');

const logger = createLogger('Game');

// Глобальные переменные модуля
var _playersManager,  // Менеджер игроков
    _pipeManager,     // Менеджер труб
    io,              // Объект Socket.IO для работы с сокетами
    _gameState,      // Текущее состояние игры
    _timeStartGame,  // Время начала текущей игры
    _lastTime = null,// Время последнего обновления для расчета deltaTime
    _timer;          // Таймер игрового цикла

// Система комнат
const _gameRooms = new Map(); // Хранит информацию о комнатах: Map<roomId, {players, status, etc}>
const MAX_PLAYERS_IN_ROOM = 10; // Максимальное количество игроков в комнате

/**
 * Создает новую игровую комнату
 * @param {Socket} socket - Сокет игрока, создающего комнату
 * @param {string} nickname - Никнейм игрока
 * @returns {string} ID созданной комнаты
 */
function createRoom(socket, nickname) {
  // Если игрок уже в комнате, сначала выходим из неё
  if (socket.data.roomId) {
    leaveRoom(socket);
  }
  
  // Генерируем уникальный ID комнаты
  const roomId = 'room_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  
  // Создаем новую комнату с начальными настройками
  const room = {
    id: roomId,
    players: [], // Список игроков в комнате
    status: 'waiting', // Статус комнаты: waiting, countdown, playing, finished
    createdAt: Date.now(),
    createdBy: socket.id,
    maxPlayers: MAX_PLAYERS_IN_ROOM
  };
  
  // Добавляем создателя комнаты в список игроков
  room.players.push({
    id: socket.id,
    nickname: nickname,
    isReady: false,
    isCreator: true
  });
  
  // Сохраняем комнату
  _gameRooms.set(roomId, room);
  
  // Отключаем от всех других комнат Socket.IO
  Object.keys(socket.rooms).forEach(roomId => {
    if (roomId !== socket.id) {
      socket.leave(roomId);
    }
  });
  
  // Присоединяем сокет к новой комнате Socket.IO
  socket.join(roomId);
  
  // Сохраняем ID комнаты в данных сокета
  socket.data.roomId = roomId;
  
  logger.info('createRoom', `New room created: ${roomId} by player ${nickname}`);
  
  return roomId;
}

/**
 * Обрабатывает присоединение игрока к комнате
 * @param {Socket} socket - Сокет клиента
 * @param {string} roomId - ID комнаты
 * @param {string} nickname - Никнейм игрока
 * @returns {boolean} Успешно ли игрок присоединился к комнате
 */
function joinRoom(socket, roomId, nickname) {
  if (!_gameRooms.has(roomId)) {
    logger.error('joinRoom', `Room ${roomId} not found`);
    return false;
  }
  
  const room = _gameRooms.get(roomId);
  
  // Проверяем, есть ли место в комнате
  if (room.players.length >= room.maxPlayers) {
    logger.error('joinRoom', `Room ${roomId} is full`);
    return false;
  }
  
  // Проверяем статус комнаты
  if (room.status !== 'waiting') {
    logger.error('joinRoom', `Room ${roomId} is not in waiting state`);
    return false;
  }
  
  // Проверяем, не находится ли уже игрок в другой комнате
  if (socket.data.roomId && socket.data.roomId !== roomId) {
    logger.warn('joinRoom', `Player ${nickname} is already in room ${socket.data.roomId} but trying to join ${roomId}`);
    // Сначала выходим из текущей комнаты
    leaveRoom(socket);
  }
  
  // Проверяем, не находится ли уже игрок в комнате
  const existingPlayerIndex = room.players.findIndex(p => p.id === socket.id);
  if (existingPlayerIndex !== -1) {
    logger.warn('joinRoom', `Player with socket ID ${socket.id} is already in room ${roomId}`);
    
    // Игрок уже в комнате, просто обновляем его ник если изменился
    if (room.players[existingPlayerIndex].nickname !== nickname) {
      room.players[existingPlayerIndex].nickname = nickname;
      logger.info('joinRoom', `Updated nickname for player ${socket.id} to ${nickname}`);
    }
    
    // Явно отправляем текущий состав комнаты только этому игроку
    socket.emit('room_joined', {
      roomId: roomId,
      playerId: socket.id,
      players: room.players,
      serverState: _gameState
    });
    
    return true;
  }
  
  // Проверяем, нет ли уже игрока с таким никнеймом в комнате
  // Если есть, добавляем суффикс к имени
  let uniqueNickname = nickname;
  let count = 1;
  while (room.players.some(p => p.nickname === uniqueNickname && p.id !== socket.id)) {
    uniqueNickname = `${nickname} (${count})`;
    count++;
  }
  
  // Явно логируем состав комнаты до добавления нового игрока
  logger.info('joinRoom', `Room ${roomId} players before adding new player: ${room.players.map(p => p.nickname).join(', ')}`);
  
  // Добавляем игрока в список
  const newPlayer = {
    id: socket.id,
    nickname: uniqueNickname,
    isReady: false,
    isCreator: room.players.length === 0 // Первый игрок становится создателем
  };
  
  room.players.push(newPlayer);
  
  // Присоединяем сокет к комнате Socket.IO
  socket.join(roomId);
  
  // Сохраняем ID комнаты в данных сокета
  socket.data.roomId = roomId;
  
  logger.info('joinRoom', `Player ${uniqueNickname} joined room ${roomId}`);
  logger.info('joinRoom', `Room ${roomId} players after adding: ${room.players.map(p => p.nickname).join(', ')}`);
  
  // Сначала отправляем информацию о присоединении новому игроку
  socket.emit('room_joined', {
    roomId: roomId,
    playerId: socket.id,
    players: room.players,
    serverState: _gameState
  });
  
  // Затем с небольшой задержкой отправляем обновление всем в комнате
  setTimeout(() => {
    // Проверяем, что комната всё ещё существует
    if (_gameRooms.has(roomId)) {
      const currentRoom = _gameRooms.get(roomId);
      io.to(roomId).emit('room_players_updated', currentRoom.players);
    }
  }, 100);
  
  return true;
}

/**
 * Возвращает список доступных комнат
 * @returns {Array} Массив доступных комнат
 */
function getAvailableRooms() {
  const availableRooms = [];
  
  for (const [id, room] of _gameRooms.entries()) {
    // Включаем только комнаты в состоянии ожидания и не заполненные
    if (room.status === 'waiting' && 
        room.players.length < room.maxPlayers && 
        room.players.length > 0) { // Убеждаемся, что в комнате есть хотя бы один игрок
      
      // Получаем короткий ID для отображения
      const roomIdParts = id.split('_');
      const shortRoomId = roomIdParts.length > 2 ? roomIdParts[2] : roomIdParts[1].substring(roomIdParts[1].length - 5);
      
      availableRooms.push({
        id: id,
        shortId: shortRoomId,
        players: room.players.length,
        playersList: room.players.map(p => p.nickname),
        maxPlayers: room.maxPlayers,
        createdAt: room.createdAt
      });
    }
  }
  
  // Сортируем комнаты по времени создания (сначала новые)
  availableRooms.sort((a, b) => b.createdAt - a.createdAt);
  
  logger.info('getAvailableRooms', `Found ${availableRooms.length} available rooms`);
  
  return availableRooms;
}

/**
 * Обрабатывает выход игрока из комнаты
 * @param {Socket} socket - Сокет игрока
 */
function leaveRoom(socket) {
  const roomId = socket.data.roomId;
  
  if (!roomId || !_gameRooms.has(roomId)) {
    return;
  }
  
  const room = _gameRooms.get(roomId);
  
  // Удаляем игрока из списка
  const playerIndex = room.players.findIndex(p => p.id === socket.id);
  
  if (playerIndex !== -1) {
    const player = room.players[playerIndex];
    logger.info('leaveRoom', `Player ${player.nickname} left room ${roomId}`);
    
    room.players.splice(playerIndex, 1);
    
    // Если комната опустела, удаляем её
    if (room.players.length === 0) {
      logger.info('leaveRoom', `Room ${roomId} is empty, removing`);
      _gameRooms.delete(roomId);
    } else {
      // Если ушел создатель, назначаем нового
      if (player.isCreator && room.players.length > 0) {
        room.players[0].isCreator = true;
        logger.info('leaveRoom', `New room creator assigned: ${room.players[0].nickname}`);
      }
      
      // Отправляем обновленный список игроков оставшимся участникам
      io.to(roomId).emit('room_players_updated', room.players);
    }
  }
  
  // Отключаем сокет от комнаты
  socket.leave(roomId);
  delete socket.data.roomId;
}

/**
 * Отправляет событие всем игрокам в комнате
 * @param {string} roomId - ID комнаты
 * @param {string} event - Название события
 * @param {*} data - Данные события
 */
function sendToRoom(roomId, event, data) {
  if (!_gameRooms.has(roomId)) {
    logger.error('sendToRoom', `Room ${roomId} not found`);
    return;
  }
  
  io.to(roomId).emit(event, data);
}

/**
 * Проверяет готовность всех игроков в комнате
 * Используется для определения момента начала игры и запуска обратного отсчета
 * 
 * @param {string} roomId - ID комнаты
 * @returns {boolean} Готовы ли все игроки
 */
function checkAllPlayersReadyInRoom(roomId) {
  if (!_gameRooms.has(roomId)) {
    return false;
  }
  
  const room = _gameRooms.get(roomId);
  
  // Минимальное количество игроков для начала игры
  // В реальной игре с несколькими игроками используйте значение 2 или более
  const minPlayers = 2;
  
  // Проверка количества игроков
  if (room.players.length < minPlayers) {
    logger.info('checkAllPlayersReadyInRoom', 
      `Недостаточно игроков для начала игры: ${room.players.length}/${minPlayers}`);
    return false;
  }
  
  // Проверяем количество готовых игроков
  const readyPlayers = room.players.filter(player => player.isReady).length;
  const allReady = readyPlayers === room.players.length;
  
  // Подробно логируем результат проверки
  logger.info('checkAllPlayersReadyInRoom', 
    allReady 
      ? `Все игроки готовы к игре (${readyPlayers}/${room.players.length})` 
      : `Не все игроки готовы (${readyPlayers}/${room.players.length})`
  );
  
  // Возвращаем true только если все игроки готовы
  return allReady;
}

/**
 * Устанавливает состояние готовности игрока в комнате
 * Обновляет статус игрока, отправляет событие обновления игроков в комнате
 * Проверяет готовность всех игроков и запускает обратный отсчет при необходимости
 * 
 * @param {Socket} socket - Сокет игрока
 * @param {boolean} isReady - Состояние готовности
 * @returns {boolean} Успешность операции
 */
function setPlayerReadyInRoom(socket, isReady) {
  const roomId = socket.data.roomId;
  
  if (!roomId || !_gameRooms.has(roomId)) {
    logger.error('setPlayerReadyInRoom', `Комната не найдена для игрока ${socket.id}`);
    return false;
  }
  
  const room = _gameRooms.get(roomId);
  
  // Игра уже запущена или идет отсчет - игнорируем изменение готовности
  if (room.status === 'playing' || room.status === 'countdown') {
    logger.warn('setPlayerReadyInRoom', 
      `Игнорирование изменения готовности: комната ${roomId} уже в состоянии ${room.status}`
    );
    return false;
  }
  
  const player = room.players.find(p => p.id === socket.id);
  
  if (!player) {
    logger.error('setPlayerReadyInRoom', `Игрок не найден в комнате ${roomId}`);
    return false;
  }
  
  // Если состояние не изменилось, просто выходим
  if (player.isReady === isReady) {
    logger.debug('setPlayerReadyInRoom', 
      `Состояние готовности игрока ${player.nickname} уже установлено в ${isReady}`
    );
    return true;
  }
  
  // Обновляем состояние игрока
  player.isReady = isReady;
  
  // Логируем изменение
  logger.info('setPlayerReadyInRoom', 
    `Игрок ${player.nickname} (${player.id}) изменил готовность на ${isReady ? 'готов' : 'не готов'}`
  );
  
  // Подготавливаем детальную информацию об изменении готовности
  const playerReadyState = {
    playerId: player.id,
    nickname: player.nickname,
    isReady: isReady,
    roomId: roomId,
    timestamp: Date.now()
  };
  
  // Сначала отправляем событие об изменении готовности конкретного игрока
  io.to(roomId).emit('player_ready_state', playerReadyState);
  
  // Затем отправляем обновленный список всех игроков для полной синхронизации
  // Используем таймаут для уменьшения риска гонки данных
  setTimeout(() => {
    io.to(roomId).emit('room_players_updated', room.players);
    
    // Проверяем, все ли игроки готовы
    const allReady = checkAllPlayersReadyInRoom(roomId);
    
    // Если все игроки готовы, запускаем отсчет до начала игры
    if (allReady) {
      // Устанавливаем статус комнаты на обратный отсчет
      room.status = 'countdown';
      
      // Отправляем сигнал о готовности всех игроков
      io.to(roomId).emit('all_ready_confirmed');
      
      // Логируем начало обратного отсчета
      logger.info('setPlayerReadyInRoom', `Начат обратный отсчет для комнаты ${roomId}`);
      
      // Запускаем игру через 5 секунд
      setTimeout(() => {
        if (_gameRooms.has(roomId)) {
          const currentRoom = _gameRooms.get(roomId);
          
          if (currentRoom.status === 'countdown') {
            // Меняем статус комнаты на игру
            currentRoom.status = 'playing';
            
            // Запускаем игру для этой комнаты
            startGameForRoom(roomId);
          }
        }
      }, 5000);
    } else {
      logger.info('setPlayerReadyInRoom', 
        `В комнате ${roomId} не все игроки готовы для начала игры`
      );
    }
  }, 100); // Небольшая задержка перед отправкой полного списка
  
  return true;
}

/**
 * Начинает игру для указанной комнаты
 * @param {string} roomId - ID комнаты
 */
function startGameForRoom(roomId) {
  const room = _gameRooms.get(roomId);
  if (!room) {
    logger.error('startGameForRoom', `Room ${roomId} not found`);
    return;
  }
  
  logger.info('startGameForRoom', `Starting game for room ${roomId} with ${room.players.length} players`);
  
  // Устанавливаем состояние "Playing" для всех игроков в комнате
  room.players.forEach((playerInfo, index) => {
    // Находим экземпляр игрока
    const socket = io.sockets.sockets.get(playerInfo.id);
    if (socket && socket.data.PlayerInstance) {
      const player = socket.data.PlayerInstance;
      
      // Устанавливаем состояние "Playing"
      player.preparePlayer(index); // Инициализируем позицию с учетом индекса
      player.setReadyState(true); // Устанавливаем состояние готовности
      
      // Устанавливаем состояние Playing (3) для правильной обработки на клиенте
      player._playerTinyObject.state = enums.PlayerState.Playing;
      
      // Устанавливаем начальную скорость равной 0
      player._speedY = 0;
      
      logger.info('startGameForRoom', `Updated player ${player.getNick()} state to Playing`);
    }
  });
  
  // Явно отправляем оповещение о начале игры и изменении состояния
  io.to(roomId).emit('game_started', { roomId });
  io.to(roomId).emit('update_game_state', enums.ServerState.OnGame);
  
  // Создаем начальную трубу для этой комнаты
  try {
    // Очищаем список труб на всякий случай
    _pipeManager.flushPipeList();
    
    // Создаем новую трубу
    const newPipe = _pipeManager.createNewPipe();
    logger.info('startGameForRoom', `Created initial pipe for room ${roomId}`);
    
    // Получаем списки игроков и труб для отправки клиентам
    const players = _playersManager.getOnGamePlayerList();
    logger.info('startGameForRoom', `Player list has ${players.length} players`);
    
    const pipes = _pipeManager.getPipeList();
    logger.info('startGameForRoom', `Pipe list has ${pipes.length} pipes`);
    
    // Отправляем начальные данные игрокам в комнате
    io.to(roomId).emit('game_loop_update', { 
      players: players,
      pipes: pipes
    });
    
    // Запускаем таймер для регулярного обновления игры, если он еще не запущен
    if (!_timer) {
      startGameLoop();
    }
  } catch (error) {
    logger.error('startGameForRoom', `Error initializing game for room ${roomId}`, error);
  }
  
  // Обновляем статус комнаты
  room.status = 'playing';
}

/**
 * Получает существующего или создает нового игрока
 * @param {Socket} socket - Сокет подключения
 * @param {string} nickname - Никнейм игрока
 * @returns {Player} Игрок
 */
function getOrCreatePlayer(socket, nickname) {
  let player = socket.data.PlayerInstance;
  
  if (!player) {
    console.log(`[DEBUG] Creating new player for socket ${socket.id} with nickname "${nickname}"`);
    player = _playersManager.addNewPlayer(socket, socket.id, nickname);
    socket.data.PlayerInstance = player;
  } else if (nickname && player.getNick() !== nickname) {
    console.log(`[DEBUG] Updating player nickname from "${player.getNick()}" to "${nickname}"`);
    player.setNick(nickname);
  }
  
  return player;
}

/**
 * Обрабатывает вход игрока в игру
 * Устанавливает обработчики событий и синхронизирует состояние с другими игроками
 * @param {Socket} socket - Сокет подключившегося игрока
 * @param {string} nick - Никнейм игрока
 */
function playerLog (socket, nick) {
  console.log(`[DEBUG] playerLog called for socket ${socket.id}, nickname: "${nick}"`);
  
  // Получаем экземпляр игрока из данных сокета
  var player = socket.data.PlayerInstance;

  if (!player) {
    console.error(`[DEBUG] Player instance not found for socket ${socket.id}`);
    return;
  }

  console.log(`[DEBUG] Player instance found: ID=${player.getID()}, current nickname="${player.getNick()}", state=${player.getState()}`);
  
  // Синхронизируем никнейм, если он отличается от переданного
  if (player.getNick() !== nick) {
    console.log(`[DEBUG] Syncing nickname in playerLog from "${player.getNick()}" to "${nick}"`);
    player.setNick(nick);
  }
  
  // Устанавливаем обработчики событий клиента
  
  // Обработка изменения состояния готовности игрока
  socket.on('change_ready_state', function (data) {
    // Поддержка обратной совместимости для старых клиентов
    let isReady = data;
    let playerInfo = null;
    
    // Проверяем формат данных (объект с полями или просто boolean)
    if (typeof data === 'object' && data !== null) {
      isReady = data.isReady;
      playerInfo = data;
      logger.info('change_ready_state', `Получены расширенные данные для изменения состояния готовности: ${JSON.stringify(playerInfo)}`);
    } else {
      logger.info('change_ready_state', `Получены данные в старом формате: ${isReady}`);
    }
    
    console.log(`Player ${socket.data.nickname} ready state changed to ${isReady}`);
    
    // Если игрок в комнате, обрабатываем изменение состояния через функцию для комнаты
    if (socket.data.roomId) {
      const result = setPlayerReadyInRoom(socket, isReady);
      logger.debug('change_ready_state', `Результат setPlayerReadyInRoom: ${result ? 'успешно' : 'ошибка'}`);
      return;
    }
    
    // Старая логика для игроков не в комнатах
    // Получаем экземпляр игрока из данных сокета
    var player = socket.data.PlayerInstance;

    // Проверяем, что игрок инициализирован
    if (!player) {
      console.error('Player not initialized for change_ready_state event');
      return;
    }
    
    // Обновляем состояние игрока и проверяем готовность всех
    _playersManager.changeLobbyState(player, isReady);
    
    // Отправляем всем клиентам обновленное состояние игрока с расширенной информацией
    const playerObject = player.getPlayerObject();
    
    // Создаем расширенную информацию об игроке для события player_ready_state
    const readyStateInfo = {
      playerId: player.getID(),
      nickname: player.getNick(),
      isReady: isReady,
      // Добавляем другие поля из playerObject при необходимости
      state: playerObject.state
    };
    
    // Отправляем событие всем клиентам
    io.sockets.emit('player_ready_state', readyStateInfo);
  });

  // Обработка прыжка птицы
  socket.on('player_jump', function () {
    player.jump();
  });

  console.log(`[DEBUG] Before prepareNewPlayer: ID=${player.getID()}, nickname="${player.getNick()}"`);
  
  // Инициализируем игрока и готовим к игре
  _playersManager.prepareNewPlayer(player, nick);
  
  console.log(`[DEBUG] After prepareNewPlayer: ID=${player.getID()}, nickname="${player.getNick()}", state=${player.getState()}`);

  // Отправляем новому игроку информацию о других игроках
  const playerList = _playersManager.getPlayerList();
  console.log(`[DEBUG] Sending player list to new player. List size: ${playerList.length}`);
  
  socket.emit('player_list', playerList); //5 СОЗДАНИЕ ИГРОВОЙ СЕССИИ - отправка данных для инициализации игровой сессии клиента
  
  // Оповещаем других игроков о новом участнике
  console.log(`[DEBUG] Broadcasting new player to others: ID=${player.getID()}, nickname="${player.getNick()}"`);
  socket.broadcast.emit('new_player', player.getPlayerObject());
}

/**
 * Обновляет состояние игры и оповещает клиентов
 * @param {number} newState - Новое состояние игры
 * @param {boolean} notifyClients - Нужно ли оповещать клиентов об изменении
 */
function updateGameState (newState, notifyClients) {
  var log = '\t[SERVER] Game state changed ! Server is now ';
  
  _gameState = newState;
  // Логируем изменение состояния
  switch (_gameState) {
    case enums.ServerState.WaitingForPlayers:
      log += 'in lobby waiting for players'
      break;
    case enums.ServerState.OnGame:
      log += 'in game !'
      break;
    case enums.ServerState.Ranking:
      log += 'displaying ranking'
      break;
    default:
      log += 'dead :p'
  }
  console.info(log);

  // Оповещаем клиентов при необходимости
  if (notifyClients)
    io.sockets.emit('update_game_state', _gameState);
}

/**
 * Создает новую игру: сбрасывает состояние труб и игроков
 * Переводит сервер в режим ожидания игроков
 */
function createNewGame () {
  var players,
      i;

  // Очищаем список труб
  _pipeManager.flushPipeList(); //3 СОЗДАНИЕ ИГРЫ - сброс состояния игровых объектов для новой игры

  // Сбрасываем состояние игроков и рассылаем обновления
  players = _playersManager.resetPlayersForNewGame();
  for (i = 0; i < players.length; i++) {
    io.sockets.emit('player_ready_state', players[i]);
  };

  // Переводим сервер в режим ожидания
  updateGameState(enums.ServerState.WaitingForPlayers, true);
}

/**
 * Завершает текущую игру и очищает все ресурсы
 * Вызывается при нажатии кнопки EXIT
 */
function exitGame() {
  // Останавливаем игровой цикл
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  _lastTime = null;

  // Очищаем менеджеры
  if (_playersManager) {
    _playersManager = null;
  }
  if (_pipeManager) {
    _pipeManager = null;
  }

  // Уведомляем клиентов о завершении игры
  if (io && io.sockets) {
    io.sockets.emit('game_ended');
  }

  console.log('Game exited and all resources cleaned up.');
}

/**
 * Завершает текущую игру
 * Останавливает игровой цикл, показывает рейтинг и запускает новую игру
 */
function gameOver() {
  var players,
      i;

  // Останавливаем игровой цикл
  clearInterval(_timer);
  _lastTime = null;

  // Переводим сервер в режим показа рейтинга
  updateGameState(enums.ServerState.Ranking, true);

  // Отправляем игрокам их счет
  _playersManager.sendPlayerScore();

  // Через заданное время создаем новую игру
  setTimeout(createNewGame, Const.TIME_BETWEEN_GAMES);
}

/**
 * Запускает игровой цикл
 * Обновляет позиции объектов, проверяет столкновения и синхронизирует состояние с клиентами
 */
function startGameLoop () {
  try {
    logger.debug('startGameLoop', 'Starting game loop');
    /*
    убираем лишние логи
    logger.debug('startGameLoop', 'PipeManager instance:', _pipeManager);
    logger.debug('startGameLoop', 'PipeManager methods:', Object.keys(_pipeManager));
    */
    // Переводим сервер в режим активной игры
    updateGameState(enums.ServerState.OnGame, true); //5 СОЗДАНИЕ ИГРОВОЙ СЕССИИ - запуск игрового цикла с активным состоянием

    // Создаем новую трубу
    _pipeManager.createNewPipe();

    // Запускаем игровой цикл (60 FPS)
    _timer = setInterval(function() {
      var now = new Date().getTime(),
          ellapsedTime = 0,
          plList;

      // Вычисляем время, прошедшее с последнего обновления
      if (_lastTime) {
        ellapsedTime = now - _lastTime;
      }
      else {
        _timeStartGame = now;
      }

      _lastTime = now;
      
      // Если все игроки покинули игру, завершаем её
      if (_playersManager.getNumberOfPlayers() == 0) {
        gameOver();
      }

      // Обновляем позиции игроков
      _playersManager.updatePlayers(ellapsedTime);

      // Обновляем позиции труб
      _pipeManager.updatePipes(ellapsedTime);

      // Проверяем столкновения
      if (CollisionEngine.checkCollision(_pipeManager.getPotentialPipeHit(), _playersManager.getPlayerList(enums.PlayerState.Playing)) == true) {
        // Если не осталось живых игроков, завершаем игру
        if (_playersManager.arePlayersStillAlive() == false) {
          gameOver();
        }
      }

      // Отправляем обновленное состояние всем игрокам
      io.sockets.emit('game_loop_update', { 
        players: _playersManager.getOnGamePlayerList(), 
        pipes: _pipeManager.getPipeList()
      });

    }, 1000 / 60);  // 60 кадров в секунду
  } catch (error) {
    logger.error('startGameLoop', 'Error starting game loop', error);
    throw error;
  }
}

/**
 * Запускает игровой сервер
 * Инициализирует Socket.IO, создает менеджеры игроков и труб,
 * устанавливает обработчики событий
 * @param {Server} server - HTTPS сервер для Socket.IO
 */
exports.startServer = function (server) {
  // Инициализируем Socket.IO с настройками CORS
  io = require('socket.io')(server, {
    cors: {
      origin: ["https://flappy.keenetic.link/", "https://flappy.keenetic.link", "https://127.0.0.1", "https://localhost"],
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept"]
    },
    transports: ['polling', 'websocket']
  }); //2 ПОДКЛЮЧЕНИЕ К СЕРВЕРУ - инициализация Socket.IO на HTTPS сервере

  // Экспортируем io в глобальную область видимости для использования в других модулях
  global.io = io;
  
  // Добавляем функцию запуска игрового цикла в глобальную область
  global.startGameLoop = startGameLoop;

  // Устанавливаем начальное состояние сервера
  _gameState = enums.ServerState.WaitingForPlayers;
  
  // Создаем менеджер игроков и устанавливаем обработчик готовности
  _playersManager = new PlayersManager(); //4 СОЗДАНИЕ МЕНЕДЖЕРА ИГРОКОВ - инициализация менеджера игроков
  _playersManager.on('players-ready', function () {
    startGameLoop();  // Запускаем игру, когда все игроки готовы
  });

  // Создаем менеджер труб и устанавливаем обработчик создания новых труб
  _pipeManager = new PipeManager();
  /*
  убираем лишние логи
  console.log('PipeManager instance:', _pipeManager);
  console.log('Methods:', Object.keys(_pipeManager));
  */
  _pipeManager.on('need_new_pipe', function () {
    var pipe = _pipeManager.createNewPipe();  // Изменено с newPipe на createNewPipe
  });

  // Обработка подключения новых клиентов
  io.sockets.on('connection', function (socket) {
    console.log(`[DEBUG] New socket connection: ${socket.id}, handshake:`, socket.handshake.query);
    
    // Инициализируем данные сокета
    socket.data = socket.data || {};
    
    // НЕ создаем игрока сразу при подключении
    // Оставляем это для событий 'say_hi' или 'player-login'
    
    // Устанавливаем обработчики событий сокета
    
    // Обработка отключения игрока
    socket.on('disconnect', function () {
      console.log(`[DEBUG] Socket disconnected: ${socket.id}`);
      
      // Если игрок был в комнате, обрабатываем выход только из его комнаты
      if (socket.data.roomId) {
        const room = _gameRooms.get(socket.data.roomId);
        if (room) {
          // Находим и удаляем только этого игрока из комнаты
          const playerIndex = room.players.findIndex(p => p.id === socket.id);
          if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            logger.info('disconnect', `Player ${player.nickname} disconnected from room ${socket.data.roomId}`);
            
            // Добавляем временную метку при отключении, чтобы не удалять игрока сразу
            // Это даст возможность игроку переподключиться при обновлении страницы
            player.disconnectedAt = Date.now();
            player.isDisconnected = true;
            
            // Оповещаем других игроков о временном отключении
            io.to(socket.data.roomId).emit('player_temporary_disconnect', {
              playerId: player.id,
              nickname: player.nickname
            });
            
            // Запускаем таймер на удаление игрока, если он не переподключится в течение 10 секунд
            setTimeout(() => {
              // Повторно проверяем, существует ли комната и игрок всё ещё в ней
              const currentRoom = _gameRooms.get(socket.data.roomId);
              if (currentRoom) {
                const currentPlayerIndex = currentRoom.players.findIndex(p => p.id === socket.id);
                if (currentPlayerIndex !== -1 && currentRoom.players[currentPlayerIndex].isDisconnected) {
                  // Если игрок не переподключился за отведенное время - удаляем его
                  logger.info('disconnect_timeout', `Removing player ${player.nickname} from room ${socket.data.roomId} after timeout`);
                  currentRoom.players.splice(currentPlayerIndex, 1);
                  
                  // Если комната опустела, удаляем её
                  if (currentRoom.players.length === 0) {
                    logger.info('disconnect_timeout', `Room ${socket.data.roomId} is empty, removing`);
                    _gameRooms.delete(socket.data.roomId);
                  } else {
                    // Если ушел создатель, назначаем нового
                    if (player.isCreator) {
                      const remainingPlayers = currentRoom.players.filter(p => !p.isDisconnected);
                      if (remainingPlayers.length > 0) {
                        remainingPlayers[0].isCreator = true;
                        logger.info('disconnect_timeout', `New room creator assigned: ${remainingPlayers[0].nickname}`);
                      }
                    }
                    
                    // Отправляем обновленный список игроков оставшимся участникам
                    io.to(socket.data.roomId).emit('room_players_updated', currentRoom.players);
                  }
                }
              }
            }, 10000); // 10 секунд на переподключение
            
            // Не удаляем игрока сразу из комнаты, чтобы дать ему шанс переподключиться
          }
        }
      }
      
      // Удаляем игрока из менеджера игроков
      var player = socket.data.PlayerInstance;
      if (player) {
        console.log(`[DEBUG] Removing player with ID: ${player.getID()}, nickname: "${player.getNick()}"`);
        _playersManager.removePlayer(player);
        // Оповещаем других игроков об отключении
        socket.broadcast.emit('player_disconnect', player.getPlayerObject());
      }
      
      // Очищаем данные сокета
      socket.data = {};
    });

    // Обновляем обработчик say_hi
    socket.on('say_hi', function (nick, fn) {
      console.log(`[DEBUG] say_hi received for socket ${socket.id}, nickname: "${nick}"`);
      
      // Валидация никнейма
      if (!nick || nick.trim() === '') {
        nick = 'Player_' + socket.id.substring(0, 5);
        console.log(`[DEBUG] Empty nickname received, generated random nickname: ${nick}`);
      }
      
      socket.data.nickname = nick;
      
      // Используем общую функцию для получения/создания игрока
      var player = getOrCreatePlayer(socket, nick);
      
      console.log(`[DEBUG] Before playerLog for socket ${socket.id}, player: "${player.getNick()}"`);
      fn(_gameState, player.getID());
      playerLog(socket, nick);
      console.log(`[DEBUG] After playerLog for socket ${socket.id}, player: "${player.getNick()}"`);
    });
    
    // Обработка события выхода из игры
    socket.on('exit_game', function () {
      console.log(`[DEBUG] Exit game event received from client ${socket.id}`);
      
      // Если игрок был в комнате, покидаем её
      if (socket.data.roomId) {
        leaveRoom(socket);
      }
      
      var player = socket.data.PlayerInstance;
      if (player) {
        console.log(`[DEBUG] Removing player on exit: ID=${player.getID()}, nickname="${player.getNick()}"`);
        _playersManager.removePlayer(player);
        // Оповещаем других игроков об отключении
        socket.broadcast.emit('player_disconnect', player.getPlayerObject());
        // Отключаем сокет клиента
        socket.disconnect(true);
      }
    });
    
    // Обновляем обработчик player-login
    socket.on('player-login', function (data) {
      console.log(`[DEBUG] player-login received for socket ${socket.id}, mode: ${data.gameMode}, nickname: "${data.nickname}"`);
      
      const nickname = data.nickname || socket.data.nickname || 'Player_' + socket.id.substring(0, 5);
      socket.data.nickname = nickname;
      
      // Используем общую функцию для получения/создания игрока
      var player = getOrCreatePlayer(socket, nickname);
      
      // В зависимости от режима создаем или присоединяемся к комнате
      if (data.gameMode === 'create') {
        // Всегда создаем новую комнату в режиме create
        const roomId = createRoom(socket, nickname);
        socket.emit('room_created', { 
          roomId, 
          players: _gameRooms.get(roomId).players,
          serverState: _gameState,
          playerId: socket.id
        });
      } else if (data.gameMode === 'find') {
        // Получаем список доступных комнат
        const availableRooms = getAvailableRooms();
        
        // Если есть доступные комнаты, отправляем список клиенту для выбора
        if (availableRooms.length > 0) {
          socket.emit('available_rooms', { 
            rooms: availableRooms,
            playerId: socket.id
          });
        } else {
          // Если нет доступных комнат, создаем новую
          const roomId = createRoom(socket, nickname);
          socket.emit('room_created', { 
            roomId, 
            players: _gameRooms.get(roomId).players,
            serverState: _gameState,
            playerId: socket.id
          });
        }
      }
      
      // Сохраняем режим игры
      if (player) {
        player.gameMode = data.gameMode;
      }
    });
    
    // Обработка события готовности всех игроков
    socket.on('all_players_ready', function (data) {
      console.log('All players ready signal received', data);
      
      // Если передан roomId в данных, используем его
      const roomId = data && data.roomId ? data.roomId : socket.data.roomId;
      
      // Если игрок в комнате, проверяем готовность всех в комнате
      if (roomId) {
        console.log(`Checking all players ready in room ${roomId}`);
        checkAllPlayersReadyInRoom(roomId);
        return;
      }
      
      // Старая логика для проверки готовности всех игроков
      const players = _playersManager.getPlayerList();
      
      // Проверяем, что есть хотя бы 2 игрока
      if (players.length < 2) {
        console.log('Not enough players to start the game', players.length);
        return;
      }
      
      // Проверяем, что все игроки готовы
      const allReady = _playersManager.checkAllPlayersReady();
      
      if (allReady) {
        console.log('All players are ready, confirming to clients');
        // Подтверждаем всем клиентам, что они могут начать игру
        io.sockets.emit('all_ready_confirmed');
      } else {
        console.log('Not all players are ready yet');
      }
    });
    
    // Обработка начала игры
    socket.on('start_game', function () {
      console.log('Start game signal received');
      
      // Если игрок в комнате, запускаем игру для комнаты
      if (socket.data.roomId) {
        startGameForRoom(socket.data.roomId);
        return;
      }
      
      // Старая логика для запуска игры
      if (_gameState === enums.ServerState.WaitingForPlayers) {
        startGameLoop();
        // Отправляем явное подтверждение о старте игры всем клиентам
        io.sockets.emit('game_started', { roomId: 'global' });
      }
    });

    // Обработка события выхода из комнаты
    socket.on('leave_room', function () {
      console.log(`[DEBUG] Player ${socket.id} is leaving room ${socket.data.roomId}`);
      
      // Используем существующую функцию для выхода из комнаты
      if (socket.data.roomId) {
        leaveRoom(socket);
        
        // Отправляем подтверждение клиенту
        socket.emit('room_left');
      }
    });

    // Обработка присоединения к выбранной комнате
    socket.on('join_selected_room', function (data) {
      console.log(`[DEBUG] Player ${socket.id} is joining selected room ${data.roomId}`);
      
      const roomId = data.roomId;
      const nickname = socket.data.nickname || 'Player_' + socket.id.substring(0, 5);
      
      if (!_gameRooms.has(roomId)) {
        logger.error('join_selected_room', `Room ${roomId} not found`);
        socket.emit('join_room_error', { message: 'Комната не найдена' });
        return;
      }
      
      // Проверяем, не находится ли игрок уже в другой комнате
      if (socket.data.roomId && socket.data.roomId !== roomId) {
        logger.warn('join_selected_room', `Player ${nickname} is already in room ${socket.data.roomId} but trying to join ${roomId}`);
        // Сначала выходим из текущей комнаты
        leaveRoom(socket);
      }
      
      // Проверяем, не был ли этот игрок уже в комнате (переподключение после обновления страницы)
      const room = _gameRooms.get(roomId);
      
      // Ищем игрока по никнейму среди отключенных
      const existingPlayerIndex = room.players.findIndex(p => p.nickname === nickname && p.isDisconnected);
      
      if (existingPlayerIndex !== -1) {
        // Игрок был временно отключен (например, обновил страницу)
        // Восстанавливаем его сессию с новым ID сокета
        const oldPlayerId = room.players[existingPlayerIndex].id;
        logger.info('join_selected_room', `Reconnecting player ${nickname} with new socket ID ${socket.id} (old ID: ${oldPlayerId})`);
        
        // Обновляем ID сокета и снимаем флаг отключения
        room.players[existingPlayerIndex].id = socket.id;
        room.players[existingPlayerIndex].isDisconnected = false;
        delete room.players[existingPlayerIndex].disconnectedAt;
        
        // Присоединяем сокет к комнате Socket.IO
        socket.join(roomId);
        
        // Сохраняем ID комнаты в данных сокета
        socket.data.roomId = roomId;
        
        // Отправляем уведомление о возвращении игрока
        io.to(roomId).emit('player_reconnected', {
          oldId: oldPlayerId,
          newId: socket.id,
          nickname: nickname
        });
        
        // Отправляем обновленный список игроков всем в комнате
        io.to(roomId).emit('room_players_updated', room.players);
        
        // Отправляем подтверждение игроку
        socket.emit('room_joined', { 
          roomId, 
          players: room.players,
          serverState: _gameState,
          playerId: socket.id
        });
        
        return;
      }
      
      // Стандартное присоединение к комнате, если это не переподключение
      const success = joinRoom(socket, roomId, nickname);
      
      if (success) {
        socket.emit('room_joined', { 
          roomId, 
          players: _gameRooms.get(roomId).players,
          serverState: _gameState,
          playerId: socket.id
        });
      } else {
        socket.emit('join_room_error', { 
          message: 'Не удалось присоединиться к комнате'
        });
      }
    });

    // Добавим новый метод для ответа на запрос списка игроков
    socket.on('get_room_players', (data) => {
      const roomId = data?.roomId || socket.data.roomId;
      if (roomId) {
        // Проверим, есть ли комната с таким ID
        if (_gameRooms.has(roomId)) {
          const room = _gameRooms.get(roomId);
          
          // Проверим, находится ли игрок в этой комнате
          const playerInRoom = room.players.some(p => p.id === socket.id);
          
          if (playerInRoom) {
            logger.info('get_room_players', `Получен запрос на список игроков от ${socket.id} в комнате ${roomId}`);
            getRoomPlayers(socket);
          } else {
            logger.warn('get_room_players', `Игрок ${socket.id} запрашивает комнату ${roomId}, но не состоит в ней`);
          }
        } else {
          logger.warn('get_room_players', `Комната ${roomId} не найдена`);
        }
      } else {
        logger.warn('get_room_players', `ID комнаты не указан в запросе от игрока ${socket.id}`);
      }
    });
  });
  
  console.log('Game started and waiting for players on port ' + Const.SERVER_PORT); //3 СОЗДАНИЕ ИГРЫ - завершение инициализации игрового сервера
};

// Добавим новый метод для ответа на запрос списка игроков
function getRoomPlayers(socket) {
  const roomId = socket.data.roomId;
  
  if (!roomId || !_gameRooms.has(roomId)) {
    logger.error('getRoomPlayers', `Комната не найдена для игрока ${socket.id}`);
    return;
  }
  
  const room = _gameRooms.get(roomId);
  
  // Убедимся, что игрок находится в этой комнате
  const playerInRoom = room.players.some(p => p.id === socket.id);
  if (!playerInRoom) {
    logger.error('getRoomPlayers', `Игрок ${socket.id} запрашивает комнату ${roomId}, но не состоит в ней`);
    return;
  }
  
  logger.info('getRoomPlayers', `Отправка списка игроков (${room.players.length}) игроку ${socket.id} в комнате ${roomId}`);
  
  // Отправляем актуальный список игроков в комнате
  socket.emit('room_players_updated', room.players);
}
