# 斗地主单机版

这是一个基于 Electron 开发的 Windows 桌面斗地主单机游戏，包含经典叫地主和出牌规则、双 AI 对战、成就系统、积分持久化、随机背景音乐和全屏游戏界面。

## 功能特性

- 经典斗地主玩法：叫分、抢地主、炸弹、火箭、春天、反春天和倍数结算。
- 单人对战两名电脑 AI，支持难度设置。
- 标题界面包含开始游戏、设置、成就和退出游戏。
- 默认全屏启动，并支持在设置中切换窗口化/全屏。
- 手牌支持拖拽自由排序、右键取消选中、智能提示和一键理牌。
- 自动保存统计数据、成就、设置和累计积分。
- 内置多首 CC0 授权背景音乐，随机循环播放。
- 使用 `electron-builder` 打包 Windows 安装程序。

## 技术栈

- Electron
- 原生 HTML、CSS、JavaScript
- Web Audio API 音效
- Electron IPC 本地 JSON 存储

## 安装与运行

安装依赖：

```powershell
npm install
```

开发模式运行：

```powershell
npm.cmd start
```

部分 Windows 环境会限制 `npm.ps1` 执行，因此推荐使用 `npm.cmd`。

## 打包 EXE

生成 Windows 安装包：

```powershell
npm.cmd run build
```

打包产物：

- 安装包：`build/斗地主 Setup 1.0.0.exe`
- 免安装程序：`build/win-unpacked/斗地主.exe`

## 测试

运行完整集成测试：

```powershell
node test-full.js
```

运行核心规则测试：

```powershell
node test-core.js
```

## 项目结构

```text
.
├── assets/
│   └── audio/              # 内置 CC0 背景音乐
├── renderer/
│   ├── css/                # 牌桌、卡牌、动画和弹窗样式
│   ├── js/                 # 游戏规则、AI、UI、音效和存储逻辑
│   └── index.html          # 渲染进程入口
├── main.js                 # Electron 主进程
├── preload.js              # 安全 IPC 桥接
├── package.json
├── test-core.js
└── test-full.js
```

## 音频授权

内置背景音乐来自 OpenGameArt，均标注为 CC0/public domain。来源链接和授权信息见 `assets/audio/LICENSES.md`。

## 许可证

MIT
