FROM node:18-alpine

# Создаем директорию приложения
WORKDIR /app

# Устанавливаем зависимости
# Копируем package.json и package-lock.json (если есть)
COPY package*.json ./
RUN npm install

# Копируем остальные файлы проекта
COPY . .

# Открываем порт, на котором работает приложение
EXPOSE 443

# Запускаем приложение
CMD ["npm", "start"] 