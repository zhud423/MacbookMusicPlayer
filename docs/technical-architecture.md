# MacBook CD 黑胶播放器 — 技术方案与软件架构

> 版本: v1.0 | 目标设备: MacBook Pro 13" (2011, 内置光驱, 16GB RAM)

---

## 一、目标硬件与系统环境

| 项目 | 规格 |
|------|------|
| 设备 | MacBook Pro 13" Early/Late 2011 |
| CPU | Intel Core i5/i7 (Sandy Bridge) |
| 内存 | 16GB DDR3 (已升级) |
| 光驱 | 内置吸入式 SuperDrive (支持 CD/DVD) |
| 显示 | 13.3" 1280×800 |
| macOS | High Sierra 10.13.6 (该机型官方最高版本) |
| 网络 | WiFi (用于首次获取 CD 元数据) |

### 1.1 系统限制与应对

| 限制 | 影响 | 应对 |
|------|------|------|
| macOS 最高 10.13 | Electron 版本受限 | 使用 Electron 22 (最后支持 10.13 的版本) |
| Node.js 版本受限 | npm 包兼容性 | 使用 Node.js 18 LTS |
| GPU 较旧 (Intel HD 3000) | CSS 动画性能 | 使用 `will-change` + `transform` 硬件加速，避免重绘 |

---

## 二、为什么选择 Electron

虽然只在 macOS 上使用，选择 Electron **不是为了跨平台**，而是基于以下原因：

| 对比维度 | Electron (Web技术) | 原生 Cocoa/AppKit |
|----------|-------------------|-------------------|
| 黑胶旋转动画 | CSS 一行代码搞定 | Core Animation 需 50+ 行 |
| 唱针弹性动画 | CSS transition 3行 | CASpringAnimation 配置复杂 |
| 唱片反光效果 | CSS conic-gradient | 需自定义 CALayer 绘制 |
| 曲目列表滚动 | HTML/CSS 原生支持 | NSTableView 配置繁琐 |
| 封面圆形裁剪 | `border-radius: 50%` | CAShapeLayer + mask |
| 开发周期 | 1-2 周 | 4-6 周 |
| 热更新调试 | 支持，所见即所得 | 需重新编译 |
| 16GB 内存下表现 | 占用约 200-300MB，绰绰有余 | 占用更少但开发成本高 |

**结论**：Electron 的价值在于用 Web 技术快速实现复杂的黑胶 UI 动画，16GB 内存完全没有性能顾虑。

---

## 三、系统整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App (.app)                   │
│                                                         │
│  ┌─────────────────────┐    ┌────────────────────────┐  │
│  │   Main Process      │    │  Renderer Process      │  │
│  │   (Node.js)         │    │  (Chromium)            │  │
│  │                     │    │                        │  │
│  │  ┌───────────────┐  │    │  ┌──────────────────┐  │  │
│  │  │ CD Detector   │  │◄──►│  │ Vinyl Player UI  │  │  │
│  │  │ (diskutil监听) │  │IPC │  │ (HTML/CSS/JS)    │  │  │
│  │  └───────────────┘  │    │  └──────────────────┘  │  │
│  │                     │    │                        │  │
│  │  ┌───────────────┐  │    │  ┌──────────────────┐  │  │
│  │  │ Audio Engine  │  │◄──►│  │ Track List Panel │  │  │
│  │  │ (afplay/cdda) │  │IPC │  │                  │  │  │
│  │  └───────────────┘  │    │  └──────────────────┘  │  │
│  │                     │    │                        │  │
│  │  ┌───────────────┐  │    │  ┌──────────────────┐  │  │
│  │  │ Metadata Svc  │  │◄──►│  │ Controls Bar     │  │  │
│  │  │ (MusicBrainz) │  │IPC │  │                  │  │  │
│  │  └───────────────┘  │    │  └──────────────────┘  │  │
│  │                     │    │                        │  │
│  │  ┌───────────────┐  │    │  ┌──────────────────┐  │  │
│  │  │ System Ctrl   │  │    │  │ Settings Panel   │  │  │
│  │  │ (Kiosk/电源)  │  │    │  │ (退出按钮等)     │  │  │
│  │  └───────────────┘  │    │  └──────────────────┘  │  │
│  └─────────────────────┘    └────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              IPC Bridge (preload.js)             │    │
│  │    contextBridge.exposeInMainWorld('cdPlayer')   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────┐
│  macOS 系统层    │          │   外部服务 (网络)    │
│  - SuperDrive   │          │  - MusicBrainz API  │
│  - diskutil     │          │  - Cover Art Archive│
│  - afplay       │          │                     │
│  - drutil       │          │                     │
└─────────────────┘          └─────────────────────┘
```

---

## 四、模块详细设计

### 4.1 Main Process — CD 检测模块 (cd-detector.js)

**职责**：监听 CD 的插入和弹出事件

**技术方案**：使用 Node.js `child_process` 定时轮询 `diskutil list`，检测光驱挂载状态变化。

```javascript
// cd-detector.js 核心逻辑伪代码
const { exec } = require('child_process');
const EventEmitter = require('events');

