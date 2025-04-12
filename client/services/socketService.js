/**
 * Сервис для работы с socket.io
 * Обеспечивает соединение с сервером и обработку игровых событий
 */

import { logger } from '../logger.js';
import { getUrlParam, setUrlParam } from '../utils.js';

// Настройки сокета
const SOCKET_CONFIG = {
    RECONNECTION_ATTEMPTS: 5,
    RECONNECTION_DELAY: 1000,
    TIMEOUT: 5000
};

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.roomId = null;
        this.userId = null;
        this.eventHandlers = {};
    }

    /**
     * Инициализирует соединение с сервером socket.io
     * @param {string} serverUrl - URL сервера
     * @param {Object} options - Дополнительные опции
     * @returns {Promise<boolean>} - Успешность подключения
     */
    async connect(serverUrl, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                // Проверяем, что библиотека socket.io загружена
                if (typeof io === 'undefined') {
                    logger.error('Библиотека socket.io не найдена');
                    this.loadSocketIoScript()
                        .then(() => this.initializeSocket(serverUrl, options, resolve, reject))
                        .catch(err => {
                            logger.error('Не удалось загрузить socket.io:', err);
                            reject(err);
                        });
                } else {
                    this.initializeSocket(serverUrl, options, resolve, reject);
                }
            } catch (error) {
                logger.error('Ошибка при подключении к socket.io:', error);
                reject(error);
            }
        });
    }

    /**
     * Загружает скрипт socket.io, если он отсутствует
     * @returns {Promise<void>}
     */
    loadSocketIoScript() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.6.0/socket.io.min.js';
            script.integrity = 'sha384-c79GN5VsunZvi+Q/WObgk2in0CbZsHnjEqvFxC5DxHn9lTfNce2WW6h2pH6u/kF+';
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Не удалось загрузить socket.io скрипт'));
            document.head.appendChild(script);
        });
    }

    /**
     * Инициализирует сокет после загрузки библиотеки
     * @param {string} serverUrl - URL сервера
     * @param {Object} options - Дополнительные опции
     * @param {Function} resolve - Функция успешного завершения Promise
     * @param {Function} reject - Функция ошибки Promise
     */
    initializeSocket(serverUrl, options, resolve, reject) {
        // Настройки подключения
        const socketOptions = {
            reconnectionAttempts: SOCKET_CONFIG.RECONNECTION_ATTEMPTS,
            reconnectionDelay: SOCKET_CONFIG.RECONNECTION_DELAY,
            timeout: SOCKET_CONFIG.TIMEOUT,
            ...options
        };

        // Создаем соединение
        this.socket = io(serverUrl, socketOptions);

        // Устанавливаем обработчики базовых событий
        this.socket.on('connect', () => {
            logger.info('Подключение к socket.io установлено');
            this.connected = true;
            
            // Если в URL есть roomId, автоматически подключаемся к комнате
            const roomIdFromUrl = getUrlParam('roomId');
            if (roomIdFromUrl) {
                this.joinRoom(roomIdFromUrl);
            }
            
            resolve(true);
        });

        this.socket.on('connect_error', (error) => {
            logger.error('Ошибка подключения к socket.io:', error);
            reject(error);
        });

        this.socket.on('disconnect', (reason) => {
            logger.warn(`Отключение от socket.io: ${reason}`);
            this.connected = false;
        });

        this.socket.on('reconnect', (attemptNumber) => {
            logger.info(`Переподключение к socket.io: попытка ${attemptNumber}`);
            this.connected = true;
        });

        this.socket.on('error', (error) => {
            logger.error('Ошибка socket.io:', error);
        });
    }

    /**
     * Отключает соединение с сервером
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
            this.roomId = null;
            logger.info('Отключение от socket.io');
        }
    }

    /**
     * Регистрирует обработчик события
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     */
    on(event, callback) {
        if (!this.socket) {
            logger.warn(`Попытка подписаться на событие ${event} до установки соединения`);
            return;
        }
        
        // Сохраняем обработчик для последующего использования
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        this.eventHandlers[event].push(callback);
        
        this.socket.on(event, callback);
        logger.debug(`Зарегистрирован обработчик события ${event}`);
    }

    /**
     * Удаляет обработчик события
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик (если не указана, удаляются все обработчики)
     */
    off(event, callback) {
        if (!this.socket) {
            return;
        }
        
        if (callback) {
            // Удаляем конкретный обработчик
            this.socket.off(event, callback);
            
            // Удаляем из списка сохраненных обработчиков
            if (this.eventHandlers[event]) {
                this.eventHandlers[event] = this.eventHandlers[event].filter(cb => cb !== callback);
            }
        } else {
            // Удаляем все обработчики
            this.socket.off(event);
            this.eventHandlers[event] = [];
        }
    }

    /**
     * Очищает все обработчики событий
     */
    clearEventHandlers() {
        if (!this.socket) {
            return;
        }
        
        // Удаляем все обработчики
        Object.keys(this.eventHandlers).forEach(event => {
            this.eventHandlers[event].forEach(callback => {
                this.socket.off(event, callback);
            });
            this.eventHandlers[event] = [];
        });
    }

    /**
     * Отправляет событие на сервер
     * @param {string} event - Название события
     * @param {*} data - Данные для отправки
     * @returns {boolean} - Успешность отправки
     */
    emit(event, data) {
        if (!this.socket || !this.connected) {
            logger.warn(`Попытка отправить событие ${event} без активного соединения`);
            return false;
        }
        
        this.socket.emit(event, data);
        logger.debug(`Отправлено событие ${event}`, data);
        return true;
    }

    /**
     * Отправляет событие и ожидает ответа
     * @param {string} event - Название события
     * @param {*} data - Данные для отправки
     * @returns {Promise<*>} - Ответ от сервера
     */
    emitWithAck(event, data) {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.connected) {
                logger.warn(`Попытка отправить событие ${event} без активного соединения`);
                reject(new Error('Нет активного соединения с сервером'));
                return;
            }
            
            this.socket.timeout(SOCKET_CONFIG.TIMEOUT).emit(event, data, (err, response) => {
                if (err) {
                    logger.error(`Ошибка при отправке события ${event}:`, err);
                    reject(err);
                } else {
                    logger.debug(`Получен ответ на событие ${event}:`, response);
                    resolve(response);
                }
            });
        });
    }

    /**
     * Создает новую игровую комнату
     * @param {Object} options - Опции комнаты
     * @returns {Promise<Object>} - Информация о созданной комнате
     */
    async createRoom(options) {
        try {
            const response = await this.emitWithAck('create_room', options);
            
            if (response && response.roomId) {
                this.roomId = response.roomId;
                setUrlParam('roomId', this.roomId);
                logger.info(`Создана комната: ${this.roomId}`);
            }
            
            return response;
        } catch (error) {
            logger.error('Ошибка при создании комнаты:', error);
            throw error;
        }
    }

    /**
     * Присоединяется к существующей комнате
     * @param {string} roomId - ID комнаты
     * @param {Object} options - Опции подключения
     * @returns {Promise<Object>} - Информация о комнате
     */
    async joinRoom(roomId, options = {}) {
        try {
            const response = await this.emitWithAck('join_room', { roomId, ...options });
            
            if (response && response.success) {
                this.roomId = roomId;
                setUrlParam('roomId', this.roomId);
                logger.info(`Подключение к комнате: ${this.roomId}`);
            }
            
            return response;
        } catch (error) {
            logger.error(`Ошибка при подключении к комнате ${roomId}:`, error);
            throw error;
        }
    }

    /**
     * Покидает текущую комнату
     * @returns {Promise<Object>} - Результат операции
     */
    async leaveRoom() {
        if (!this.roomId) {
            logger.warn('Попытка покинуть комнату, когда пользователь не находится в комнате');
            return { success: false, error: 'Пользователь не находится в комнате' };
        }
        
        try {
            const response = await this.emitWithAck('leave_room', { roomId: this.roomId });
            
            if (response && response.success) {
                logger.info(`Покидание комнаты: ${this.roomId}`);
                this.roomId = null;
                setUrlParam('roomId', '');
            }
            
            return response;
        } catch (error) {
            logger.error(`Ошибка при выходе из комнаты ${this.roomId}:`, error);
            throw error;
        }
    }

    /**
     * Отправляет сигнал готовности игрока
     * @param {boolean} isReady - Статус готовности
     * @returns {Promise<Object>} - Результат операции
     */
    async setReady(isReady) {
        if (!this.roomId) {
            logger.warn('Попытка установить готовность вне комнаты');
            return { success: false, error: 'Пользователь не находится в комнате' };
        }
        
        try {
            return await this.emitWithAck('player_ready', { roomId: this.roomId, isReady });
        } catch (error) {
            logger.error('Ошибка при установке готовности игрока:', error);
            throw error;
        }
    }

    /**
     * Отправляет игровое действие
     * @param {string} action - Название действия (например, 'jump')
     * @param {Object} data - Данные действия
     * @returns {boolean} - Успешность отправки
     */
    sendGameAction(action, data = {}) {
        if (!this.roomId) {
            logger.warn('Попытка отправить игровое действие вне комнаты');
            return false;
        }
        
        return this.emit('game_action', {
            roomId: this.roomId,
            action,
            timestamp: Date.now(),
            ...data
        });
    }

    /**
     * Проверяет, подключен ли сокет к серверу
     * @returns {boolean} - Статус подключения
     */
    isConnected() {
        return this.connected && this.socket?.connected;
    }

    /**
     * Проверяет, находится ли пользователь в комнате
     * @returns {boolean} - Находится ли в комнате
     */
    isInRoom() {
        return !!this.roomId;
    }

    /**
     * Получает ID текущей комнаты
     * @returns {string|null} - ID комнаты или null
     */
    getRoomId() {
        return this.roomId;
    }

    /**
     * Устанавливает ID пользователя
     * @param {string} userId - ID пользователя
     */
    setUserId(userId) {
        this.userId = userId;
    }

    /**
     * Получает ID пользователя
     * @returns {string|null} - ID пользователя или null
     */
    getUserId() {
        return this.userId;
    }
}

// Экспортируем синглтон сервиса
export const socketService = new SocketService(); 