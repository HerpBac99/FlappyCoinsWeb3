/**
 * Утилиты для проекта FlappyCoinsWeb3
 */

import { logger } from './logger.js';

/**
 * Безопасно вызывает метод объекта Telegram WebApp
 * Обрабатывает случаи, когда объект или метод могут быть недоступны
 * 
 * @param {Object} object - Объект, метод которого вызывается
 * @param {string} methodName - Имя метода
 * @param {Array} args - Аргументы метода (опционально)
 * @returns {*} Результат вызова метода или null, если метод недоступен
 */
export function safeCallTgMethod(object, methodName, args = []) {
    try {
        if (!object || typeof object[methodName] !== 'function') {
            logger.debug(`Метод ${methodName} недоступен`);
            return null;
        }
        
        return object[methodName](...args);
    } catch (error) {
        logger.error(`Ошибка при вызове метода ${methodName}:`, error);
        return null;
    }
}

/**
 * Генерирует случайный ID указанной длины
 * 
 * @param {number} length - Длина ID (по умолчанию 6)
 * @returns {string} Случайный ID
 */
export function generateRandomId(length = 6) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
}

/**
 * Форматирует время в формате MM:SS
 * 
 * @param {number} timeInSeconds - Время в секундах
 * @returns {string} Отформатированное время
 */
export function formatTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Проверяет поддержку ориентации экрана и возвращает текущую ориентацию
 * 
 * @returns {string} 'portrait' или 'landscape'
 */
export function getScreenOrientation() {
    if (window.screen && window.screen.orientation) {
        return window.screen.orientation.type.includes('portrait') ? 'portrait' : 'landscape';
    } else if (window.matchMedia) {
        return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
    } else {
        // Fallback для старых браузеров
        return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    }
}

/**
 * Проверяет, поддерживается ли Canvas API в браузере
 * 
 * @returns {boolean} Поддерживается ли Canvas API
 */
export function isCanvasSupported() {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
}

/**
 * Получает параметр из URL
 * 
 * @param {string} name - Имя параметра
 * @returns {string|null} Значение параметра или null, если параметр не найден
 */
export function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Устанавливает параметр в URL без перезагрузки страницы
 * 
 * @param {string} name - Имя параметра
 * @param {string} value - Значение параметра
 */
export function setUrlParam(name, value) {
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    window.history.replaceState({}, '', url);
}

/**
 * Удаляет параметр из URL без перезагрузки страницы
 * 
 * @param {string} name - Имя параметра
 */
export function removeUrlParam(name) {
    const url = new URL(window.location.href);
    url.searchParams.delete(name);
    window.history.replaceState({}, '', url);
}

/**
 * Проверяет поддержку localStorage в браузере
 * 
 * @returns {boolean} Поддерживается ли localStorage
 */
export function isLocalStorageSupported() {
    try {
        const test = '__test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Сохраняет данные в localStorage
 * 
 * @param {string} key - Ключ
 * @param {*} value - Значение (будет преобразовано в JSON)
 * @returns {boolean} Успешность операции
 */
export function saveToStorage(key, value) {
    try {
        if (isLocalStorageSupported()) {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        }
        return false;
    } catch (error) {
        logger.error('Ошибка при сохранении в localStorage:', error);
        return false;
    }
}

/**
 * Получает данные из localStorage
 * 
 * @param {string} key - Ключ
 * @param {*} defaultValue - Значение по умолчанию, если данные не найдены
 * @returns {*} Полученные данные или значение по умолчанию
 */
export function getFromStorage(key, defaultValue = null) {
    try {
        if (isLocalStorageSupported() && localStorage.getItem(key) !== null) {
            return JSON.parse(localStorage.getItem(key));
        }
        return defaultValue;
    } catch (error) {
        logger.error('Ошибка при получении из localStorage:', error);
        return defaultValue;
    }
}

/**
 * Удаляет данные из localStorage
 * 
 * @param {string} key - Ключ
 * @returns {boolean} Успешность операции
 */
export function removeFromStorage(key) {
    try {
        if (isLocalStorageSupported()) {
            localStorage.removeItem(key);
            return true;
        }
        return false;
    } catch (error) {
        logger.error('Ошибка при удалении из localStorage:', error);
        return false;
    }
} 