class CDDetector extends EventEmitter {
  constructor() {
    super();
    this.currentDisc = null;
    this.pollInterval = null;
  }

  start() {
    // 每 2 秒轮询一次光驱状态
    this.pollInterval = setInterval(() => this.checkDrive(), 2000);
    this.checkDrive(); // 启动时立即检查
  }

  checkDrive() {
    exec('diskutil list', (err, stdout) => {
      // 解析输出，查找 Audio CD 类型的磁盘
      // 典型输出: /dev/disk2 (external, physical):
      //           #: TYPE NAME        SIZE
      //           0: CD_DA            700MB
      const hasAudioCD = this.parseForAudioCD(stdout);

      if (hasAudioCD && !this.currentDisc) {
        this.currentDisc = hasAudioCD;
        this.emit('cd-inserted', { device: hasAudioCD });
      } else if (!hasAudioCD && this.currentDisc) {
        this.currentDisc = null;
        this.emit('cd-ejected');
      }
    });
  }

  eject() {
    exec('drutil eject', (err) => {
      if (!err) this.emit('cd-ejected');
    });
  }

  stop() {
    clearInterval(this.pollInterval);
  }
}
```

**关键命令**:
- `diskutil list` — 列出所有磁盘，检测 Audio CD
- `diskutil info diskN` — 获取光盘详细信息
- `drutil eject` — 弹出光盘
- `drutil status` — 光驱状态

---

### 4.2 Main Process — 元数据服务 (metadata-service.js)

**职责**：通过 CD 的 TOC 信息获取专辑封面和曲目列表

**数据流**:

```
CD TOC → 计算 Disc ID → MusicBrainz 查询 → 获取 Release MBID → Cover Art Archive 获取封面
```

**Disc ID 计算**：
有两种方案:

| 方案 | 描述 | 优缺点 |
|------|------|--------|
| A: libdiscid (C库桥接) | 通过 node-addon-api 桥接 libdiscid | 精确但需编译原生模块 |
| B: 纯 JS 计算 | 通过 `diskutil info` 读取 TOC 自行计算 | 无需原生依赖，但精度可能略低 |

**推荐方案 B（纯 JS）**，降低构建复杂度：

```javascript
// metadata-service.js 核心逻辑伪代码
const axios = require('axios');

class MetadataService {
  constructor() {
    this.cache = new Map(); // 本地缓存已查询过的 CD
    this.userAgent = 'MacbookCDPlayer/1.0 (contact@example.com)';
  }

  async fetchMetadata(discId) {
    // 1. 检查本地缓存
    if (this.cache.has(discId)) return this.cache.get(discId);

    try {
      // 2. 查询 MusicBrainz
      const mbResponse = await axios.get(
        `https://musicbrainz.org/ws/2/discid/${discId}`,
        {
          params: { inc: 'recordings+artist-credits', fmt: 'json' },
          headers: { 'User-Agent': this.userAgent }
        }
      );

      const release = mbResponse.data.releases[0];
      const metadata = {
        album: release.title,
        artist: release['artist-credit'][0].name,
        releaseId: release.id,
        tracks: release.media[0].tracks.map(t => ({
          position: t.position,
          title: t.title,
          duration: t.length // 毫秒
        }))
      };

      // 3. 获取封面
      try {
        metadata.coverUrl =
          `https://coverartarchive.org/release/${release.id}/front-500`;
      } catch (e) {
        metadata.coverUrl = null; // 无封面，使用默认
      }

      // 4. 缓存结果
      this.cache.set(discId, metadata);
      return metadata;

    } catch (error) {
      // 离线降级：返回基础信息
      return this.getOfflineFallback(discId);
    }
  }

