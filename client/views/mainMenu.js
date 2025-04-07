/**
 * Компонент главного меню
 * Управляет отображением и логикой главного меню приложения
 */

// Создаем компонент с помощью IIFE, чтобы изолировать переменные
(function() {
    // HTML-шаблон главного меню
    const mainMenuTemplate = `
        <!-- Контейнер с данными пользователя -->
        <div class="user-info">
            <div class="user-photo">
                <img id="user-avatar" src="assets/default-avatar.png" alt="Аватар">
            </div>
            <div class="user-details">
                <div id="username" class="username">Загрузка...</div>
                <div id="user-score" class="score">Счет: 0</div>
            </div>
        </div>

        <!-- Центральный контейнер с анимацией монеты -->
        <div class="center-container">
            <div class="app-title">
                <h1>FlappyCoin</h1>
            </div>
            <div class="coin-animation">
                <img id="coin-sprite" src="assets/bitcoin.png" alt="Монета">
            </div>
            <!-- Кнопки меню -->
            <div class="menu-buttons">
                <button id="play-button" class="play-button">ИГРАТЬ</button>
            </div>
        </div>
    `;

    // Приватные переменные компонента (заменяют глобальные)
    let userData = null;
    let container = null;
    let roomCreatedHandler = null;

    /**
     * Инициализирует компонент главного меню
     * @param {HTMLElement} containerElement - DOM-элемент, в который будет встроен компонент
     * @param {Object} appData - Данные приложения (пользователь и т.д.)
     */
    function initMainMenu(containerElement, appData) {
        // Сохраняем ссылку на контейнер и данные пользователя
        container = containerElement;
        userData = appData.userData;
        
        appLogger.info('Инициализация главного меню');
        
        try {
            // Отрисовываем шаблон
            renderMainMenu();
            
            // Обновляем интерфейс с данными пользователя
            updateUserInterface(userData);
            
            // Настраиваем обработчики событий для кнопок
            setupEventListeners();
            
            // Загружаем стиль главного меню, если не загружен
            if (!document.getElementById('mainMenuStyle')) {
                loadStyles('style/mainMenu.css', 'mainMenuStyle');
            }
            
            // Регистрируем обработчик для события создания комнаты
            roomCreatedHandler = handleRoomCreated;
            socketService.on('roomCreated', roomCreatedHandler);
            
        } catch (error) {
            appLogger.error('Ошибка при инициализации главного меню', { error: error.message });
        }
    }

    /**
     * Отрисовывает HTML-шаблон главного меню
     */
    function renderMainMenu() {
        if (!container) {
            appLogger.error('Не указан контейнер для главного меню');
            return;
        }
        
        container.innerHTML = mainMenuTemplate;
        appLogger.debug('Отрисован шаблон главного меню');
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
            const usernameElement = document.getElementById('username');
            if (usernameElement) {
                usernameElement.textContent = user.username || 'Аноним';
            }
            
            // Обновляем аватар, если доступен
            const avatarElement = document.getElementById('user-avatar');
            if (avatarElement && user.photo_url) {
                avatarElement.src = user.photo_url;
            }
            
            // Загружаем счет пользователя из сохраненных данных (если есть)
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
        } catch (error) {
            appLogger.error('Ошибка при обновлении интерфейса пользователя', { error: error.message });
        }
    }

    /**
     * Настраивает обработчики событий для элементов главного меню
     */
    function setupEventListeners() {
        try {
            // Обработчик для кнопки "Играть"
            const playButton = document.getElementById('play-button');
            if (playButton) {
                // Убедимся, что текст кнопки установлен явно
                playButton.textContent = 'ИГРАТЬ';
                
                playButton.addEventListener('click', () => {
                    // Логируем нажатие на кнопку
                    appLogger.info('Нажата кнопка "Играть"');
                    
                    // Проверяем соединение перед созданием комнаты
                    if (!socketService || !socketService.isConnected()) {
                        appLogger.error('Нет соединения с сервером');
                        // Попытка инициализировать сокет
                        if (window.socketService && window.socketService.initialize) {
                            appLogger.info('Попытка инициализации сокета');
                            window.socketService.initialize(userData);
                            // Даем время на подключение
                            setTimeout(() => {
                                if (socketService.isConnected()) {
                                    createGameRoom();
                                } else {
                                    alert('Ошибка: нет соединения с сервером. Пожалуйста, проверьте подключение к интернету и перезагрузите приложение.');
                                }
                            }, 1000);
                        } else {
                            alert('Ошибка: нет соединения с сервером. Пожалуйста, проверьте подключение к интернету и перезагрузите приложение.');
                        }
                        return;
                    }
                    
                    // Создаем новую комнату
                    createGameRoom();
                    
                    // Визуальный эффект при нажатии
                    playButton.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        playButton.style.transform = 'scale(1)';
                    }, 100);
                });
            }
            
            // Вращение монетки при наведении
            const coinSprite = document.getElementById('coin-sprite');
            if (coinSprite) {
                coinSprite.addEventListener('mouseenter', () => {
                    coinSprite.style.animation = 'spin 1s linear infinite';
                });
                
                coinSprite.addEventListener('mouseleave', () => {
                    coinSprite.style.animation = 'float 2s ease-in-out infinite';
                });
            }
        } catch (error) {
            appLogger.error('Ошибка при настройке обработчиков событий', { error: error.message });
        }
    }

    /**
     * Создает игровую комнату и переходит на экран комнаты
     */
    function createGameRoom() {
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
        
        // Отправляем запрос на создание комнаты
        socketService.emit('createRoom', { 
            userId: userData.id,
            username: userData.username || 'Аноним', 
            photoUrl: userData.photo_url || 'assets/default-avatar.png' 
        });
        
        appLogger.info('Отправлен запрос на создание комнаты');
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
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay) {
                loadingOverlay.style.display = 'flex';
            }
            
            // Переходим на экран комнаты (без перезагрузки страницы)
            app.showScreen('room', { roomId: data.roomId });
        }
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
    function cleanupMainMenu() {
        // Удаляем обработчики событий для кнопок
        const playButton = document.getElementById('play-button');
        if (playButton) {
            playButton.replaceWith(playButton.cloneNode(true));
        }
        
        const coinSprite = document.getElementById('coin-sprite');
        if (coinSprite) {
            coinSprite.replaceWith(coinSprite.cloneNode(true));
        }
        
        // Удаляем обработчик события создания комнаты
        if (roomCreatedHandler) {
            socketService.off('roomCreated', roomCreatedHandler);
            roomCreatedHandler = null;
        }
        
        appLogger.debug('Очищены ресурсы главного меню');
    }

    // Экспортируем компонент в глобальное пространство имен
    window.mainMenuComponent = {
        init: initMainMenu,
        cleanup: cleanupMainMenu
    };
})(); // Конец IIFE 