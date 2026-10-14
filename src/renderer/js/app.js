document.addEventListener('DOMContentLoaded', () => {
  console.log('[Renderer] 🎵 MacBook Retro Vinyl CD Player 初始化组件...');

  // 初始化子模块
  const vinylAnimator = new VinylAnimator();
  const trackManager = new TrackManager((trackNum) => {
    if (window.cdPlayer) window.cdPlayer.playTrack(trackNum);
  });

  // DOM 元素引用
  const appContainer = document.getElementById('app-container');
  const idleOverlay = document.getElementById('idle-overlay');
  const loadingOverlay = document.getElementById('loading-overlay');
  const settingsModal = document.getElementById('settings-modal');

  // 控制按钮引用
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnEject = document.getElementById('btn-eject');
  const volumeSlider = document.getElementById('volume-slider');
  const btnSettings = document.getElementById('btn-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnQuitApp = document.getElementById('btn-quit-app');
  const btnTestMock = document.getElementById('btn-test-mock');
  const btnIdleMock = document.getElementById('btn-idle-mock');

  let isPlayingState = false;

  // ===== 1. 注册按钮交互事件 =====
  if (btnPlayPause) {
    btnPlayPause.addEventListener('click', () => {
      if (window.cdPlayer) window.cdPlayer.togglePlay();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (window.cdPlayer) window.cdPlayer.previous();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (window.cdPlayer) window.cdPlayer.next();
    });
  }

  if (btnEject) {
    btnEject.addEventListener('click', () => {
      if (window.cdPlayer) window.cdPlayer.eject();
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (window.cdPlayer) window.cdPlayer.setVolume(val);
    });
  }

  // 设置面板 Modal
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });
  }

  if (btnQuitApp) {
    btnQuitApp.addEventListener('click', () => {
      if (window.cdPlayer) window.cdPlayer.quit();
    });
  }

  // 仅在 Dev 开发测试模式下展示模拟按钮，Release 正式打包自动完全隐藏
  if (window.cdPlayer && window.cdPlayer.isDev) {
    window.cdPlayer.isDev().then((isDevMode) => {
      if (isDevMode) {
        if (btnTestMock) btnTestMock.classList.remove('hidden');
        if (btnIdleMock) btnIdleMock.classList.remove('hidden');
      } else {
        if (btnTestMock) btnTestMock.classList.add('hidden');
        if (btnIdleMock) btnIdleMock.classList.add('hidden');
      }
    });
  }

  const handleMockClick = () => {
    if (window.cdPlayer) window.cdPlayer.triggerMockCD();
  };
  if (btnTestMock) btnTestMock.addEventListener('click', handleMockClick);
  if (btnIdleMock) btnIdleMock.addEventListener('click', handleMockClick);

  // 长按 Esc 3 秒退出安全机制
  let escPressTimer = null;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !escPressTimer) {
      console.log('[App] 捕获 Esc 键按压，开启 3 秒倒计时...');
      escPressTimer = setTimeout(() => {
        if (window.cdPlayer) window.cdPlayer.quit();
      }, 3000);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape' && escPressTimer) {
      clearTimeout(escPressTimer);
      escPressTimer = null;
    }
  });

  // ===== 2. 监听来自 Main Process (preload.js) 的事件 =====
  if (window.cdPlayer) {
    // CD 正在读取中
    window.cdPlayer.onCDLoading(() => {
      console.log('[Renderer] ⏳ 正在读取 CD...');
      loadingOverlay.classList.remove('hidden');
      idleOverlay.classList.add('hidden');
    });

    // CD 准备就绪并拿到元数据
    window.cdPlayer.onCDReady((metadata) => {
      console.log('[Renderer] ✨ CD 准备就绪:', metadata);
      loadingOverlay.classList.add('hidden');
      idleOverlay.classList.add('hidden');
      appContainer.classList.remove('idle-mode');

      trackManager.renderMetadata(metadata);
    });

    // CD 弹出回到待机界面
    window.cdPlayer.onCDEjected(() => {
      console.log('[Renderer] ⏏️ CD 已弹出');
      loadingOverlay.classList.add('hidden');
      idleOverlay.classList.remove('hidden');
      appContainer.classList.add('idle-mode');

      vinylAnimator.reset();
      updatePlayPauseIcon(false);
    });

    // 播放状态变更
    window.cdPlayer.onStateChange((data) => {
      console.log('[Renderer] 状态变更:', data.state, data);
      
      if (data.currentTrack) {
        trackManager.setActiveTrack(data.currentTrack);
      }

      if (data.state === 'playing' || data.state === 'resumed') {
        isPlayingState = true;
        vinylAnimator.setSpinning(true);
        updatePlayPauseIcon(true);
      } else if (data.state === 'paused' || data.state === 'stopped') {
        isPlayingState = false;
        vinylAnimator.setSpinning(false);
        updatePlayPauseIcon(false);
      }
    });

    // 播放进度每秒更新
    window.cdPlayer.onProgress((data) => {
      trackManager.updateProgress(data.currentTime, data.duration, data.percent);
      vinylAnimator.updateProgressAngle(data.percent);
    });

    // 音量同步
    window.cdPlayer.onVolumeChange((vol) => {
      if (volumeSlider) volumeSlider.value = vol;
    });
  }

  function updatePlayPauseIcon(isPlaying) {
    if (isPlaying) {
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
    } else {
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
    }
  }
});