  getOfflineFallback(discId) {
    return {
      album: '未知专辑',
      artist: '未知艺术家',
      coverUrl: null,  // 使用默认黑胶封面
      tracks: []       // 由 CD TOC 生成 Track 1, 2, 3...
    };
  }
}
```

**MusicBrainz API 要点**:
- 请求频率限制: 1次/秒
- 必须设置 User-Agent
- 返回 JSON 格式 (`fmt=json`)
- Cover Art Archive 可能返回 404（该专辑无封面）

---

### 4.3 Main Process — 音频播放引擎 (audio-player.js)

**职责**：控制 CD 音频的播放、暂停、切歌、进度跟踪

**技术路线**：通过 macOS 系统命令 `afplay` 配合 CD 音轨文件播放

```javascript
// audio-player.js 核心逻辑伪代码
const { spawn, exec } = require('child_process');
const path = require('path');

class AudioPlayer extends EventEmitter {
  constructor() {
    super();
    this.process = null;      // afplay 子进程
    this.currentTrack = 0;
    this.isPlaying = false;
    this.startTime = 0;
  }

  // CD 音轨在 macOS 上挂载为 .aiff 文件
  // 路径示例: /Volumes/Audio CD/01 Track 01.aiff
  getTrackPath(trackNumber) {
    const padded = String(trackNumber).padStart(2, '0');
    return `/Volumes/Audio CD/${padded} Track ${padded}.aiff`;
  }

  play(trackNumber) {
    this.stop(); // 停止当前播放

    const trackPath = this.getTrackPath(trackNumber);
    this.process = spawn('afplay', [trackPath]);
    this.currentTrack = trackNumber;
    this.isPlaying = true;
    this.startTime = Date.now();

    this.emit('playing', { track: trackNumber });

    this.process.on('close', (code) => {
      if (code === 0) {
        // 自然播放完毕，播放下一首
        this.emit('track-ended', { track: trackNumber });
      }
    });
  }

  pause() {
    if (this.process) {
      this.process.kill('SIGSTOP'); // 暂停进程
      this.isPlaying = false;
      this.emit('paused');
    }
  }

  resume() {
    if (this.process) {
      this.process.kill('SIGCONT'); // 恢复进程
      this.isPlaying = true;
      this.emit('resumed');
    }
  }

  stop() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this.isPlaying = false;
    }
  }

  next(totalTracks) {
    const nextTrack = this.currentTrack < totalTracks
      ? this.currentTrack + 1 : 1;
    this.play(nextTrack);
  }

  previous() {
    const prevTrack = this.currentTrack > 1
      ? this.currentTrack - 1 : 1;
    this.play(prevTrack);
  }
}
```

**音量控制**：通过 macOS `osascript` 命令控制系统音量

```javascript
setVolume(level) { // level: 0-100
  exec(`osascript -e "set volume output volume ${level}"`);
}

getVolume() {
  return new Promise((resolve) => {
    exec('osascript -e "output volume of (get volume settings)"',
      (err, stdout) => resolve(parseInt(stdout.trim())));
  });
}
```

---

### 4.4 Main Process — 主入口与 IPC (main.js)

**职责**：创建窗口、Kiosk 模式、协调各模块、IPC 通信

```javascript
// main.js 核心结构伪代码
const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');

let mainWindow;
let cdDetector, metadataService, audioPlayer;

