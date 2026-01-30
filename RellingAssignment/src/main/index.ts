import { app, shell, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { assertFfmpegAvailable } from './deps'
import { initDb } from './db'
import { registerVideoIpcHandlers } from './ipcVideos'
import { recoverStaleJobs } from './recovery'
import { registerMediaProtocol } from './mediaProtocol'

// Register custom media:// protocol as privileged (must be before app.whenReady)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true
    }
  }
])

// Defer ffmpeg check until app is ready
let ffmpegError: Error | null = null
try {
  assertFfmpegAvailable()
} catch (e: any) {
  ffmpegError = e
}

function createWindow(): void {
  // Check if in development mode (only safe to access after app is ready)
  const isDev = !app.isPackaged

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Check ffmpeg error now that dialog is available
  if (ffmpegError) {
    dialog.showErrorBox('Missing ffmpeg', ffmpegError.message)
    app.quit()
    return
  }

  // Initialize database
  initDb()

  // Register media:// protocol handler for serving video files
  registerMediaProtocol()

  // Recover stale clip generation jobs
  recoverStaleJobs()

  // Register IPC handlers
  registerVideoIpcHandlers()

  // Set app user model id for windows
  if (process.platform === 'win32') {
    const isDev = !app.isPackaged
    app.setAppUserModelId(isDev ? process.execPath : 'com.electron')
  }

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
