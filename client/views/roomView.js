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
            // Скрываем индикатор загрузки если есть
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'none';
            }
            
            // Обновляем ID комнаты в интерфейсе
            updateRoomInfo();
            
            // Настраиваем обработчики событий
            setupEventListeners();
            
            // Регистрируем обработчики событий Socket.IO
            registerSocketHandlers();
            
            // Присоединяемся к комнате
            joinRoom();
            
        } catch (error) {
            appLogger.error('Ошибка при инициализации комнаты ожидания', { error: error.message });
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
        console.log('=== ПОЛУЧЕН СТАТУС С СЕРВЕРА ===');
        console.log('Данные:', data);
        
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
        } else {
            appLogger.warn('Игрок не найден в списке при обновлении статуса', {
                playerId: data.userId,
                playersCount: playersData.length
            });
            console.log('Список игроков:', playersData);
        }
        
        // Обновляем UI комнаты
        updatePlayerStatus(data.userId, data.isReady);
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
            // Обновляем заголовок с ID комнаты
            updateRoomInfo();
            
            // Обновляем таблицу игроков
            const playersGrid = document.querySelector('.players-grid');
            
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
                
                // Создаем индикатор статуса
                const statusCircle = document.createElement('div');
                statusCircle.className = player.isReady ? 'status-circle ready' : 'status-circle not-ready';
                statusCircle.dataset.userId = player.userId;
                statusCircle.innerHTML = player.isReady ? '✓' : '✗';
                
                // Добавляем индикатор к ячейке
                playerStatusCell.appendChild(statusCircle);
                
                // Добавляем ячейки к сетке
                playersGrid.appendChild(playerNameCell);
                playersGrid.appendChild(playerStatusCell);
            });
            
            // Обновляем счетчик игроков
            const playersCountElement = document.getElementById('players-count');
            if (playersCountElement) {
                playersCountElement.textContent = `Игроков: ${playersData.length}/6`;
            }
            
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
            console.log('=== ОБНОВЛЕНИЕ СТАТУСА В UI ===');
            console.log('ID игрока:', userId);
            console.log('Новый статус готовности:', isReady);
            
            appLogger.debug('Обновление статуса игрока в UI', { userId, isReady });
            
            // Находим статусный круг по data-userId атрибуту
            const statusCircle = document.querySelector(`.status-circle[data-userId="${userId}"]`);
            
            if (statusCircle) {
                console.log('DOM элемент найден, текущие классы:', statusCircle.className);
                
                // Полностью заменяем класс вместо добавления/удаления
                const baseClass = 'status-circle';
                const statusClass = isReady ? 'ready' : 'not-ready';
                statusCircle.className = `${baseClass} ${statusClass}`;
                
                // Обновляем текст
                statusCircle.innerHTML = isReady ? '✓' : '✗';
                
                console.log('DOM элемент обновлен, новые классы:', statusCircle.className);
                
                // Явное применение стилей для решения возможных проблем с CSS
                const readyColor = getComputedStyle(document.documentElement).getPropertyValue('--ready-color').trim();
                const notReadyColor = getComputedStyle(document.documentElement).getPropertyValue('--not-ready-color').trim();
                
                console.log('CSS переменные:', { readyColor, notReadyColor });
                
                // Принудительно применяем стили напрямую через style
                statusCircle.style.backgroundColor = isReady ? readyColor : notReadyColor;
                statusCircle.style.color = 'white';
                statusCircle.style.fontWeight = 'bold';
                statusCircle.style.border = `2px solid ${isReady ? readyColor : notReadyColor}`;
                
                appLogger.debug('Статус игрока обновлен в UI', { userId, isReady });
            } else {
                console.log('DOM элемент НЕ найден! Селектор:', `.status-circle[data-userId="${userId}"]`);
                console.log('Все элементы .status-circle:', document.querySelectorAll('.status-circle').length);
                
                // Попробуем найти все элементы с атрибутом data-userId
                const allUserElements = document.querySelectorAll('[data-userId]');
                console.log('Элементы с data-userId:', allUserElements.length);
                
                if (allUserElements.length > 0) {
                    console.log('Доступные ID:', Array.from(allUserElements).map(el => el.dataset.userId));
                }
                
                appLogger.error('Элемент статуса не найден', { userId });
                
                // Если не нашли элемент, попробуем перестроить весь UI комнаты
                updateRoomUI();
            }
        } catch (error) {
            console.error('Ошибка при обновлении статуса:', error);
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

    // Экспортируем компонент в глобальное пространство имен
    window.roomComponent = {
        init: initRoomView,
        cleanup: cleanupRoomView
    };
})(); // Конец IIFE 