app.on('ready', () => {
  // 1. 创建全屏 Kiosk 窗口
  mainWindow = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    frame: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.loadFile('../renderer/index.html');

  // 2. 初始化各模块
  cdDetector = new CDDetector();
  metadataService = new MetadataService();
  audioPlayer = new AudioPlayer();

  // 3. CD 事件 → 渲染进程
  cdDetector.on('cd-inserted', async ({ device }) => {
    mainWindow.webContents.send('cd:loading');
    const discId = await getDiscId(device);
    const metadata = await metadataService.fetchMetadata(discId);
    mainWindow.webContents.send('cd:ready', metadata);
    audioPlayer.play(1); // 自动播放第一首
  });

  cdDetector.on('cd-ejected', () => {
    audioPlayer.stop();
    mainWindow.webContents.send('cd:ejected');
  });

  // 4. 渲染进程 → 播放控制
  ipcMain.handle('player:play', (_, track) => audioPlayer.play(track));
  ipcMain.handle('player:pause', () => audioPlayer.pause());
  ipcMain.handle('player:resume', () => audioPlayer.resume());
  ipcMain.handle('player:next', (_, total) => audioPlayer.next(total));
  ipcMain.handle('player:previous', () => audioPlayer.previous());
  ipcMain.handle('player:eject', () => cdDetector.eject());
  ipcMain.handle('player:setVolume', (_, vol) => audioPlayer.setVolume(vol));
  ipcMain.handle('app:quit', () => app.quit());

  // 5. 注册全局快捷键
  globalShortcut.register('Space', () => { /* 播放/暂停 */ });
  globalShortcut.register('Right', () => { /* 下一曲 */ });
  globalShortcut.register('Left', () => { /* 上一曲 */ });
  globalShortcut.register('Up', () => { /* 音量+ */ });
  globalShortcut.register('Down', () => { /* 音量- */ });
  globalShortcut.register('E', () => { /* 弹出 CD */ });

  // 6. 启动 CD 检测
  cdDetector.start();
});
```

---

### 4.5 IPC Bridge — 安全桥接 (preload.js)

**职责**：在 Main 和 Renderer 之间建立安全通信通道

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cdPlayer', {
  // 播放控制
  play: (track) => ipcRenderer.invoke('player:play', track),
  pause: () => ipcRenderer.invoke('player:pause'),
  resume: () => ipcRenderer.invoke('player:resume'),
  next: (total) => ipcRenderer.invoke('player:next', total),
  previous: () => ipcRenderer.invoke('player:previous'),
  eject: () => ipcRenderer.invoke('player:eject'),
  setVolume: (vol) => ipcRenderer.invoke('player:setVolume', vol),
  quit: () => ipcRenderer.invoke('app:quit'),

  // 监听 Main Process 事件
  onCDLoading: (cb) => ipcRenderer.on('cd:loading', cb),
  onCDReady: (cb) => ipcRenderer.on('cd:ready', (_, data) => cb(data)),
  onCDEjected: (cb) => ipcRenderer.on('cd:ejected', cb),
  onPlaying: (cb) => ipcRenderer.on('player:playing', (_, data) => cb(data)),
  onPaused: (cb) => ipcRenderer.on('player:paused', cb),
  onTrackEnded: (cb) => ipcRenderer.on('player:trackEnded', (_, data) => cb(data)),
  onProgress: (cb) => ipcRenderer.on('player:progress', (_, data) => cb(data)),
});
```

---

### 4.6 Renderer Process — 界面组件架构

