# Imagen base oficial de Node.js
FROM node:18

# Crear carpeta de la app
WORKDIR /app

# Copiar dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Exponer el puerto de Express
EXPOSE 8080

# Comando de inicio
CMD ["npm", "start"]
