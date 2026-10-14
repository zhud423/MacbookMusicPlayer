const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cdPlayer', {
  // 播放控制 API
  playTrack: (trackIndex) => ipcRenderer.invoke('player:play', trackIndex),
  pause: () => ipcRenderer.invoke('player:pause'),
  resume: () => ipcRenderer.invoke('player:resume'),
  togglePlay: () => ipcRenderer.invoke('player:toggle'),
  next: () => ipcRenderer.invoke('player:next'),
  previous: () => ipcRenderer.invoke('player:previous'),
  eject: () => ipcRenderer.invoke('player:eject'),
  setVolume: (volPercent) => ipcRenderer.invoke('player:setVolume', volPercent),
  quit: () => ipcRenderer.invoke('app:quit'),

  // 开发调试 API
  isDev: () => ipcRenderer.invoke('app:isDev'),
  triggerMockCD: () => ipcRenderer.invoke('dev:mockCD'),

  // 事件监听器注册
  onCDLoading: (callback) => ipcRenderer.on('cd:loading', () => callback()),
  onCDReady: (callback) => ipcRenderer.on('cd:ready', (_, data) => callback(data)),
  onCDEjected: (callback) => ipcRenderer.on('cd:ejected', () => callback()),
  onStateChange: (callback) => ipcRenderer.on('player:stateChange', (_, data) => callback(data)),
  onProgress: (callback) => ipcRenderer.on('player:progress', (_, data) => callback(data)),
  onVolumeChange: (callback) => ipcRenderer.on('player:volumeChange', (_, vol) => callback(vol))
});
