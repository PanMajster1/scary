// Electron: natywne okno gry (Windows / Linux / macOS)
const { app, BrowserWindow, globalShortcut, Menu } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1600, height: 900, backgroundColor: '#000000', title: 'Ucieczka z TK 25: Szlugen Machen',
    autoHideMenuBar: true, fullscreen: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  // F11 — pełny ekran / okno, Ctrl+Q — wyjście
  globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
  globalShortcut.register('CommandOrControl+Q', () => app.quit());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { globalShortcut.unregisterAll(); app.quit(); });
