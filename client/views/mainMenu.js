/**
 * Компонент главного меню
 * Управляет отображением и логикой главного меню приложения
 */

// Создаем компонент с помощью IIFE, чтобы изолировать переменные
(function() {
    // Приватные переменные компонента
    let userData = null;
    let container = null;
    let roomCreatedHandler = null;

    /**
     * Инициализирует компонент главного меню
     * @param {HTMLElement} containerElement - DOM-элемент, в который будет встроен компонент
     * @param {Object} appData - Данные приложения (пользователь и т.д.)
     */
    function initMainMenu(containerElement, appData) {
        try {
            // Сохраняем ссылку на контейнер и данные пользователя
            container = containerElement;
            userData = appData.userData;
            
            appLogger.info('Инициализация главного меню');
            
            // Показываем главное меню
            showMainMenu();
            
            // Обновляем интерфейс с данными пользователя
            updateUserInterface(userData);
            
            // Настраиваем обработчики событий для кнопок
            setupEventListeners();
            
            // Регистрируем обработчик для события создания комнаты
            registerSocketHandlers();
            
        } catch (error) {
            appLogger.error('Ошибка при инициализации главного меню', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Показывает главное меню
     */
    function showMainMenu() {
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) {
            mainMenu.style.display = 'block';
        }
    }

    /**
     * Обновляет интерфейс с данными пользователя
     * @param {Object} user - Данные пользователя
     */
    function updateUserInterface(user) {
        if (!user) {
            appLogger.error('Нет данных пользователя для обновления интерфейса');
            return;
        }
        
        try {
            // Обновляем имя пользователя
            updateUserName(user);
            
            // Обновляем аватар, если доступен
            updateUserAvatar(user);
            
            // Загружаем счет пользователя из сохраненных данных
            loadUserScore(user);
            
        } catch (error) {
            appLogger.error('Ошибка при обновлении интерфейса пользователя', { error: error.message });
        }
    }
    
    /**
     * Обновляет имя пользователя в интерфейсе
     */
    function updateUserName(user) {
        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = user.username || 'Аноним';
        }
    }
    
    /**
     * Обновляет аватар пользователя
     */
    function updateUserAvatar(user) {
        const avatarElement = document.getElementById('user-avatar');
        if (avatarElement && user.photo_url) {
            avatarElement.src = user.photo_url;
        }
    }
    
    /**
     * Загружает счет пользователя с сервера
     */
    function loadUserScore(user) {
        fetch(`/api/user/${user.id}`)
            .then(response => {
                if (response.ok) return response.json();
                throw new Error('Не удалось загрузить данные пользователя');
            })
            .then(data => {
                if (data && data.totalScore) {
                    const scoreElement = document.getElementById('user-score');
                    if (scoreElement) {
                        scoreElement.textContent = `Счет: ${data.totalScore}`;
                    }
                    appLogger.debug('Загружен счет пользователя', { score: data.totalScore });
                }
            })
            .catch(error => {
                appLogger.error('Ошибка при загрузке данных пользователя', { error: error.message });
            });
    }

    /**
     * Настраивает обработчики событий для элементов главного меню
     */
    function setupEventListeners() {
        try {
            // Обработчик для кнопки "Играть"
            setupPlayButton();
            
            // Вращение монетки при наведении
            setupCoinAnimation();
            
        } catch (error) {
            appLogger.error('Ошибка при настройке обработчиков событий', { error: error.message });
        }
    }
    
    /**
     * Настраивает кнопку "Играть"
     */
    function setupPlayButton() {
        const playButton = document.getElementById('play-button');
        if (playButton) {
            // Убедимся, что текст кнопки установлен явно
            playButton.textContent = 'ИГРАТЬ';
            
            playButton.addEventListener('click', handlePlayButtonClick);
        }
    }
    
    /**
     * Обработчик клика по кнопке "Играть"
     */
    function handlePlayButtonClick() {
        // Логируем нажатие на кнопку
        appLogger.info('Нажата кнопка "Играть"');
        
        // Проверяем соединение перед поиском комнаты
        if (!socketService || !socketService.isConnected()) {
            appLogger.error('Нет соединения с сервером');
            // Попытка инициализировать сокет
            if (window.socketService && window.socketService.initialize) {
                appLogger.info('Попытка инициализации сокета');
                window.socketService.initialize(userData);
                // Даем время на подключение
                setTimeout(() => {
                    if (socketService.isConnected()) {
                        findOrCreateGameRoom();
                    } else {
                        alert('Ошибка: нет соединения с сервером. Пожалуйста, проверьте подключение к интернету и перезагрузите приложение.');
                    }
                }, 1000);
            } else {
                alert('Ошибка: нет соединения с сервером. Пожалуйста, проверьте подключение к интернету и перезагрузите приложение.');
            }
            return;
        }
        
        // Ищем существующую комнату или создаем новую
        findOrCreateGameRoom();
        
        // Визуальный эффект при нажатии
        const button = this;
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 100);
    }
    
    /**
     * Настраивает анимацию монеты
     */
    function setupCoinAnimation() {
        const coinSprite = document.getElementById('coin-sprite');
        if (coinSprite) {
            coinSprite.addEventListener('mouseenter', () => {
                coinSprite.style.animation = 'spin 1s linear infinite';
            });
            
            coinSprite.addEventListener('mouseleave', () => {
                coinSprite.style.animation = 'float 2s ease-in-out infinite';
            });
        }
    }
    
    /**
     * Ищет доступную комнату или создает новую
     */
    function findOrCreateGameRoom() {
        if (!socketService || !socketService.isConnected()) {
            appLogger.error('Нет соединения с сервером');
            alert('Ошибка: нет соединения с сервером');
            return;
        }
        
        if (!userData) {
            appLogger.error('Нет данных пользователя');
            alert('Ошибка: не удалось получить данные пользователя');
            return;
        }
        
        // Показываем индикатор загрузки перед поиском комнаты
        showLoadingOverlay();
        
        // Отправляем запрос на поиск доступной комнаты или создание новой
        socketService.emit('findOrCreateRoom', { 
            userId: userData.id,
            username: userData.username || 'Аноним', 
            photoUrl: userData.photo_url || 'assets/default-avatar.png' 
        });
        
        appLogger.info('Отправлен запрос на поиск или создание комнаты');
    }

    /**
     * Обрабатывает ответ от сервера о создании комнаты
     * @param {Object} data - Данные созданной комнаты
     */
    function handleRoomCreated(data) {
        if (data && data.roomId) {
            appLogger.info('Комната создана', { roomId: data.roomId });
            
            // Сохраняем ID комнаты в localStorage
            localStorage.setItem('lastRoomId', data.roomId);
            
            // Показываем индикатор загрузки перед переходом
            showLoadingOverlay();
            
            // Переходим на экран комнаты
            app.showScreen('room', { roomId: data.roomId });
        }
    }
    
    /**
     * Показывает индикатор загрузки
     */
    function showLoadingOverlay() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    /**
     * Очищает ресурсы компонента при скрытии экрана
     */
    function cleanupMainMenu() {
        // Скрываем главное меню
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) {
            mainMenu.style.display = 'none';
        }
        
        // Удаляем обработчики событий
        removeEventListeners();
        
        // Удаляем обработчик события создания комнаты
        unregisterSocketHandlers();
        
        appLogger.debug('Очищены ресурсы главного меню');
    }
    
    /**
     * Удаляет обработчики событий
     */
    function removeEventListeners() {
        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.replaceWith(playButton.cloneNode(true));
        }
    }
    
    /**
     * Регистрирует обработчики событий сокета
     */
    function registerSocketHandlers() {
        roomCreatedHandler = handleRoomCreated;
        socketService.on('roomCreated', roomCreatedHandler);
        
        // Добавляем обработчик для события присоединения к существующей комнате
        socketService.on('roomJoined', function(data) {
            if (data && data.roomId) {
                appLogger.info('Присоединился к существующей комнате', { roomId: data.roomId });
                
                // Явно выводим логи для диагностики
                console.log('=== ПРИСОЕДИНЕНИЕ К СУЩЕСТВУЮЩЕЙ КОМНАТЕ ===');
                console.log('Получены данные комнаты:', data);
                
                // Сохраняем ID комнаты в localStorage
                localStorage.setItem('lastRoomId', data.roomId);
                
                try {
                    // Очищаем текущие обработчики перед переходом на экран комнаты
                    cleanupMainMenu();
                    
                    // Явно скрываем главное меню перед показом комнаты
                    const mainMenu = document.getElementById('main-menu');
                    if (mainMenu) {
                        mainMenu.style.display = 'none';
                    }
                    
                    // Явно показываем экран комнаты
                    const roomScreen = document.getElementById('room');
                    if (roomScreen) {
                        roomScreen.style.display = 'block';
                    }
                    
                    // Задержка на короткое время, чтобы DOM успел обновиться
                    setTimeout(() => {
                        // Переходим на экран комнаты с явным указанием всех параметров
                        app.showScreen('room', { 
                            roomId: data.roomId,
                            room: data.room,
                            showImmediately: true
                        });
                        
                        appLogger.info('Переключение на экран комнаты выполнено', { roomId: data.roomId });
                    }, 50);
                } catch (error) {
                    appLogger.error('Ошибка при переключении на экран комнаты', { 
                        error: error.message,
                        roomId: data.roomId
                    });
                    
                    console.error('Детали ошибки:', error);
                    
                    // В случае ошибки пытаемся показать экран напрямую через более длительную задержку
                    setTimeout(() => {
                        app.showScreen('room', { roomId: data.roomId, showImmediately: true });
                    }, 500);
                }
            } else {
                appLogger.error('Получены некорректные данные в событии roomJoined', data);
            }
        });
    }

    /**
     * Удаляет обработчики сокетов
     */
    function unregisterSocketHandlers() {
        if (roomCreatedHandler) {
            socketService.off('roomCreated', roomCreatedHandler);
            roomCreatedHandler = null;
        }
        
        // Удаляем обработчик присоединения к комнате
        socketService.off('roomJoined');
    }

    // Экспортируем компонент в глобальное пространство имен
    window.mainMenuComponent = {
        init: initMainMenu,
        cleanup: cleanupMainMenu
    };
})(); // Конец IIFE 