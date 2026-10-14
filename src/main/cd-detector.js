const { exec } = require('child_process');
const EventEmitter = require('events');

class CDDetector extends EventEmitter {
  constructor(options = {}) {
    super();
    this.pollIntervalMs = options.pollIntervalMs || 2500;
    this.timer = null;
    this.currentDevice = null;
    this.isDevMock = options.isDevMock || false;
  }

  start() {
    if (this.timer) return;
    
    // 立即运行一次检测
    this.checkDrive();
    
    // 开启定时轮询
    this.timer = setInterval(() => {
      this.checkDrive();
    }, this.pollIntervalMs);

    console.log(`[CDDetector] 驱动检测已启动 (轮询间隔: ${this.pollIntervalMs}ms)`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[CDDetector] 驱动检测已停止');
    }
  }

  checkDrive() {
    // 如果开启了 Dev 模拟模式，则不轮询系统
    if (this.isDevMock) return;

    // 执行 macOS diskutil list 查看所有挂载的光盘
    exec('diskutil list', (error, stdout, stderr) => {
      if (error) {
        // 部分旧款机器可能抛出非零状态码或没有光驱
        return;
      }

      const detectedDisk = this.parseAudioCD(stdout);

      if (detectedDisk && !this.currentDevice) {
        // 检测到新 CD 插入
        this.currentDevice = detectedDisk;
        console.log(`[CDDetector] 💿 检测到 CD 插入: ${detectedDisk}`);
        
        // 尝试获取该 CD 的详细挂载路径和音轨列表
        this.inspectCDVolume(detectedDisk, (volInfo) => {
          this.emit('cd-inserted', {
            device: detectedDisk,
            mountPath: volInfo.mountPath || '/Volumes/Audio CD',
            trackCount: volInfo.trackCount || 10
          });
        });

      } else if (!detectedDisk && this.currentDevice) {
        // CD 被弹出
        console.log(`[CDDetector] ⏏️ CD 已弹出: ${this.currentDevice}`);
        this.currentDevice = null;
        this.emit('cd-ejected');
      }
    });
  }

  parseAudioCD(diskutilOutput) {
    // 查找包含 CD_DA 或 Audio CD / CD-DA 标识的物理卷
    // 典型输出如:
    // /dev/disk2 (external, physical):
    // #:                   TYPE NAME                    SIZE       IDENTIFIER
    // 0:                  CD_DA                        700.0 MB   disk2
    const lines = diskutilOutput.split('\n');
    let currentDiskHeader = null;

    for (const line of lines) {
      if (line.startsWith('/dev/disk')) {
        currentDiskHeader = line.split(' ')[0];
      }
      if (line.includes('CD_DA') || line.includes('Audio CD') || line.includes('CD-DA')) {
        return currentDiskHeader || '/dev/disk1';
      }
    }
    return null;
  }

  inspectCDVolume(diskDevice, callback) {
    // 查询 /Volumes 目录下挂载的 Audio CD 音轨数
    exec('ls -1 "/Volumes/Audio CD"', (err, stdout) => {
      if (err) {
        // 尝试默认音轨信息
        return callback({ mountPath: '/Volumes/Audio CD', trackCount: 12 });
      }

      const files = stdout.split('\n').filter(f => f.trim().length > 0);
      const audioFiles = files.filter(f => f.endsWith('.aiff') || f.endsWith('.wav') || f.includes('Track'));
      
      callback({
        mountPath: '/Volumes/Audio CD',
        trackCount: audioFiles.length > 0 ? audioFiles.length : 10
      });
    });
  }

  eject() {
    console.log('[CDDetector] 执行弹出 CD 指令...');
    exec('drutil eject', (error) => {
      if (error) {
        // 备用命令
        exec('diskutil eject /Volumes/Audio\\ CD 2>/dev/null || true');
      }
      this.currentDevice = null;
      this.emit('cd-ejected');
    });
  }

  // 模拟 CD 插入 / 退出 Toggle 接口 (支持打包版使用)
  triggerMockInsert(mockData) {
    if (this.currentDevice === '/dev/diskMock') {
      console.log('[CDDetector] 🧪 模拟退盘操作');
      this.currentDevice = null;
      this.emit('cd-ejected');
      return;
    }
    console.log('[CDDetector] 🧪 模拟插盘操作');
    this.currentDevice = '/dev/diskMock';
    this.emit('cd-inserted', mockData || {
      device: '/dev/diskMock',
      mountPath: '/Volumes/Audio CD',
      trackCount: 10
    });
  }

  triggerMockEject() {
    this.currentDevice = null;
    this.emit('cd-ejected');
  }
}

module.exports = CDDetector;