```
index.html
├── #app-container
│   ├── #vinyl-section (左侧 60%)
│   │   ├── .vinyl-turntable        — 转盘底座(木纹质感)
│   │   ├── .vinyl-disc             — 黑胶唱片(旋转)
│   │   │   ├── .disc-grooves       — 唱片沟槽纹理
│   │   │   ├── .disc-reflection    — 反光效果
│   │   │   └── .disc-label         — 中心封面(圆形)
│   │   ├── .tonearm                — 唱针臂
│   │   │   ├── .tonearm-base       — 唱针底座
│   │   │   ├── .tonearm-arm        — 唱针臂杆
│   │   │   └── .tonearm-head       — 唱针头
│   │   └── .progress-bar           — 底部进度条
│   │
│   ├── #tracklist-section (右侧 40%)
│   │   ├── .album-info             — 专辑名+艺术家
│   │   ├── .track-list             — 曲目列表(可滚动)
│   │   │   └── .track-item × N     — 单个曲目
│   │   └── .now-playing            — 当前播放信息
│   │
│   ├── #controls-bar (底部)
│   │   ├── .btn-previous           — 上一曲
│   │   ├── .btn-play-pause         — 播放/暂停
│   │   ├── .btn-next               — 下一曲
│   │   ├── .volume-slider          — 音量滑块
│   │   └── .btn-eject              — 弹出 CD
│   │
│   ├── #settings-panel (隐藏, 点击设置按钮展开)
│   │   └── .btn-quit               — 退出应用按钮
│   │
│   └── #idle-screen (待机画面, CD未插入时显示)
│       ├── .idle-vinyl             — 空转唱片动画
│       └── .idle-message           — "请插入 CD"
```

---

## 五、项目目录结构

```
MacbookMusicPlayer/
├── docs/
│   ├── product-plan.md              # 产品方案 (已存档)
│   └── technical-architecture.md    # 技术方案 (本文档)
│
├── package.json
├── electron-builder.yml
├── setup.sh                         # macOS 一键配置脚本
│
├── src/
│   ├── main/                        # ===== Electron 主进程 =====
│   │   ├── main.js                  # 入口：窗口+IPC+快捷键
│   │   ├── preload.js               # IPC 安全桥接
│   │   ├── cd-detector.js           # CD 插入/弹出检测
│   │   ├── metadata-service.js      # MusicBrainz + CoverArt
│   │   └── audio-player.js          # CD 音频播放控制
│   │
│   └── renderer/                    # ===== Electron 渲染进程 =====
│       ├── index.html               # 主页面
│       │
│       ├── css/
│       │   ├── variables.css        # CSS 变量 (配色/字体/尺寸)
│       │   ├── main.css             # 全局样式 + 布局
│       │   ├── vinyl.css            # 黑胶唱片样式与动画
│       │   ├── tonearm.css          # 唱针样式与动画
│       │   ├── tracklist.css        # 曲目列表样式
│       │   ├── controls.css         # 播放控制栏样式
│       │   ├── idle.css             # 待机画面样式
│       │   └── settings.css         # 设置面板样式
│       │
│       ├── js/
│       │   ├── app.js               # 应用主逻辑 + 状态管理
│       │   ├── vinyl-animator.js    # 唱片旋转+反光动画
│       │   ├── tonearm-animator.js  # 唱针动画控制
│       │   ├── track-manager.js     # 曲目列表管理
│       │   ├── controls.js          # 播放控制交互
│       │   ├── color-extractor.js   # 封面主色提取(氛围光)
│       │   └── idle-screen.js       # 待机画面逻辑
│       │
│       └── assets/
│           ├── textures/
│           │   ├── wood-dark.jpg    # 深色木纹背景
│           │   └── vinyl-groove.png # 唱片沟槽纹理
│           ├── images/
│           │   └── default-cover.jpg# 默认封面(无网络时)
│           ├── icons/
│           │   ├── play.svg
│           │   ├── pause.svg
│           │   ├── next.svg
│           │   ├── prev.svg
│           │   ├── eject.svg
│           │   ├── volume.svg
│           │   └── settings.svg
│           └── fonts/               # 复古衬线字体
│
└── scripts/
    └── install-deps.sh              # 安装依赖脚本
```

---

## 六、数据流与状态机

### 6.1 应用状态机

```
  ┌──────────┐  CD插入   ┌──────────┐  元数据就绪  ┌──────────┐
  │   IDLE   │─────────►│ LOADING  │────────────►│ PLAYING  │
  │  待机中   │          │ 加载中    │              │  播放中   │
  └──────────┘          └──────────┘              └────┬─────┘
       ▲                     │                         │  │
       │    CD弹出           │ CD弹出              暂停│  │切歌
       │◄────────────────────┘                         ▼  │
       │                                         ┌─────────┤
       │              CD弹出                      │ PAUSED  │
       │◄─────────────────────────────────────────│ 已暂停   │
       │                                          └─────────┘
```

