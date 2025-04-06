const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Создание окна браузера
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,  // Разрешаем использование Node.js в рендерере
      contextIsolation: false, // Для совместимости с React-приложением
    },
  });

  // Загрузка вашего React-приложения, которое запущено на localhost
  win.loadURL('http://localhost:3000');  // Убедитесь, что ваш React сервер работает
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
