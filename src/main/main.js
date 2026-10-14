const { app, BrowserWindow, ipcMain, globalShortcut, powerSaveBlocker, powerMonitor } = require('electron');
const path = require('path');
const CDDetector = require('./cd-detector');
const MetadataService = require('./metadata-service');
const AudioPlayer = require('./audio-player');

let mainWindow = null;
let cdDetector = null;
let metadataService = null;
let audioPlayer = null;
let powerBlockerId = null;

const isDev = process.argv.includes('--dev');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: !isDev,          // 生产环境全屏启动
    kiosk: !isDev,               // 生产环境锁定 Kiosk 模式
    frame: isDev,                // Dev 模式保留窗口边框方便调试
    autoHideMenuBar: true,
    backgroundColor: '#0f0c1b',
    title: 'MacBook Retro Vinyl CD Player',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (isDev) {
    console.log('[Main] 开发模式运行中...');
    // mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // 1. 开启电源防休眠保护 (保持应用后台在线不死亡)
  try {
    powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    console.log(`[Main] 🛡️ 防休眠服务已开启 (ID: ${powerBlockerId})`);
  } catch (e) {
    console.warn('[Main] 开启防休眠服务失败:', e.message);
  }

  // 监听合盖/休眠事件: 播放器保持在线，但自动暂停音频播放 (唱针抬起，唱片缓动停止)
  powerMonitor.on('suspend', () => {
    console.log('[Main] 🌙 检测到合盖/休眠信号: 保持播放器在线，自动暂停音乐播放...');
    if (audioPlayer && audioPlayer.isPlaying && !audioPlayer.isPaused) {
      audioPlayer.pause();
    }
  });

  // 监听开盖唤醒事件
  powerMonitor.on('resume', () => {
    console.log('[Main] ☀️ 检测到开盖/恢复信号: 播放器就绪，保持当前暂停状态');
  });


  // 2. 初始化核心服务
  cdDetector = new CDDetector({ isDevMock: false });
  metadataService = new MetadataService();
  audioPlayer = new AudioPlayer();

  // 3. 创建主窗口
  createWindow();

  // 4. 监听 CD 检测事件
  cdDetector.on('cd-inserted', async (cdInfo) => {
    console.log('[Main] 💿 事件: CD 已插入', cdInfo);
    if (mainWindow) mainWindow.webContents.send('cd:loading');

    audioPlayer.setMountPath(cdInfo.mountPath);
    audioPlayer.setTotalTracks(cdInfo.trackCount);

    const metadata = await metadataService.fetchMetadata(cdInfo);
    console.log('[Main] ✨ 元数据已获取完毕:', metadata.album, '-', metadata.artist);

    if (mainWindow) {
      mainWindow.webContents.send('cd:ready', metadata);
    }

    // 自动播放第一首
    audioPlayer.play(1);
  });

  cdDetector.on('cd-ejected', () => {
    console.log('[Main] ⏏️ 事件: CD 已弹出');
    audioPlayer.stop();
    if (mainWindow) {
      mainWindow.webContents.send('cd:ejected');
    }
  });

  // 5. 监听播放器状态事件
  audioPlayer.on('playing', (data) => sendStateToRenderer('playing', data));
  audioPlayer.on('paused', (data) => sendStateToRenderer('paused', data));
  audioPlayer.on('resumed', (data) => sendStateToRenderer('resumed', data));
  audioPlayer.on('stopped', () => sendStateToRenderer('stopped', {}));
  audioPlayer.on('progress', (data) => {
    if (mainWindow) mainWindow.webContents.send('player:progress', data);
  });

  // 6. 注册 IPC 控制通道
  ipcMain.handle('player:play', (_, track) => audioPlayer.play(track));
  ipcMain.handle('player:pause', () => audioPlayer.pause());
  ipcMain.handle('player:resume', () => audioPlayer.resume());
  ipcMain.handle('player:toggle', () => {
    if (audioPlayer.isPlaying) {
      if (audioPlayer.isPaused) audioPlayer.resume();
      else audioPlayer.pause();
    } else {
      audioPlayer.play(1);
    }
  });
  ipcMain.handle('player:next', () => audioPlayer.next());
  ipcMain.handle('player:previous', () => audioPlayer.previous());
  ipcMain.handle('player:eject', () => cdDetector.eject());
  ipcMain.handle('player:setVolume', (_, vol) => audioPlayer.setVolume(vol));
  ipcMain.handle('app:quit', () => app.quit());

  // 查询当前是否为 Dev 开发模式
  ipcMain.handle('app:isDev', () => isDev);

  // Dev 模式下的 Mock CD 支持
  ipcMain.handle('dev:mockCD', async () => {
    console.log('[Main] 🧪 触发 Dev Mock CD 体验');
    cdDetector.triggerMockInsert();
  });

  // 7. 注册键盘全局快捷键
  registerGlobalShortcuts();

  // 8. 启动检测
  cdDetector.start();
});

function sendStateToRenderer(state, extraData = {}) {
  if (mainWindow) {
    mainWindow.webContents.send('player:stateChange', {
      state,
      currentTrack: audioPlayer.currentTrack,
      totalTracks: audioPlayer.totalTracks,
      ...extraData
    });
  }
}

function registerGlobalShortcuts() {
  // 播放/暂停
  globalShortcut.register('Space', () => {
    if (audioPlayer.isPlaying) {
      if (audioPlayer.isPaused) audioPlayer.resume();
      else audioPlayer.pause();
    } else {
      audioPlayer.play(1);
    }
  });

  // 下一曲
  globalShortcut.register('Right', () => audioPlayer.next());
  
  // 上一曲
  globalShortcut.register('Left', () => audioPlayer.previous());

  // 弹出 CD
  globalShortcut.register('E', () => cdDetector.eject());
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (cdDetector) cdDetector.stop();
  if (audioPlayer) audioPlayer.stop();
  if (powerBlockerId !== null) {
    powerSaveBlocker.stop(powerBlockerId);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