### 6.2 IPC 通信协议

| 方向 | 频道 | 数据 | 触发时机 |
|------|------|------|----------|
| Main→Renderer | `cd:loading` | `{}` | CD 插入，开始读取 |
| Main→Renderer | `cd:ready` | `{album, artist, coverUrl, tracks[]}` | 元数据获取完成 |
| Main→Renderer | `cd:ejected` | `{}` | CD 弹出 |
| Main→Renderer | `player:playing` | `{track, duration}` | 开始播放某曲目 |
| Main→Renderer | `player:paused` | `{}` | 暂停 |
| Main→Renderer | `player:progress` | `{currentTime, duration}` | 每秒更新进度 |
| Main→Renderer | `player:trackEnded` | `{track}` | 某曲目播放完毕 |
| Renderer→Main | `player:play` | `trackNumber` | 用户点击播放 |
| Renderer→Main | `player:pause` | - | 用户点击暂停 |
| Renderer→Main | `player:next` | `totalTracks` | 下一曲 |
| Renderer→Main | `player:previous` | - | 上一曲 |
| Renderer→Main | `player:eject` | - | 弹出 CD |
| Renderer→Main | `player:setVolume` | `0-100` | 调节音量 |
| Renderer→Main | `app:quit` | - | 退出应用 |

---

## 七、开机自启与 Kiosk 配置

### 7.1 setup.sh 一键配置脚本

```bash
#!/bin/bash
# MacBook CD Player - 一键配置脚本

APP_NAME="MacbookCDPlayer"
APP_PATH="/Applications/${APP_NAME}.app"

echo "🎵 MacBook CD 播放器 - 系统配置"
echo "================================"

# 1. 设置自动登录 (需要管理员密码)
echo "📌 步骤1: 请手动设置自动登录"
echo "   系统偏好设置 → 用户与群组 → 登录选项 → 自动登录"

# 2. 添加到登录项
echo "📌 步骤2: 添加到登录项..."
osascript -e "
  tell application \"System Events\"
    make login item at end with properties \\
      {path:\"${APP_PATH}\", hidden:false}
  end tell
"
echo "   ✅ 已添加到登录项"

# 3. 禁止屏幕休眠
echo "📌 步骤3: 设置屏幕常亮..."
sudo pmset -a displaysleep 0
sudo pmset -a sleep 0
echo "   ✅ 已禁止休眠"

# 4. 隐藏 Dock
echo "📌 步骤4: 设置 Dock 自动隐藏..."
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock autohide-delay -float 1000
killall Dock
echo "   ✅ Dock 已隐藏"

echo ""
echo "🎉 配置完成！重启后将自动进入 CD 播放器。"
echo "   退出方式: 长按 Esc 3秒 或 设置面板中的退出按钮"
```

---

## 八、依赖与兼容性矩阵

| 组件 | 版本 | 兼容 macOS 10.13 | 说明 |
|------|------|:-:|------|
| Electron | 22.x | ✅ | 最后支持 10.13 的大版本 |
| Node.js (内置) | 16.x | ✅ | Electron 22 内置 |
| Chromium (内置) | 108.x | ✅ | Electron 22 内置 |
| axios | 1.x | ✅ | HTTP 请求 |
| electron-builder | 24.x | ✅ | 打包工具 |

**零原生依赖设计**：不使用 libdiscid 等 C 库，所有 CD 操作通过 macOS 系统命令 (diskutil/drutil/afplay) 实现，避免编译问题。

---

## 九、构建与发布

### 9.1 开发命令

```bash
npm install          # 安装依赖
npm start            # 开发模式启动
npm run dev          # 带热重载的开发模式
```

### 9.2 打包发布

```bash
npm run build        # 打包为 macOS .app
# 输出: dist/MacbookCDPlayer.app
# 将 .app 拖入 /Applications 即可
```

### 9.3 electron-builder 配置

```yaml
# electron-builder.yml
appId: com.macbook.cdplayer
productName: MacbookCDPlayer
mac:
  category: public.app-category.music
  target: dir  # 直接输出 .app 目录
  icon: src/renderer/assets/icons/app-icon.icns
  minimumSystemVersion: "10.13.0"
```

