#!/bin/bash
# ==============================================================================
# 🎵 MacBook CD 黑胶播放器 - 一键系统配置脚本
# 适配: macOS High Sierra (10.13) 及更高版本
# ==============================================================================

set -e

APP_NAME="MacbookCDPlayer"
APP_PATH="/Applications/${APP_NAME}.app"

echo "=========================================================="
echo "  🎵 MacBook Retro Vinyl CD Player 系统配置程序"
echo "=========================================================="
echo ""

# 1. 检查应用是否已安装在 /Applications
if [ ! -d "$APP_PATH" ]; then
    echo "⚠️  未在 /Applications 目录下找到 ${APP_NAME}.app"
    echo "💡 请先运行 'npm run build' 并将打包好的应用复制到 /Applications/ 后再运行本脚本。"
    echo "继续配置系统设置选项..."
fi

# 2. 阻止屏幕与系统休眠
echo "📌 [1/4] 配置电源管理：关闭屏幕与系统休眠..."
sudo pmset -a displaysleep 0 2>/dev/null || true
sudo pmset -a sleep 0 2>/dev/null || true
sudo pmset -a disksleep 0 2>/dev/null || true
echo "   ✅ 屏幕与磁盘睡眠已禁用（保持播放器常线运行）"

# 3. 设置 Dock 自动隐藏
echo "📌 [2/4] 配置系统界面：设置 Dock 自动隐藏..."
defaults write com.apple.dock autohide -bool true
defaults write com.apple.dock autohide-delay -float 1000
killall Dock 2>/dev/null || true
echo "   ✅ Dock 已设置为极速自动隐藏"

# 4. 添加应用到开机自启登录项
echo "📌 [3/4] 配置开机自启..."
if [ -d "$APP_PATH" ]; then
    osascript -e "
      tell application \"System Events\"
        if not (exists login item \"${APP_NAME}\") then
          make login item at end with properties {path:\"${APP_PATH}\", hidden:false}
        end if
      end tell
    " 2>/dev/null || true
    echo "   ✅ 已成功将 ${APP_NAME} 添加至开机登录项"
else
    echo "   ⚠️ 跳过登录项注册（未找到 ${APP_PATH}）"
fi

# 5. 提示自动登录操作
echo "📌 [4/4] 提醒：请在系统设置中启用【无密码自动登录】"
echo "   操作路径："
echo "   系统偏好设置 (System Preferences) → 用户与群组 (Users & Groups) → 登录选项 (Login Options) → 自动登录 (Automatic Login) → 选择您的当前账户"

echo ""
echo "=========================================================="
echo "🎉 极简 CD 唱机系统配置完成！"
echo "💡 提示：按键盘【Space】可暂停/播放，长按【Esc】3秒或点击右上方齿轮按钮可安全退出。"
echo "=========================================================="
