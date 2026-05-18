# 无法收敛

《无法收敛》是一个使用原生 HTML、CSS、JavaScript 和 Canvas 2D API 制作的轻量叙事解谜网页游戏。

游戏采用“白天 / 夜晚”双场景循环：白天处理可以被拆解和验证的生活工作问题，夜晚面对不断偏移的人际误解。玩家通过点击按钮推进 4 天剧情，最终根据表达清晰度、对方理解率、解释成本和自我保留度进入不同结局。

## 文件结构

```text
unable-to-converge-game/
├── index.html
├── style.css
├── script.js
├── README.md
└── assets/
    ├── audio/
    │   ├── day.m4a
    │   └── night.m4a
    └── README.md
```

- `index.html`：网页入口，只包含 Canvas 和简单说明。
- `style.css`：页面居中、深色背景、响应式 Canvas 样式。
- `script.js`：游戏主逻辑，包括状态管理、场景绘制、按钮点击、数值系统和结局判断。
- `assets/audio/day.m4a`：白天场景背景音乐。
- `assets/audio/night.m4a`：夜晚场景背景音乐。
- `assets/README.md`：后续素材目录说明。

## 用 VS Code 打开

1. 打开 VS Code。
2. 选择 `File` -> `Open Folder...`。
3. 选择 `unable-to-converge-game` 文件夹。
4. 在左侧文件列表中打开 `index.html`、`style.css` 或 `script.js` 进行编辑。

## 使用 Live Server 本地运行

1. 在 VS Code 扩展市场搜索并安装 `Live Server`。
2. 打开 `index.html`。
3. 右键编辑器空白处，选择 `Open with Live Server`。
4. 浏览器会打开一个本地地址，例如：

```text
http://127.0.0.1:5500/index.html
```

如果没有安装 Live Server，也可以直接双击 `index.html`，游戏仍然可以运行。

## 部署到 GitHub Pages

1. 登录 GitHub。
2. 点击右上角 `+`，选择 `New repository`。
3. 输入仓库名称，例如 `unable-to-converge-game`。
4. 创建仓库后，把本项目中的这些文件上传到仓库根目录：
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
   - 整个 `assets/` 文件夹
5. 进入仓库页面，点击 `Settings`。
6. 在左侧找到 `Pages`。
7. 在 `Build and deployment` 区域中，`Source` 选择 `Deploy from a branch`。
8. `Branch` 选择 `main`，目录选择 `/root`，然后点击 `Save`。
9. 等待一两分钟，GitHub Pages 会生成一个网页链接，例如：

```text
https://你的用户名.github.io/unable-to-converge-game/
```

打开这个链接后，别人就可以直接在浏览器中游玩。

## 生成二维码分享

1. 复制 GitHub Pages 生成的网页链接。
2. 打开任意在线二维码生成器。
3. 粘贴链接并生成二维码。
4. 下载二维码图片后即可分享。

后续也可以把二维码图片放入 `assets/` 目录，并在页面中增加分享入口。

## 后续扩展建议

- 在 `assets/` 中加入背景图、角色头像或音效。
- 在 `script.js` 的 `DAY_TASKS` 和 `NIGHT_DIALOGUES` 中扩展更多天数和剧情。
- 增加存档、章节选择、音量控制等功能。
- 为不同结局添加专属画面和音乐。