---

## 十、视觉动效与细节实现

### 10.1 黑胶唱片 33⅓ RPM 旋转与缓动算法

网易云黑胶的核心在于物理质感。实体唱片标准转速为 33⅓ RPM（每分钟 33.33 转），即每转一圈约 **1.8 秒**。

#### CSS 动画与缓动控制

```css
/* vinyl.css */
.disc-container {
  width: 380px;
  height: 380px;
  border-radius: 50%;
  position: relative;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6),
              0 0 0 12px rgba(255, 255, 255, 0.03);
  transition: transform 1.2s cubic-bezier(0.25, 1, 0.5, 1);
}

/* 匀速旋转状态 */
.disc-container.spinning {
  animation: vinyl-rotate 1.8s linear infinite;
}

/* 暂停时减速停止缓动 (通过 JS 动态计算平滑过渡) */
.disc-container.stopping {
  animation-play-state: paused;
  transition: transform 1.5s cubic-bezier(0.1, 0.8, 0.3, 1);
}

@keyframes vinyl-rotate {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

#### 唱片表面纹理与反光效果

唱片沟槽（Grooves）使用 CSS `radial-gradient` 重复同心圆，反光使用 `conic-gradient` 呈现扫过的高光带：

```css
.disc-grooves {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-radial-gradient(
    #111 0px,
    #111 2px,
    #1c1c1c 3px,
    #111 4px
  );
}

.disc-reflection {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 45deg,
    rgba(255, 255, 255, 0.12) 0deg,
    transparent 40deg,
    rgba(255, 255, 255, 0.08) 180deg,
    transparent 220deg,
    rgba(255, 255, 255, 0.12) 360deg
  );
  pointer-events: none;
}
```

### 10.2 唱针摆动与物理落针动效

唱针（Tonearm）固定在右上方，以底座轴心（Transform Origin）旋转：
- **待机状态**：唱针抬起，向右偏移 30°
- **播放状态**：唱针向左摆动，落到唱片外轨（约 0°）
- **随着播放进度**：唱针缓慢向内轨微调摆动（0° ~ -8°）

```css
/* tonearm.css */
.tonearm {
  position: absolute;
  top: 40px;
  right: 120px;
  width: 100px;
  height: 220px;
  transform-origin: 30px 30px; /* 旋转轴心位于底座中心 */
  transform: rotate(-32deg);
  transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); /* 带轻微物理回弹 */
  z-index: 10;
}

/* 播放落针状态 */
.tonearm.playing {
  transform: rotate(0deg);
}

/* 随着歌曲进度的微摆 */
.tonearm.playing-track {
  transform: rotate(calc(0deg + var(--progress-angle, 0deg)));
}
```

### 10.3 封面氛围光 (Ambient Lighting)

根据专辑封面的主色调，使用 HTML Canvas 提取颜色，动态改变背景高光色彩，提供沉浸体验：

```javascript
// color-extractor.js
export function extractDominantColor(imgElement) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 50;
  canvas.height = 50;
  ctx.drawImage(imgElement, 0, 0, 50, 50);

  const imageData = ctx.getImageData(0, 0, 50, 50).data;
  let r = 0, g = 0, b = 0, count = 0;

  for (let i = 0; i < imageData.length; i += 16) { // 抽样点
    r += imageData[i];
    g += imageData[i + 1];
    b += imageData[i + 2];
    count++;
  }

  r = Math.floor(r / count);
  g = Math.floor(g / count);
  b = Math.floor(b / count);

  return `rgba(${r}, ${g}, ${b}, 0.35)`;
}
```

---

## 十一、无原生依赖 DiscID 与 TOC 计算算法

在无 `libdiscid` 原生编译件的前提下，使用 Node.js 直接解析 `diskutil` 或 `/dev/diskN` 获取的 CD TOC 扇区偏移量，计算标准的 MusicBrainz Disc ID / FreeDB Hash。

### 11.1 TOC 数据获取与解析

通过 macOS 内置工具 `drutil toc` 或执行 `cdrdao` / 系统工具可以输出原生扇区 Table of Contents (TOC)：

```javascript
// disc-id.js (纯 JS 解析示例)
const { exec } = require('child_process');
const crypto = require('crypto');

