/**
 * Компонент комнаты ожидания
 * Управляет отображением игроков и их статусами в комнате ожидания
 */

// Создаем компонент с помощью IIFE, чтобы изолировать переменные
(function() {
    // HTML-шаблон комнаты ожидания
    const roomTemplate = `
        <!-- Фоновое изображение с размытием -->
        <div class="background-blur"></div>
        
        <!-- Основной контейнер комнаты с прямоугольной областью -->
        <div class="room-container">
            <!-- Контейнер с заголовком комнаты -->
            <div class="room-header">
                <h1>Комната №${localStorage.getItem('lastRoomId') || '...'}</h1>
                <div class="room-info">
                    <div id="room-id">ID: загрузка...</div>
                    <div id="players-count">Игроков: 0/6</div>
                </div>
            </div>
            
            <!-- Сетка игроков -->
            <div class="players-grid">
                <!-- Строка заголовков таблицы -->
                <div class="grid-header player-name">Игрок</div>
                <div class="grid-header player-status">Статус</div>
                
                <!-- Игроки будут добавлены динамически через JavaScript -->
            </div>
            
            <!-- Информация о статусе -->
            <div class="status-info">
                <p>Нажмите на свой статус, чтобы изменить готовность</p>
                <div class="status-examples">
                    <div class="status-example">
                        <div class="status-circle not-ready">✗</div>
                        <span>Не готов</span>
                    </div>
                    <div class="status-example">
                        <div class="status-circle ready">✓</div>
                        <span>Готов</span>
                    </div>
                </div>
            </div>
            
            <!-- Кнопка возврата к главному меню -->
            <div class="back-button-container">
                <button id="back-button" class="back-button">← Назад в меню</button>
            </div>
        </div>
        
        <!-- Таймер обратного отсчета (скрыт по умолчанию) -->
        <div id="countdown-timer" class="countdown-timer">
            <div class="countdown-value">5</div>
            <div class="countdown-text">секунд до начала</div>
        </div>
    `;

    // Приватные переменные компонента (заменяют глобальные)
    let userData = null;
    let roomId = null;
    let container = null;
    let playersData = [];
    let isReady = false;
    let countdownInterval = null;

    // Обработчики событий Socket.IO
    let socketHandlers = {};

    /**
     * Инициализирует компонент комнаты ожидания
     * @param {HTMLElement} containerElement - DOM-элемент, в который будет встроен компонент
     * @param {Object} appData - Данные приложения (пользователь, ID комнаты и т.д.)
     */
    function initRoomView(containerElement, appData) {
        // Сохраняем ссылки на контейнер и данные пользователя
        container = containerElement;
        userData = appData.userData;
        
        // Получаем ID комнаты из параметров или localStorage
        roomId = appData.roomId || localStorage.getItem('lastRoomId');
        
        appLogger.info('Инициализация комнаты ожидания', { roomId });
        
        if (!roomId) {
            appLogger.error('ID комнаты не найден');
            alert('Ошибка: ID комнаты не найден!');
            app.showScreen('mainMenu');
            return;
        }
        
        try {
            // Скрываем индикатор загрузки
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            
            // Отрисовываем шаблон
            renderRoomView();
            
            // Обновляем ID комнаты в интерфейсе
            updateRoomInfo();
            
            // Настраиваем обработчики событий
            setupEventListeners();
            
            // Загружаем стиль комнаты, если не загружен
            if (!document.getElementById('roomStyle')) {
                loadStyles('style/room.css', 'roomStyle');
            }
            
            // Регистрируем обработчики событий Socket.IO
            registerSocketHandlers();
            
            // Присоединяемся к комнате
            joinRoom();
            
        } catch (error) {
            appLogger.error('Ошибка при инициализации комнаты ожидания', { error: error.message });
        }
    }

    /**
     * Отрисовывает HTML-шаблон комнаты ожидания
     */
    function renderRoomView() {
        if (!container) {
            appLogger.error('Не указан контейнер для комнаты ожидания');
            return;
        }
        
        container.innerHTML = roomTemplate;
        appLogger.debug('Отрисован шаблон комнаты ожидания');
    }

    /**
     * Обновляет информацию о комнате в интерфейсе
     */
    function updateRoomInfo() {
        // Обновляем ID комнаты в заголовке
        const roomHeader = document.querySelector('.room-header h1');
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
                backButton.addEventListener('click', () => {
                    appLogger.info('Нажата кнопка "Назад"');
                    app.showScreen('mainMenu');
                });
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
        if (data && data.room) {
            appLogger.info('Успешно присоединился к комнате', { roomId: data.room.id });
            
            // Сохраняем данные игроков
            playersData = data.room.players;
            
            // Обновляем UI комнаты
            updateRoomUI();
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
        if (data && data.userId) {
            appLogger.info('Игрок покинул комнату', {
                playerId: data.userId,
                username: data.username
            });
            
            // Обновляем список игроков
            if (data.players) {
                playersData = data.players;
            } else {
                // Удаляем игрока, если не получили полный список
                playersData = playersData.filter(p => p.userId !== data.userId);
            }
            
            // Обновляем UI комнаты
            updateRoomUI();
        }
    }

    /**
     * Обработчик события изменения статуса игрока
     * @param {Object} data - Данные о статусе игрока
     */
    function handlePlayerStatusChanged(data) {
        if (data && data.userId) {
            appLogger.debug('Изменен статус игрока', {
                playerId: data.userId,
                isReady: data.isReady
            });
            
            // Обновляем статус игрока в списке
            const playerIndex = playersData.findIndex(p => p.userId === data.userId);
            if (playerIndex !== -1) {
                playersData[playerIndex].isReady = data.isReady;
                
                // Если это текущий пользователь, обновляем его статус
                if (data.userId === userData.id) {
                    isReady = data.isReady;
                }
            }
            
            // Обновляем UI комнаты
            updatePlayerStatus(data.userId, data.isReady);
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
     * Обновляет UI комнаты с текущими данными игроков
     */
    function updateRoomUI() {
        try {
            // Обновляем счетчик игроков
            const playersCountElement = document.getElementById('players-count');
            if (playersCountElement) {
                playersCountElement.textContent = `Игроков: ${playersData.length}/6`;
            }
            
            // Получаем сетку игроков
            const playersGrid = document.querySelector('.players-grid');
            if (!playersGrid) {
                appLogger.error('Не найдена сетка игроков');
                return;
            }
            
            // Удаляем существующие строки игроков (кроме заголовков)
            const existingPlayerElements = playersGrid.querySelectorAll('.player-cell:not(.grid-header)');
            existingPlayerElements.forEach(el => el.remove());
            
            // Добавляем строки для каждого игрока
            playersData.forEach(player => {
                // Создаем элементы строки
                const nameCell = document.createElement('div');
                nameCell.className = 'player-cell player-name';
                nameCell.dataset.userId = player.userId;
                
                // Проверка, является ли текущий игрок владельцем комнаты
                // const isRoomOwner = player.userId === data.room.createdBy;
                
                // Создаем контейнер для аватара и имени
                const playerInfo = document.createElement('div');
                playerInfo.className = 'player-info';
                
                // Аватар игрока
                const avatar = document.createElement('img');
                avatar.className = 'player-avatar';
                avatar.src = player.photoUrl || 'assets/default-avatar.png';
                avatar.alt = player.username;
                playerInfo.appendChild(avatar);
                
                // Имя игрока
                const name = document.createElement('span');
                name.textContent = player.username;
                playerInfo.appendChild(name);
                
                // Добавляем информацию о игроке в ячейку
                nameCell.appendChild(playerInfo);
                
                // Создаем ячейку для статуса
                const statusCell = document.createElement('div');
                statusCell.className = 'player-cell player-status';
                statusCell.dataset.userId = player.userId;
                
                // Создаем индикатор статуса
                const statusCircle = document.createElement('div');
                statusCircle.className = `status-circle ${player.isReady ? 'ready' : 'not-ready'}`;
                statusCircle.textContent = player.isReady ? '✓' : '✗';
                statusCell.appendChild(statusCircle);
                
                // Добавляем обработчик нажатия для своего статуса
                if (player.userId === userData.id) {
                    statusCell.addEventListener('click', toggleReadyStatus);
                    statusCell.classList.add('clickable');
                }
                
                // Добавляем ячейки в сетку
                playersGrid.appendChild(nameCell);
                playersGrid.appendChild(statusCell);
                
                // Добавляем метки класса для строки
                nameCell.classList.add('player-row');
                statusCell.classList.add('player-row');
            });
            
            appLogger.debug('Обновлен UI комнаты', { playersCount: playersData.length });
        } catch (error) {
            appLogger.error('Ошибка при обновлении UI комнаты', { error: error.message });
        }
    }

    /**
     * Обновляет статус игрока в UI
     * @param {string} userId - ID игрока
     * @param {boolean} isReady - Новый статус готовности
     */
    function updatePlayerStatus(userId, isReady) {
        try {
            const statusCell = document.querySelector(`.player-status[data-user-id="${userId}"]`);
            if (statusCell) {
                const statusCircle = statusCell.querySelector('.status-circle');
                if (statusCircle) {
                    // Обновляем классы и текст
                    statusCircle.className = `status-circle ${isReady ? 'ready' : 'not-ready'}`;
                    statusCircle.textContent = isReady ? '✓' : '✗';
                }
            }
        } catch (error) {
            appLogger.error('Ошибка при обновлении статуса игрока', { error: error.message });
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
        
        // Инвертируем текущий статус
        const newStatus = !isReady;
        
        // Отправляем запрос на изменение статуса
        socketService.emit('toggleReady', {
            roomId: roomId,
            userId: userData.id,
            isReady: newStatus
        });
        
        appLogger.info('Отправлен запрос на изменение статуса готовности', { 
            newStatus,
            roomId 
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
     * Загружает CSS-стиль, если он еще не загружен
     * @param {string} url - Путь к CSS файлу
     * @param {string} id - Идентификатор для элемента link
     */
    function loadStyles(url, id) {
        if (document.getElementById(id)) {
            return;
        }
        
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
        
        appLogger.debug(`Загружен стиль: ${url}`);
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
            
            // Удаляем обработчики кнопок
            const backButton = document.getElementById('back-button');
            if (backButton) {
                backButton.replaceWith(backButton.cloneNode(true));
            }
            
            // Удаляем обработчики статусов игроков
            const statusElements = document.querySelectorAll('.player-status-cell');
            statusElements.forEach(element => {
                element.replaceWith(element.cloneNode(true));
            });
            
            // Удаляем обработчики Socket.IO
            unregisterSocketHandlers();
            
            appLogger.debug('Очищены ресурсы комнаты ожидания');
        } catch (error) {
            appLogger.error('Ошибка при очистке ресурсов комнаты', { error: error.message });
        }
    }

    // Экспортируем компонент в глобальное пространство имен
    window.roomComponent = {
        init: initRoomView,
        cleanup: cleanupRoomView
    };
})(); // Конец IIFE 