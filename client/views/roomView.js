/**
 * Компонент комнаты ожидания
 * Управляет отображением игроков и их статусами в комнате ожидания
 */

// Создаем компонент с помощью IIFE, чтобы изолировать переменные
(function() {
    // Приватные переменные компонента
    let userData = null;
    let roomId = null;
    let container = null;
    let playersData = [];
    let isReady = false;
    let countdownInterval = null;

    // Обработчики событий Socket.IO
    let socketHandlers = {};

    /**
     * Инициализирует экран комнаты ожидания
     * @param {HTMLElement} container - Основной контейнер приложения
     * @param {Object} params - Параметры инициализации
     */
    function init(container, params = {}) {
        console.log('=== ИНИЦИАЛИЗАЦИЯ КОМНАТЫ ===');
        console.log('Параметры:', params);
        
        try {
            // Проверяем обязательные параметры
            if (!params.userData) {
                appLogger.error('Необходимы данные пользователя для присоединения к комнате');
                showError('Не удалось получить данные пользователя');
                return;
            }
            
            // Сохраняем данные пользователя
            userData = params.userData;
            
            // Проверяем, есть ли ID комнаты в параметрах
            if (params.roomId) {
                roomId = params.roomId;
                appLogger.info('Инициализация комнаты', { roomId });
                
                // Если есть флаг немедленного отображения - показываем интерфейс сразу
                if (params.showImmediately) {
                    console.log('Немедленное отображение интерфейса комнаты');
                    
                    // Показываем экран комнаты
                    const roomElement = document.getElementById('room');
                    if (roomElement) {
                        roomElement.style.display = 'block';
                    }
                    
                    // Скрываем другие экраны (для уверенности)
                    const otherScreens = document.querySelectorAll('.screen:not(#room)');
                    otherScreens.forEach(screen => {
                        screen.style.display = 'none';
                    });
                }
                
                // Настраиваем WebSocket взаимодействие
                if (!socketService.isConnected()) {
                    appLogger.warn('Отсутствует соединение по WebSocket, переподключение...');
                    socketService.initialize(userData);
                }
                
                // Регистрируем обработчики событий сокета
                registerSocketHandlers();
                
                // Настраиваем обработчики событий интерфейса
                setupEventListeners();
                
                // Присоединяемся к комнате
                joinRoom(roomId, userData);
            } else {
                // Если нет ID комнаты, запрашиваем ее создание
                appLogger.info('Запрос на создание новой комнаты');
                
                // Настраиваем WebSocket взаимодействие
                if (!socketService.isConnected()) {
                    appLogger.warn('Отсутствует соединение по WebSocket, переподключение...');
                    socketService.initialize(userData);
                }
                
                // Регистрируем обработчики событий сокета
                registerSocketHandlers();
                
                // Настраиваем обработчики событий интерфейса
                setupEventListeners();
                
                // Отправляем запрос на создание комнаты
                findOrCreateRoom(userData);
            }
        } catch (error) {
            appLogger.error('Ошибка при инициализации комнаты', { error: error.message });
            showError('Ошибка при инициализации комнаты: ' + error.message);
        }
    }

    /**
     * Обновляет информацию о комнате в интерфейсе
     */
    function updateRoomInfo() {
        // Обновляем ID комнаты в заголовке
        const roomHeader = document.getElementById('room-title');
        if (roomHeader) {
            roomHeader.textContent = `Комната №${roomId || '...'}`;
        }
        
        // Обновляем ID комнаты в информационном блоке
        const roomIdElement = document.getElementById('room-id');
        if (roomIdElement) {
            roomIdElement.textContent = `ID: ${roomId}`;
        }
        
        appLogger.debug('Обновлена информация о комнате', { roomId });
    }

    /**
     * Настраивает обработчики событий для элементов комнаты ожидания
     */
    function setupEventListeners() {
        try {
            // Обработчик для кнопки "Назад"
            const backButton = document.getElementById('back-button');
            if (backButton) {
                // Очищаем старые обработчики, клонируя элемент
                const newBackButton = backButton.cloneNode(true);
                backButton.parentNode.replaceChild(newBackButton, backButton);
                
                // Добавляем новый обработчик
                newBackButton.addEventListener('click', function() {
                    appLogger.info('Нажата кнопка "Назад"');
                    
                    // Отправляем серверу уведомление о выходе из комнаты
                    leaveRoom();
                    
                    // Очищаем ресурсы компонента перед переходом
                    cleanupRoomView();
                    
                    // Переходим в главное меню
                    app.showScreen('mainMenu');
                });
            } else {
                appLogger.error('Кнопка "Назад" не найдена в DOM');
            }
        } catch (error) {
            appLogger.error('Ошибка при настройке обработчиков событий', { error: error.message });
        }
    }

    /**
     * Регистрирует обработчики событий Socket.IO для комнаты
     */
    function registerSocketHandlers() {
        try {
            // Очищаем старые обработчики, если они есть
            unregisterSocketHandlers();
            
            // Создаем объект с обработчиками
            socketHandlers = {
                roomJoined: handleRoomJoined,
                playerJoined: handlePlayerJoined,
                playerLeft: handlePlayerLeft,
                playerStatusChanged: handlePlayerStatusChanged,
                allPlayersReady: handleAllPlayersReady,
                countdownCancelled: handleCountdownCancelled,
                startGame: handleStartGame,
                roomError: handleRoomError
            };
            
            // Регистрируем все обработчики
            for (const [event, handler] of Object.entries(socketHandlers)) {
                socketService.on(event, handler);
            }
            
            appLogger.debug('Зарегистрированы обработчики событий Socket.IO для комнаты');
        } catch (error) {
            appLogger.error('Ошибка при регистрации обработчиков Socket.IO', { error: error.message });
        }
    }

    /**
     * Удаляет обработчики событий Socket.IO при выходе из компонента
     */
    function unregisterSocketHandlers() {
        if (!socketHandlers) return;
        
        try {
            // Удаляем все зарегистрированные обработчики
            for (const [event, handler] of Object.entries(socketHandlers)) {
                socketService.off(event, handler);
            }
            
            // Очищаем объект с обработчиками
            socketHandlers = {};
            
            appLogger.debug('Удалены обработчики событий Socket.IO для комнаты');
        } catch (error) {
            appLogger.error('Ошибка при удалении обработчиков Socket.IO', { error: error.message });
        }
    }

    /**
     * Присоединяется к комнате
     */
    function joinRoom() {
        if (!socketService || !socketService.isConnected()) {
            appLogger.error('Нет соединения с сервером для присоединения к комнате');
            alert('Ошибка соединения с сервером');
            app.showScreen('mainMenu');
            return;
        }
        
        if (!userData) {
            appLogger.error('Нет данных пользователя для присоединения к комнате');
            alert('Ошибка: не удалось получить данные пользователя');
            app.showScreen('mainMenu');
            return;
        }
        
        // Отправляем запрос на присоединение к комнате
        socketService.emit('joinRoom', {
            roomId: roomId,
            userId: userData.id,
            username: userData.username || 'Аноним',
            photoUrl: userData.photo_url || 'assets/default-avatar.png'
        });
        
        appLogger.info('Отправлен запрос на присоединение к комнате', { roomId });
    }

    /**
     * Обработчик события присоединения к комнате
     * @param {Object} data - Данные комнаты
     */
    function handleRoomJoined(data) {
        console.log('=== ПРИСОЕДИНЕНИЕ К КОМНАТЕ ===');
        console.log('Полученные данные:', data);
        
        try {
            if (!data || !data.room) {
                appLogger.error('Получены некорректные данные при присоединении к комнате', data);
                return;
            }
            
            appLogger.info('Успешно присоединился к комнате', { 
                roomId: data.room.id,
                playersCount: data.room.players.length 
            });
            
            // Сохраняем данные игроков
            playersData = data.room.players;
            
            // Сохраняем статус готовности текущего игрока, если он есть
            if (userData && userData.id) {
                const currentPlayer = playersData.find(p => p.userId === userData.id);
                if (currentPlayer) {
                    isReady = currentPlayer.isReady || false;
                    console.log(`Статус готовности текущего игрока: ${isReady}`);
                }
            }
            
            // Проверяем, что элементы интерфейса комнаты отображаются
            const roomElement = document.getElementById('room');
            if (roomElement && roomElement.style.display !== 'block') {
                console.log('Принудительное отображение комнаты');
                roomElement.style.display = 'block';
                
                // Скрываем другие экраны для уверенности
                const otherScreens = document.querySelectorAll('.screen:not(#room)');
                otherScreens.forEach(screen => {
                    screen.style.display = 'none';
                });
            }
            
            // Обновляем UI комнаты со всеми статусами игроков
            updateRoomUI();
            
            // Проверяем статусы всех игроков после обновления UI
            console.log('Проверка статусов игроков после обновления UI:');
            playersData.forEach(player => {
                console.log(`- ${player.username} (${player.userId}): ${player.isReady ? 'готов' : 'не готов'}`);
            });
        } catch (error) {
            appLogger.error('Ошибка при обработке присоединения к комнате', { 
                error: error.message,
                data: data
            });
            console.error('Детали ошибки:', error);
        }
    }

    /**
     * Обработчик события нового игрока в комнате
     * @param {Object} data - Данные о новом игроке
     */
    function handlePlayerJoined(data) {
        if (data && data.player) {
            appLogger.info('Новый игрок присоединился к комнате', { 
                player: data.player.username,
                playerId: data.player.userId
            });
            
            // Обновляем список игроков
            if (data.players) {
                playersData = data.players;
            } else {
                // Добавляем игрока, если не получили полный список
                const existingPlayerIndex = playersData.findIndex(p => p.userId === data.player.userId);
                if (existingPlayerIndex === -1) {
                    playersData.push(data.player);
                }
            }
            
            // Обновляем UI комнаты
            updateRoomUI();
        }
    }

    /**
     * Обработчик события ухода игрока из комнаты
     * @param {Object} data - Данные об игроке, который покинул комнату
     */
    function handlePlayerLeft(data) {
        console.log('=== ИГРОК ПОКИНУЛ КОМНАТУ ===');
        console.log('Данные:', data);
        
        if (!data || !data.userId) {
            appLogger.error('Получены некорректные данные в handlePlayerLeft', data);
            return;
        }
        
        appLogger.info('Игрок покинул комнату', {
            playerId: data.userId,
            username: data.username || 'Неизвестный игрок'
        });
        
        // Проверяем, идет ли сейчас обратный отсчет
        const isCountdownActive = countdownInterval !== null;
        
        // Обновляем список игроков
        if (data.players && Array.isArray(data.players)) {
            appLogger.debug('Получен обновленный список игроков', { count: data.players.length });
            
            // Если пришел флаг сохранения статусов, сохраняем текущие статусы игроков
            if (data.preserveStatuses) {
                console.log('Сохраняем статусы игроков при выходе игрока');
                
                // Создаем новый список игроков, обновляя их данные, но сохраняя статусы
                playersData = data.players.map(newPlayerData => {
                    // Проверяем, есть ли игрок в существующем списке (кроме вышедшего игрока)
                    const existingPlayer = playersData.find(p => p.userId === newPlayerData.userId);
                    
                    // Если игрок есть и у него был установлен статус, сохраняем его
                    if (existingPlayer && existingPlayer.isReady !== undefined) {
                        return {
                            ...newPlayerData,
                            isReady: existingPlayer.isReady
                        };
                    }
                    
                    // Иначе возвращаем новые данные без изменений
                    return newPlayerData;
                });
                
                console.log('Статусы игроков сохранены:', playersData.map(p => ({
                    username: p.username,
                    userId: p.userId,
                    isReady: p.isReady
                })));
            } else {
                // Просто обновляем список, если нет флага сохранения статусов
                playersData = data.players;
            }
        } else {
            // Удаляем игрока вручную, если не получили полный список
            const playerIndex = playersData.findIndex(p => p.userId === data.userId);
            if (playerIndex !== -1) {
                appLogger.debug(`Удаляем игрока с ID ${data.userId} из списка вручную`);
                const removedPlayer = playersData[playerIndex];
                console.log(`Удаляем игрока: ${removedPlayer.username} (${removedPlayer.userId})`);
                playersData.splice(playerIndex, 1);
            } else {
                appLogger.warn('Игрок не найден в списке для удаления', {
                    playerId: data.userId,
                    currentPlayers: playersData.map(p => p.userId)
                });
            }
        }
        
        console.log('Список игроков после обновления:', playersData);
        
        // Если был активен обратный отсчет и осталось менее 2 игроков, останавливаем его
        // Это дополнительная мера безопасности на случай, если событие countdownCancelled не пришло
        if (isCountdownActive && playersData.length < 2) {
            console.log('Останавливаем отсчет из-за недостаточного количества игроков (менее 2)');
            stopCountdown('notEnoughPlayers');
            
            // Показываем сообщение пользователю
            showMessage(`Недостаточно игроков для начала игры (минимум 2). Обратный отсчет отменен.`);
        }
        
        // Принудительно обновляем весь UI комнаты
        updateRoomUI();
    }

    /**
     * Обработчик события изменения статуса игрока
     * @param {Object} data - Данные о статусе игрока
     */
    function handlePlayerStatusChanged(data) {
        console.log('=== ПОЛУЧЕН СТАТУС С СЕРВЕРА ===');
        console.log('Данные:', data);
        
        try {
            if (!data) {
                appLogger.error('Получены пустые данные в handlePlayerStatusChanged');
                return;
            }
            
            if (!data.userId) {
                appLogger.error('Отсутствует ID пользователя в handlePlayerStatusChanged', data);
                return;
            }
            
            if (data.isReady === undefined || data.isReady === null) {
                appLogger.error('Отсутствует статус готовности в handlePlayerStatusChanged', data);
                return;
            }
            
            appLogger.debug('Изменен статус игрока', {
                playerId: data.userId,
                isReady: data.isReady
            });
            
            // Обновляем статус игрока в списке
            const playerIndex = playersData.findIndex(p => p.userId === data.userId);
            if (playerIndex !== -1) {
                const previousStatus = playersData[playerIndex].isReady;
                playersData[playerIndex].isReady = data.isReady;
                
                console.log(`Игрок ${playersData[playerIndex].username}: статус изменен с ${previousStatus} на ${data.isReady}`);
                
                // Если это текущий пользователь, обновляем его статус
                if (data.userId === userData.id) {
                    const prevIsReady = isReady;
                    isReady = data.isReady;
                    console.log(`Обновлен локальный статус для текущего игрока: ${prevIsReady} -> ${isReady}`);
                }
                
                // Обновляем UI комнаты
                updatePlayerStatus(data.userId, data.isReady);
            } else {
                appLogger.warn('Игрок не найден в списке при обновлении статуса', {
                    playerId: data.userId,
                    playersCount: playersData.length
                });
                console.log('Список игроков:', playersData);
                
                // Если игрок не найден в списке, обновляем весь UI
                // Это может произойти при рассинхронизации данных
                if (roomId) {
                    console.log('Попытка восстановить данные игроков из комнаты');
                    // Запрашиваем актуальные данные комнаты
                    socketService.emit('joinRoom', {
                        roomId: roomId,
                        userId: userData.id,
                        username: userData.username || 'Аноним',
                        photoUrl: userData.photo_url || 'assets/default-avatar.png'
                    });
                }
            }
        } catch (error) {
            appLogger.error('Ошибка при обработке изменения статуса игрока', { 
                error: error.message,
                data: data
            });
            console.error('Детали ошибки:', error);
        }
    }

    /**
     * Обработчик события готовности всех игроков
     * @param {Object} data - Данные о времени обратного отсчета
     */
    function handleAllPlayersReady(data) {
        if (data && data.countdownTime) {
            appLogger.info('Все игроки готовы, запускается обратный отсчет', { 
                countdownTime: data.countdownTime 
            });
            
            // Запускаем обратный отсчет
            startCountdown(data.countdownTime);
        }
    }

    /**
     * Обработчик события запуска игры
     * @param {Object} data - Данные о запущенной игре
     */
    function handleStartGame(data) {
        appLogger.info('Игра запущена', { roomId: data.roomId });
        
        // Очищаем интервал обратного отсчета, если он был
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        // Переход на экран игры
        app.showScreen('game', { roomId: data.roomId, players: data.players });
    }

    /**
     * Обработчик ошибок комнаты
     * @param {Object} error - Данные об ошибке
     */
    function handleRoomError(error) {
        appLogger.error('Ошибка комнаты', { message: error.message, code: error.code });
        
        // Если комната не найдена, пробуем пересоздать
        if (error.code === 'ROOM_NOT_FOUND') {
            recreateRoom();
        } else {
            // Для других ошибок показываем сообщение и возвращаемся на главную
            alert(`Ошибка комнаты: ${error.message}`);
            app.showScreen('mainMenu');
        }
    }

    /**
     * Пересоздание комнаты, если она была удалена
     */
    function recreateRoom() {
        if (!socketService || !socketService.isConnected()) {
            appLogger.error('Нет соединения с сервером для пересоздания комнаты');
            alert('Ошибка соединения с сервером');
            app.showScreen('mainMenu');
            return;
        }
        
        if (!userData) {
            appLogger.error('Нет данных пользователя для пересоздания комнаты');
            alert('Ошибка: не удалось получить данные пользователя');
            app.showScreen('mainMenu');
            return;
        }
        
        appLogger.info('Попытка пересоздания комнаты после ошибки "Комната не найдена"');
        
        // Отправляем запрос на создание комнаты
        socketService.emit('createRoom', { 
            userId: userData.id,
            username: userData.username || 'Аноним', 
            photoUrl: userData.photo_url || 'assets/default-avatar.png' 
        });
        
        // Добавляем одноразовый обработчик события создания комнаты
        socketService.on('roomCreated', function handleNewRoom(data) {
            if (data && data.roomId) {
                // Сохраняем ID комнаты
                roomId = data.roomId;
                appLogger.info('Комната пересоздана', { roomId });
                
                // Сохраняем ID в localStorage
                localStorage.setItem('lastRoomId', roomId);
                
                // Обновляем заголовок с ID комнаты
                const roomIdElement = document.getElementById('room-id');
                if (roomIdElement) {
                    roomIdElement.textContent = `ID: ${roomId}`;
                }
                
                // Сохраняем данные игроков и обновляем UI
                if (data.players) {
                    playersData = data.players;
                    updateRoomUI();
                }
                
                // Удаляем одноразовый обработчик
                socketService.off('roomCreated', handleNewRoom);
            }
        });
    }

    /**
     * Обновляет интерфейс комнаты согласно текущим данным
     */
    function updateRoomUI() {
        try {
            // Дополнительное логирование состояния комнаты перед обновлением UI
            console.log('=== ОБНОВЛЕНИЕ UI КОМНАТЫ ===');
            console.log('ID комнаты:', roomId);
            console.log('Количество игроков:', playersData.length);
            console.log('Текущие игроки:', playersData.map(p => ({
                username: p.username,
                userId: p.userId,
                isReady: p.isReady
            })));
            
            // Обновляем заголовок с ID комнаты
            updateRoomInfo();
            
            // Проверяем, что элемент с сеткой игроков существует
            const playersGrid = document.querySelector('.players-grid');
            if (!playersGrid) {
                appLogger.error('Элемент .players-grid не найден в DOM');
                // Контейнер комнаты не отображается или отсутствует в DOM
                const roomElement = document.getElementById('room');
                if (roomElement) {
                    console.log('Принудительное отображение комнаты');
                    roomElement.style.display = 'block';
                }
                return;
            }
            
            // Удаляем строки игроков (оставляем только заголовки)
            const headerElements = document.querySelectorAll('.grid-header');
            const lastHeaderIndex = headerElements.length - 1;
            
            // Очищаем все элементы после заголовков
            const childrenToRemove = [];
            for (let i = lastHeaderIndex + 1; i < playersGrid.children.length; i++) {
                childrenToRemove.push(playersGrid.children[i]);
            }
            
            // Удаляем элементы
            childrenToRemove.forEach(child => child.remove());
            
            // Добавляем игроков
            playersData.forEach(player => {
                // Создаем ячейку с именем игрока
                const playerNameCell = document.createElement('div');
                playerNameCell.className = 'player-cell player-name';
                
                const playerInfo = document.createElement('div');
                playerInfo.className = 'player-info';
                
                // Аватар
                const avatar = document.createElement('img');
                avatar.className = 'player-avatar';
                avatar.src = player.photoUrl || 'assets/default-avatar.png';
                avatar.alt = player.username;
                
                // Имя пользователя
                const name = document.createElement('span');
                name.textContent = player.username;
                
                // Добавляем элементы к информации о пользователе
                playerInfo.appendChild(avatar);
                playerInfo.appendChild(name);
                playerNameCell.appendChild(playerInfo);
                
                // Создаем ячейку со статусом
                const playerStatusCell = document.createElement('div');
                playerStatusCell.className = 'player-cell player-status';
                
                // Если это текущий пользователь, делаем ячейку кликабельной
                if (player.userId == userData.id) {
                    playerStatusCell.classList.add('clickable');
                    playerStatusCell.addEventListener('click', toggleReadyStatus);
                }
                
                // Получаем статус готовности (по умолчанию false)
                const playerIsReady = player.isReady === true;
                
                // Создаем индикатор статуса
                const statusCircle = document.createElement('div');
                
                // Устанавливаем классы в зависимости от статуса
                statusCircle.className = playerIsReady 
                    ? 'status-circle ready' 
                    : 'status-circle not-ready';
                
                // Устанавливаем текст и атрибуты
                statusCircle.setAttribute('data-userid', player.userId);
                statusCircle.innerHTML = playerIsReady ? '✓' : '✗';
                
                // Явное применение стилей для обхода возможных проблем с CSS
                const readyColor = getComputedStyle(document.documentElement).getPropertyValue('--ready-color').trim() || '#2ecc71';
                const notReadyColor = getComputedStyle(document.documentElement).getPropertyValue('--not-ready-color').trim() || '#e74c3c';
                
                statusCircle.style.backgroundColor = playerIsReady ? readyColor : notReadyColor;
                statusCircle.style.border = playerIsReady
                    ? `2px solid rgba(46, 204, 113, 0.5)` 
                    : `2px solid rgba(231, 76, 60, 0.5)`;
                
                // Добавляем индикатор к ячейке
                playerStatusCell.appendChild(statusCircle);
                
                // Добавляем ячейки к сетке
                playersGrid.appendChild(playerNameCell);
                playersGrid.appendChild(playerStatusCell);
                
                // Логируем созданный элемент статуса
                console.log(`Создан индикатор статуса для ${player.username} (${player.userId}): ${playerIsReady ? 'готов' : 'не готов'}`);
            });
            
            // Обновляем счетчик игроков
            const playersCountElement = document.getElementById('players-count');
            if (playersCountElement) {
                playersCountElement.textContent = `Игроков: ${playersData.length}/6`;
            }
            
            appLogger.debug('Обновлен UI комнаты', { playersCount: playersData.length });
            
        } catch (error) {
            appLogger.error('Ошибка при обновлении UI комнаты', { error: error.message });
            console.error('Детали ошибки:', error);
        }
    }

    /**
     * Обновляет статус игрока в UI
     * @param {string} userId - ID игрока
     * @param {boolean} isReady - Новый статус готовности
     */
    function updatePlayerStatus(userId, isReady) {
        try {
            appLogger.debug('Обновление статуса игрока в UI', { userId, isReady });
            
            // Пробуем найти по обоим возможным атрибутам (data-userid и data-userId)
            let statusCircle = document.querySelector(`.status-circle[data-userid="${userId}"]`);
            if (!statusCircle) {
                statusCircle = document.querySelector(`.status-circle[data-userId="${userId}"]`);
            }
            
            if (statusCircle) {
                // Проверяем текущий статус чтобы избежать повторного обновления
                const isCurrentlyReady = statusCircle.classList.contains('ready');
                
                // Только если статус действительно изменился
                if (isCurrentlyReady !== isReady) {
                    appLogger.debug('Применение нового статуса к UI', { userId, isReady });
                    
                    // Полностью заменяем класс вместо добавления/удаления
                    const baseClass = 'status-circle';
                    const statusClass = isReady ? 'ready' : 'not-ready';
                    statusCircle.className = `${baseClass} ${statusClass}`;
                    
                    // Обновляем текст
                    statusCircle.innerHTML = isReady ? '✓' : '✗';
                    
                    // Явное применение стилей для решения возможных проблем с CSS
                    const readyColor = getComputedStyle(document.documentElement).getPropertyValue('--ready-color').trim() || '#2ecc71';
                    const notReadyColor = getComputedStyle(document.documentElement).getPropertyValue('--not-ready-color').trim() || '#e74c3c';
                    
                    statusCircle.style.backgroundColor = isReady ? readyColor : notReadyColor;
                    statusCircle.style.border = isReady ? 
                        `2px solid rgba(46, 204, 113, 0.5)` : 
                        `2px solid rgba(231, 76, 60, 0.5)`;
                    
                    appLogger.debug('Статус игрока обновлен в UI', { userId, isReady });
                } else {
                    appLogger.debug('Статус игрока уже в нужном состоянии, обновление не требуется', { userId, isReady });
                }
            } else {
                appLogger.warn('Элемент статуса не найден в DOM', { userId });
                console.log('Выполняем полное обновление UI комнаты');
                
                // Проверяем наличие элементов игроков в DOM
                const playersGrid = document.querySelector('.players-grid');
                if (!playersGrid || playersGrid.children.length <= 2) { // 2 - заголовки
                    appLogger.warn('DOM не содержит данных игроков, требуется полная перерисовка');
                }
                
                // Обновляем статус игрока в массиве данных, если он там есть
                const playerIndex = playersData.findIndex(p => p.userId === userId);
                if (playerIndex !== -1) {
                    playersData[playerIndex].isReady = isReady;
                }
                
                // Если элемент не найден, обновляем весь UI комнаты
                // Используем setTimeout для предотвращения циклических вызовов
                setTimeout(() => {
                    updateRoomUI();
                }, 50);
            }
        } catch (error) {
            appLogger.error('Ошибка при обновлении статуса игрока', { error: error.message, userId, isReady });
            console.error('Детали ошибки:', error);
            
            // В случае ошибки также обновляем весь UI для восстановления
            setTimeout(() => {
                try {
                    updateRoomUI();
                } catch (e) {
                    appLogger.error('Ошибка при восстановлении UI комнаты', { error: e.message });
                }
            }, 100);
        }
    }

    /**
     * Переключает статус готовности текущего игрока
     */
    function toggleReadyStatus() {
        if (!socketService || !socketService.isConnected()) {
            appLogger.error('Нет соединения с сервером для изменения статуса');
            alert('Ошибка соединения с сервером');
            return;
        }
        
        // Проверяем наличие данных пользователя и ID комнаты
        if (!userData || !userData.id) {
            appLogger.error('Нет данных пользователя для изменения статуса');
            return;
        }
        
        if (!roomId) {
            appLogger.error('Нет ID комнаты для изменения статуса');
            return;
        }
        
        // Инвертируем текущий статус
        const newStatus = !isReady;
        
        // Выводим отладочную информацию
        console.log('=== ПЕРЕКЛЮЧЕНИЕ СТАТУСА ===');
        console.log('Текущий статус:', isReady);
        console.log('Новый статус:', newStatus);
        console.log('ID пользователя:', userData.id);
        console.log('ID комнаты:', roomId);
        
        appLogger.debug('Переключение статуса готовности', { 
            currentStatus: isReady, 
            newStatus: newStatus,
            userId: userData.id
        });
        
        // Обновляем локальное состояние сразу, чтобы UI отреагировал быстрее
        isReady = newStatus;
        
        // Обновляем UI напрямую для мгновенной обратной связи
        updatePlayerStatus(userData.id, newStatus);
        
        // Создаем объект данных для отправки
        const requestData = {
            roomId: roomId,
            userId: userData.id,
            isReady: newStatus
        };
        
        console.log('Отправляемые данные:', requestData);
        
        // Отправляем запрос на изменение статуса
        const emitSuccess = socketService.emit('toggleReady', requestData);
        
        console.log('Запрос отправлен успешно:', emitSuccess);
        
        // Если запрос не удалось отправить, восстанавливаем старый статус
        if (!emitSuccess) {
            appLogger.error('Не удалось отправить запрос на изменение статуса');
            isReady = !newStatus; // Возвращаем старое значение
            updatePlayerStatus(userData.id, isReady); // Обновляем UI обратно
            return;
        }
        
        appLogger.info('Отправлен запрос на изменение статуса готовности', { 
            newStatus,
            roomId,
            success: emitSuccess
        });
    }

    /**
     * Запускает обратный отсчет перед началом игры
     * @param {number} seconds - Время в секундах
     */
    function startCountdown(seconds) {
        // Если уже есть активный отсчет, останавливаем его
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
        
        // Получаем элементы таймера
        const countdownTimer = document.getElementById('countdown-timer');
        const countdownValue = countdownTimer.querySelector('.countdown-value');
        
        if (!countdownTimer || !countdownValue) {
            appLogger.error('Не найдены элементы таймера');
            return;
        }
        
        // Показываем таймер
        countdownTimer.style.display = 'flex';
        
        // Скрываем кнопку "Назад" во время отсчета
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.style.display = 'none';
        }
        
        // Устанавливаем начальное значение
        let secondsLeft = seconds;
        countdownValue.textContent = secondsLeft;
        
        // Создаем интервал для обновления таймера
        countdownInterval = setInterval(() => {
            secondsLeft--;
            
            // Обновляем отображение
            countdownValue.textContent = secondsLeft;
            
            if (secondsLeft <= 0) {
                // Останавливаем таймер
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
        }, 1000);
        
        appLogger.info('Запущен обратный отсчет', { seconds });
    }
    
    /**
     * Останавливает обратный отсчет
     * @param {string} reason - Причина остановки отсчета
     */
    function stopCountdown(reason = 'unknown') {
        // Останавливаем интервал
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        // Скрываем таймер
        const countdownTimer = document.getElementById('countdown-timer');
        if (countdownTimer) {
            countdownTimer.style.display = 'none';
        }
        
        // Показываем кнопку "Назад"
        const backButton = document.getElementById('back-button');
        if (backButton) {
            backButton.style.display = 'block';
        }
        
        appLogger.info('Остановлен обратный отсчет', { reason });
    }

    /**
     * Отправляет запрос на выход из комнаты
     * Явно уведомляет сервер, что игрок покидает комнату
     */
    function leaveRoom() {
        if (!socketService || !socketService.isConnected()) {
            appLogger.warn('Нет соединения с сервером для отправки уведомления о выходе из комнаты');
            return;
        }
        
        if (!userData || !roomId) {
            appLogger.warn('Нет данных пользователя или ID комнаты для выхода из комнаты');
            return;
        }
        
        // Отправляем уведомление о выходе из комнаты
        socketService.emit('leaveRoom', {
            roomId: roomId,
            userId: userData.id
        });
        
        appLogger.info('Отправлено уведомление о выходе из комнаты', { 
            roomId, 
            userId: userData.id 
        });
    }

    /**
     * Очищает ресурсы компонента при скрытии экрана
     */
    function cleanupRoomView() {
        try {
            // Останавливаем таймер обратного отсчета, если он запущен
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            
            // Удаляем обработчики Socket.IO
            unregisterSocketHandlers();
            
            appLogger.debug('Очищены ресурсы комнаты ожидания');
        } catch (error) {
            appLogger.error('Ошибка при очистке ресурсов комнаты', { error: error.message });
        }
    }

    /**
     * Обработчик события отмены обратного отсчета
     * @param {Object} data - Данные об отмене отсчета
     */
    function handleCountdownCancelled(data) {
        console.log('=== ОТМЕНА ОБРАТНОГО ОТСЧЕТА ===');
        console.log('Причина:', data.reason);
        console.log('Игрок:', data.playerName, data.playerId);
        console.log('Осталось игроков:', data.playersCount || 'неизвестно');
        
        appLogger.info('Отменен обратный отсчет', { 
            reason: data.reason,
            playerName: data.playerName,
            playerId: data.playerId,
            playersCount: data.playersCount
        });
        
        // Останавливаем отсчет
        stopCountdown(data.reason);
        
        // Показываем сообщение пользователю
        let message = '';
        if (data.reason === 'notEnoughPlayers') {
            message = `Недостаточно игроков для начала игры (минимум 2). Обратный отсчет отменен.`;
        } else if (data.reason === 'playerDisconnected') {
            message = `Игрок ${data.playerName} отключился. Обратный отсчет отменен.`;
        } else if (data.reason === 'playerLeft') {
            message = `Игрок ${data.playerName} покинул комнату. Обратный отсчет отменен.`;
        } else {
            message = 'Обратный отсчет отменен.';
        }
        
        // Показываем сообщение пользователю
        if (message) {
            showMessage(message);
        }
    }
    
    /**
     * Показывает сообщение пользователю
     * @param {string} message - Текст сообщения
     * @param {number} duration - Длительность показа в миллисекундах
     */
    function showMessage(message, duration = 3000) {
        // Проверяем существование контейнера для сообщений
        let messageContainer = document.getElementById('message-container');
        
        // Если контейнера нет, создаем его
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'message-container';
            messageContainer.style.position = 'fixed';
            messageContainer.style.top = '20%';
            messageContainer.style.left = '50%';
            messageContainer.style.transform = 'translateX(-50%)';
            messageContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            messageContainer.style.color = 'white';
            messageContainer.style.padding = '12px 20px';
            messageContainer.style.borderRadius = '8px';
            messageContainer.style.textAlign = 'center';
            messageContainer.style.zIndex = '1000';
            messageContainer.style.maxWidth = '80%';
            messageContainer.style.fontWeight = '500';
            messageContainer.style.fontSize = '16px';
            messageContainer.style.display = 'none';
            
            document.body.appendChild(messageContainer);
        }
        
        // Устанавливаем текст сообщения
        messageContainer.textContent = message;
        
        // Показываем сообщение
        messageContainer.style.display = 'block';
        
        // Скрываем сообщение через указанное время
        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, duration);
    }

    /**
     * Публичная функция для выхода из комнаты при закрытии приложения
     */
    function exitRoom() {
        appLogger.info('Выход из комнаты при закрытии приложения');
        
        try {
            // Останавливаем отсчет, если он запущен
            if (countdownInterval) {
                stopCountdown('appClosing');
            }
            
            // Отправляем уведомление о выходе
            leaveRoom();
            
            // Очищаем ресурсы компонента
            cleanupRoomView();
        } catch (error) {
            appLogger.error('Ошибка при выходе из комнаты', { error: error.message });
        }
    }

    // Экспортируем компонент в глобальное пространство имен
    window.roomComponent = {
        init: init,
        cleanup: cleanupRoomView,
        exitRoom: exitRoom
    };
})(); // Конец IIFE 