function parseTOCAndCalculateDiscID() {
  return new Promise((resolve) => {
    // 调用 drutil status 或 diskutil 获取 CD 音轨分布
    exec('drutil status', (err, stdout) => {
      if (err) return resolve(fallbackLocalHash());

      // 假设解析出的 TOC 数据
      // Track 1 Lead-in, Track offsets...
      // 根据 MusicBrainz 规范计算 SHA-1 Base64 签名
      // SHA1(First Track + Last Track + Lead-out Offset + Track 1 Offset + ...)
      
      const discId = calculateSHA1DiscID(parsedTracks);
      resolve(discId);
    });
  });
}

function fallbackLocalHash() {
  // 若获取精确 TOC 失败，生成基于音轨数与光盘总容量的本地唯一ID
  return 'LOCAL_' + Date.now();
}
```

---

## 十二、异常处理与边缘情况防护

### 12.1 硬件与系统级异常

| 异常情况 | 原因 | 自动化防护/处理机制 |
|----------|------|--------------------|
| **划伤/坏道 CD** | `afplay` 卡住或退出 | 捕获 `afplay` error/close 事件，5 秒内无法播放自动跳至下一曲并吐出 Toast 提示 |
| **开机无光盘** | 正常启动 | 保持待机静止转盘画面，显示 "请插入 CD" |
| **中途强行弹出 CD** | 用户按机器物理 eject 键 | 监听 `cd-ejected`，立即停止 `afplay` 进程，恢复待机动画，清空当前 Track 缓存 |
| **网络断开** | 无 WiFi / 无 Internet | 优雅降级：读取光盘本地音轨总数，生成 "Track 01" ~ "Track N"，使用预设经典黑胶封面 |
| **休眠唤醒** | 系统意外进入睡眠 | 在 `main.js` 中使用 `powerSaveBlocker` 阻止系统休眠，并在 `powerMonitor` 恢复事件中自动重连播放状态 |

```javascript
// main.js 中防休眠代码
const { powerSaveBlocker } = require('electron');
const id = powerSaveBlocker.start('prevent-app-suspension');
console.log('Power save blocker started:', powerSaveBlocker.isStarted(id));
```

### 12.2 Kiosk 模式防误触与安全退出

- **退出的双重保护**：
  1. 界面设置面板（右上角齿轮）提供显式的【退出应用】按钮（带确认二次弹窗）。
  2. 键盘长按快捷键：连续按住 `Esc` 键 3 秒，防止偶然误触直接退出。

```javascript
// renderer/js/app.js - 3秒长按 Esc 退出
let escTimer = null;

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !escTimer) {
    escTimer = setTimeout(() => {
      window.cdPlayer.quit();
    }, 3000); // 3000ms
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Escape') {
    clearTimeout(escTimer);
    escTimer = null;
  }
});
```

---

## 十三、工程落地与验证规范

### 13.1 部署流程 (Deployment Checklist)

1. **环境准备**：
   - 目标机 MacBook Pro (2011) 确认已安装 macOS High Sierra (10.13.6)。
   - 安装 Node.js 18 (或在开发机上编译 Electron 22 打包成品)。
2. **打包应用**：
   - 在开发机运行 `npm run build` 生成 `MacbookCDPlayer.app`。
3. **目标机安装**：
   - 将 `MacbookCDPlayer.app` 复制至 `/Applications/`。
   - 终端执行 `./setup.sh` 配置开机自启、关闭休眠、隐藏 Dock。
4. **功能验证**：
   - 重启 MacBook，验证是否在无密码自动登录后自动全屏进入播放器。
   - 插入实体 CD，验证唱盘旋转、唱针落下、音频播放、MusicBrainz 封面加载。
   - 按 `E` 键或点击弹窗测试光盘弹出。

---

*文档版本: v1.0 | 创建时间: 2026-07-27*

