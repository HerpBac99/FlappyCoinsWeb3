/**
 * Модуль для управления WebSocket соединением
 * Поддерживает единое соединение на протяжении всего жизненного цикла приложения
 */

// Объект для хранения единого экземпляра сокета
let socketInstance = null;

// Статус соединения
let isConnected = false;

// Хранилище коллбэков для событий
const eventCallbacks = {
    // Системные события Socket.IO
    connect: [],
    disconnect: [],
    reconnect: [],
    reconnect_error: [],
    error: [],
    
    // Пользовательские события
    joined: [],
    roomCreated: [],
    roomJoined: [],
    playerJoined: [],
    playerLeft: [],
    playerStatusChanged: [],
    allPlayersReady: [],
    startGame: [],
    roomError: []
};

/**
 * Инициализирует WebSocket соединение, если оно ещё не создано
 * @param {Object} userData - Данные пользователя для авторизации
 * @returns {Object} - Экземпляр Socket.IO соединения
 */
function initializeSocket(userData) {
    // Если соединение уже создано, возвращаем его
    if (socketInstance && socketInstance.connected) {
        appLogger.debug('Используем существующее активное WebSocket соединение');
        isConnected = true;
        return socketInstance;
    }
    
    appLogger.info('Инициализация WebSocket соединения');
    
    try {
        // Проверяем, есть ли глобальный объект io от Socket.IO
        if (typeof io === 'undefined') {
            appLogger.error('Socket.IO не найден, проверьте подключение скрипта socket.io.js');
            
            // Динамически загружаем Socket.IO скрипт, если он не подключен
            const script = document.createElement('script');
            script.src = '/socket.io/socket.io.js';
            script.onload = () => {
                appLogger.info('Socket.IO скрипт загружен динамически');
                // Повторно вызываем инициализацию после загрузки
                initializeSocket(userData);
            };
            script.onerror = (err) => {
                appLogger.error('Не удалось загрузить Socket.IO скрипт', { error: err });
            };
            document.head.appendChild(script);
            
            return null;
        }
        
        // Создаем новое соединение
        socketInstance = io({
            reconnection: true,        // Включаем автоматическое переподключение
            reconnectionAttempts: 10,   // Максимальное количество попыток (увеличено)
            reconnectionDelay: 1000,   // Начальная задержка между попытками (в мс)
            reconnectionDelayMax: 5000, // Максимальная задержка между попытками (в мс)
            timeout: 15000,            // Таймаут соединения (увеличен)
            transports: ['websocket', 'polling'] // Используем оба транспорта
        });
        
        // Устанавливаем обработчики для системных событий
        socketInstance.on('connect', () => {
            appLogger.info('WebSocket подключен к серверу', { socketId: socketInstance.id });
            isConnected = true;
            
            // Если есть данные пользователя, отправляем их на сервер для авторизации
            if (userData) {
                socketInstance.emit('join', userData);
            }
            
            // Вызываем все зарегистрированные обработчики
            triggerEvent('connect');
        });
        
        socketInstance.on('disconnect', () => {
            appLogger.warn('WebSocket отключен от сервера');
            isConnected = false;
            triggerEvent('disconnect');
        });
        
        socketInstance.on('reconnect', (attemptNumber) => {
            appLogger.info('WebSocket переподключен к серверу', { attempt: attemptNumber });
            isConnected = true;
            triggerEvent('reconnect', attemptNumber);
        });
        
        socketInstance.on('reconnect_error', (error) => {
            appLogger.error('Ошибка переподключения WebSocket', { error: error.message });
            triggerEvent('reconnect_error', error);
        });
        
        socketInstance.on('error', (error) => {
            appLogger.error('Ошибка WebSocket', { error: error.message });
            triggerEvent('error', error);
        });
        
        // Устанавливаем обработчики для пользовательских событий
        socketInstance.on('joined', (data) => {
            appLogger.info('Авторизация успешна', data);
            triggerEvent('joined', data);
        });
        
        socketInstance.on('roomCreated', (data) => {
            appLogger.info('Комната создана', data);
            triggerEvent('roomCreated', data);
        });
        
        socketInstance.on('roomJoined', (data) => {
            appLogger.info('Присоединился к комнате', data);
            triggerEvent('roomJoined', data);
        });
        
        socketInstance.on('playerJoined', (data) => {
            appLogger.info('Новый игрок в комнате', data);
            triggerEvent('playerJoined', data);
        });
        
        socketInstance.on('playerLeft', (data) => {
            appLogger.info('Игрок покинул комнату', data);
            triggerEvent('playerLeft', data);
        });
        
        socketInstance.on('playerStatusChanged', (data) => {
            appLogger.debug('Изменен статус игрока', data);
            triggerEvent('playerStatusChanged', data);
        });
        
        socketInstance.on('allPlayersReady', (data) => {
            appLogger.info('Все игроки готовы', data);
            triggerEvent('allPlayersReady', data);
        });
        
        socketInstance.on('startGame', (data) => {
            appLogger.info('Игра запущена', data);
            triggerEvent('startGame', data);
        });
        
        socketInstance.on('roomError', (data) => {
            appLogger.error('Ошибка комнаты', { error: data.message, code: data.code });
            triggerEvent('roomError', data);
        });
        
        return socketInstance;
    } catch (error) {
        appLogger.error('Ошибка при инициализации WebSocket', { error: error.message });
        return null;
    }
}

/**
 * Вызывает все зарегистрированные обработчики события
 * @param {string} eventName - Название события
 * @param {*} data - Данные события
 */
function triggerEvent(eventName, data) {
    if (!eventCallbacks[eventName]) {
        return;
    }
    
    for (const callback of eventCallbacks[eventName]) {
        try {
            callback(data);
        } catch (error) {
            appLogger.error(`Ошибка в обработчике события ${eventName}`, { error: error.message });
        }
    }
}

/**
 * Регистрирует обработчик события
 * @param {string} eventName - Название события
 * @param {Function} callback - Функция-обработчик
 */
function on(eventName, callback) {
    if (!eventCallbacks[eventName]) {
        eventCallbacks[eventName] = [];
    }
    
    eventCallbacks[eventName].push(callback);
}

/**
 * Удаляет обработчик события
 * @param {string} eventName - Название события
 * @param {Function} callback - Функция-обработчик
 */
function off(eventName, callback) {
    if (!eventCallbacks[eventName]) {
        return;
    }
    
    const index = eventCallbacks[eventName].indexOf(callback);
    if (index !== -1) {
        eventCallbacks[eventName].splice(index, 1);
    }
}

/**
 * Отправляет событие на сервер
 * @param {string} eventName - Название события
 * @param {*} data - Данные события
 */
function emit(eventName, data) {
    if (!socketInstance || !isConnected) {
        appLogger.error(`Попытка отправить событие ${eventName} без установленного соединения`);
        return false;
    }
    
    try {
        socketInstance.emit(eventName, data);
        return true;
    } catch (error) {
        appLogger.error(`Ошибка при отправке события ${eventName}`, { error: error.message });
        return false;
    }
}

/**
 * Проверяет, установлено ли соединение
 * @returns {boolean} - true, если соединение активно
 */
function isSocketConnected() {
    return isConnected && socketInstance && socketInstance.connected;
}

/**
 * Возвращает текущий экземпляр сокета
 * @returns {Object|null} - Экземпляр Socket.IO соединения или null
 */
function getSocket() {
    return socketInstance;
}

// Экспортируем функции в глобальное пространство имен
window.socketService = {
    initialize: initializeSocket,
    on: on,
    off: off,
    emit: emit,
    isConnected: isSocketConnected,
    getSocket: getSocket
}; 