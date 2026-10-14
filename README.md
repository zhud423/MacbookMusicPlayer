# 🎵 MacBook Retro Vinyl CD Player (MacBook 复古黑胶 CD 播放器)

> 将闲置老 MacBook（带内置或外接光驱）改造为专属实体 CD 唱片机。插入 CD 自动识别、拉取封面与专辑信息，以网易云经典黑胶复古动效全屏沉浸播放。

---

## ✨ 核心特性

- 💿 **插入即播**：监听系统光驱事件，插入 CD 自动挂载并计算 DiscID。
- 🌐 **智能元数据**：自动通过 MusicBrainz API 与 Cover Art Archive 检索专辑名称、歌手、封面图与曲目列表。
- 🎨 **复古黑胶美学**：
  - 经典拟物风黑胶转盘（伴随转动光泽与微晃感）
  - 动态机械唱针联动（起针、落针沉浸式音画同步）
  - 唱片内圈自适应专辑封面与动态背景光晕
- 🖥️ **Kiosk 沉浸模式**：开机全屏无边框，隐藏菜单栏与 Dock，专机专用。
- ⌨️ **便捷快捷键**：
  - `Space`：播放 / 暂停
  - `←` / `→`：上一曲 / 下一曲
  - `↑` / `↓`：音量调节
  - `E`：弹出光驱
  - `Esc`（长按 3 秒）：退出全屏 / 设置窗口

---

## 🛠️ 技术架构

- **桌面运行时**：[Electron](https://www.electronjs.org/)
- **系统层交互**：macOS 原生 `diskutil` + 硬件音量/音频通道管理
- **CD 识别**：libdiscid 算法 + MusicBrainz API
- **UI & 动效**：原生 HTML5 / CSS3 / Web Audio API

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 本地开发与预览

```bash
npm run dev
# 或
npm start
```

### 3. 应用打包构建 (macOS)

```bash
npm run build
```

打包完成后，安装包将输出至 `dist/mac/MacbookCDPlayer.app`。

---

## ⚙️ 一键系统配置 (专机模式)

若希望将闲置 MacBook 彻底改装为免交互音响主机，可执行内置的配置脚本：

```bash
chmod +x ./setup.sh
./setup.sh
```

脚本将自动配置：
1. 阻止屏幕与硬盘进入深度睡眠；
2. 开启极速隐藏 Dock；
3. 将应用加入 macOS 开机自启登录项。

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE)。
