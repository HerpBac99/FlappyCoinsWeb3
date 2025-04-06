// Основные переменные
let userData = null;
let socket = null;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем полноэкранный режим
    initTelegramFullscreen();
    
    // Получаем данные пользователя из Telegram или localStorage
    userData = getUserData();
    
    if (userData) {
        // Обновляем интерфейс с данными пользователя
        updateUserInterface(userData);
        
        // Сохраняем данные пользователя в глобальной переменной
        window.userData = userData;
    } else {
        appLogger.error('Не удалось получить данные пользователя');
    }
    
    // Инициализация WebSocket соединения
    initializeSocket();
    
    // Настраиваем обработчики событий для кнопок
    setupEventListeners();
});

// Обновление интерфейса с данными пользователя
function updateUserInterface(user) {
    try {
        // Обновляем имя пользователя
        document.getElementById('username').textContent = user.username || 'Аноним';
        
        // Обновляем аватар, если доступен
        if (user.photo_url) {
            document.getElementById('user-avatar').src = user.photo_url;
        }
        
        // Загружаем счет пользователя из сохраненных данных (если есть)
        fetch(`/api/user/${user.id}`)
            .then(response => {
                if (response.ok) return response.json();
                throw new Error('Не удалось загрузить данные пользователя');
            })
            .then(data => {
                if (data && data.totalScore) {
                    document.getElementById('user-score').textContent = `Счет: ${data.totalScore}`;
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

// Инициализация WebSocket соединения
function initializeSocket() {
    try {
        // Подключаемся к серверу
        socket = io({
            reconnection: true,        // Включаем автоматическое переподключение
            reconnectionAttempts: 5,   // Максимальное количество попыток
            reconnectionDelay: 1000,   // Начальная задержка между попытками (в мс)
            reconnectionDelayMax: 5000, // Максимальная задержка между попытками (в мс)
            timeout: 10000             // Таймаут соединения
        });
        
        // Обработка успешного подключения
        socket.on('connect', () => {
            appLogger.info('Подключено к серверу');
            
            // Отправляем данные пользователя на сервер
            if (userData) {
                socket.emit('join', userData);
            }
        });
        
        // Обработка события успешной авторизации
        socket.on('joined', (data) => {
            appLogger.info('Авторизация прошла успешно', data);
            
            // Обновляем данные пользователя, если сервер что-то добавил
            if (data.userData) {
                userData = { ...userData, ...data.userData };
                updateUserInterface(userData);
            }
        });
        
        // Обработка ошибок
        socket.on('error', (error) => {
            appLogger.error('Ошибка от сервера', { message: error.message });
            alert(`Ошибка: ${error.message}`);
        });
        
        // Обработка отключения
        socket.on('disconnect', () => {
            appLogger.warn('Отключено от сервера, пытаюсь переподключиться...');
        });
        
        // Обработка ошибки переподключения
        socket.on('reconnect_error', (error) => {
            appLogger.error('Ошибка переподключения', { error: error.message });
        });
        
        // Сохраняем экземпляр сокета глобально
        if (window.io) {
            window.io.socket = socket;
        }
    } catch (error) {
        appLogger.error('Ошибка при инициализации WebSocket', { error: error.message });
    }
}

// Настройка обработчиков событий для кнопок
function setupEventListeners() {
    // Пока не добавлено никаких кнопок
    appLogger.info('Настройка обработчиков событий завершена');
    
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
} 