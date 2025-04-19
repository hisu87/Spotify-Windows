const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const musicPlayer = require("./main/player");

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#191414", // Spotify's dark background color
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, "index.html"));

  // Open DevTools in development mode
  // mainWindow.webContents.openDevTools();

  // Initialize music player with window reference
  musicPlayer.init(mainWindow);

  // Emitted when the window is closed
  mainWindow.on("closed", () => {
    // Clean up music player resources
    musicPlayer.cleanup();
    // Dereference the window object
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
