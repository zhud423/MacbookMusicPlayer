const { spawn, exec } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class AudioPlayer extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.currentTrack = 1;
    this.totalTracks = 10;
    this.isPlaying = false;
    this.isPaused = false;
    this.volume = 80; // 默认音量 80%
    this.currentTime = 0;
    this.duration = 210; // 默认 3分30秒
    this.progressTimer = null;
    this.mountPath = '/Volumes/Audio CD';
  }

  setMountPath(path) {
    this.mountPath = path || '/Volumes/Audio CD';
  }

  setTotalTracks(total) {
    this.totalTracks = total || 10;
  }

  play(trackNumber = 1) {
    this.stopProcessOnly();

    this.currentTrack = Math.max(1, Math.min(trackNumber, this.totalTracks));
    this.currentTime = 0;
    this.isPlaying = true;
    this.isPaused = false;

    console.log(`[AudioPlayer] ▶️ 开始播放音轨 Track ${this.currentTrack}/${this.totalTracks}`);

    // 搜索音轨文件路径
    const trackFile = this.findTrackFile(this.currentTrack);

    if (trackFile && fs.existsSync(trackFile)) {
      console.log(`[AudioPlayer] 使用系统 afplay 播放实体文件: ${trackFile}`);
      this.process = spawn('afplay', [trackFile]);

      this.process.on('close', (code) => {
        if (code === 0 && this.isPlaying && !this.isPaused) {
          console.log(`[AudioPlayer] 🎵 Track ${this.currentTrack} 播放结束，自动播放下一首...`);
          this.next();
        }
      });

      this.process.on('error', (err) => {
        console.warn('[AudioPlayer] afplay 执行异常:', err.message);
      });
    } else {
      console.log(`[AudioPlayer] 模拟模式播放 Track ${this.currentTrack}`);
    }

    // 启动每秒进度更新计时器
    this.startProgressTimer();
    this.emit('playing', {
      track: this.currentTrack,
      currentTime: this.currentTime,
      duration: this.duration
    });
  }

  pause() {
    if (!this.isPlaying || this.isPaused) return;

    console.log(`[AudioPlayer] ⏸ 暂停播放 Track ${this.currentTrack}`);
    this.isPaused = true;

    if (this.process) {
      try {
        this.process.kill('SIGSTOP'); // 给 afplay 进程发送暂停信号
      } catch (e) {}
    }

    this.stopProgressTimer();
    this.emit('paused', { track: this.currentTrack });
  }

  resume() {
    if (!this.isPlaying || !this.isPaused) {
      this.play(this.currentTrack);
      return;
    }

    console.log(`[AudioPlayer] ▶️ 恢复播放 Track ${this.currentTrack}`);
    this.isPaused = false;

    if (this.process) {
      try {
        this.process.kill('SIGCONT'); // 恢复进程
      } catch (e) {}
    }

    this.startProgressTimer();
    this.emit('resumed', { track: this.currentTrack });
  }

  stop() {
    console.log('[AudioPlayer] ⏹ 停止播放');
    this.stopProcessOnly();
    this.isPlaying = false;
    this.isPaused = false;
    this.currentTime = 0;
    this.stopProgressTimer();
    this.emit('stopped');
  }

  stopProcessOnly() {
    if (this.process) {
      try {
        this.process.kill('SIGTERM');
      } catch (e) {}
      this.process = null;
    }
  }

  next() {
    const nextTrack = (this.currentTrack >= this.totalTracks) ? 1 : this.currentTrack + 1;
    this.play(nextTrack);
  }

  previous() {
    const prevTrack = (this.currentTrack <= 1) ? this.totalTracks : this.currentTrack - 1;
    this.play(prevTrack);
  }

  setVolume(volumePercent) {
    this.volume = Math.max(0, Math.min(100, volumePercent));
    console.log(`[AudioPlayer] 🔊 调整系统音量: ${this.volume}%`);
    
    // 使用 macOS osascript 原生调整系统声音
    exec(`osascript -e "set volume output volume ${this.volume}"`, (err) => {
      if (err) {
        console.warn('[AudioPlayer] 调整音量失败:', err.message);
      }
    });
    this.emit('volume-changed', this.volume);
  }

  startProgressTimer() {
    this.stopProgressTimer();
    this.progressTimer = setInterval(() => {
      if (this.isPlaying && !this.isPaused) {
        this.currentTime += 1;
        if (this.currentTime >= this.duration) {
          this.currentTime = 0;
          if (!this.process) {
            // 在模拟模式下自动切歌
            this.next();
            return;
          }
        }
        this.emit('progress', {
          currentTime: this.currentTime,
          duration: this.duration,
          percent: Math.min(100, (this.currentTime / this.duration) * 100)
        });
      }
    }, 1000);
  }

  stopProgressTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  findTrackFile(trackNum) {
    if (!fs.existsSync(this.mountPath)) return null;

    const padded = String(trackNum).padStart(2, '0');
    try {
      const files = fs.readdirSync(this.mountPath);
      // 常见模式: "01 Track 01.aiff", "Track 01.aiff", "01.aiff"
      const matched = files.find(f => 
        f.startsWith(`${padded} `) || 
        f.includes(`Track ${padded}`) ||
        f.startsWith(`${trackNum} `)
      );

      if (matched) {
        return path.join(this.mountPath, matched);
      }
    } catch (e) {}

    return null;
  }
}

module.exports = AudioPlayer;
