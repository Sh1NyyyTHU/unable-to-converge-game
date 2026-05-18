# assets 目录

这个目录用于存放后续游戏素材，例如：

- 背景图片
- 角色头像
- UI 图标
- 按钮贴图
- 音效文件
- 背景音乐
- 分享二维码图片

当前版本暂不依赖真实素材，所有场景、角色、按钮和界面元素都由 `script.js` 使用 Canvas 2D API 绘制。

## backgrounds

`backgrounds/` 目录中存放当前版本使用的 AI 场景背景图：

- `start.png`：开始页
- `day1-network.png`：第 1 天白天，修电脑网络
- `day2-document.png`：第 2 天白天，修改工作文档
- `day3-room.png`：第 3 天白天，整理房间
- `day4-presentation.png`：第 4 天白天，准备汇报
- `night1-family.png`：第 1 天夜晚，家庭对话
- `night2-friend.png`：第 2 天夜晚，朋友聊天
- `night3-work.png`：第 3 天夜晚，工作沟通
- `night4-intimacy.png`：第 4 天夜晚，亲密关系对话
- `ending.png`：结局页

这些图片由 `script.js` 预加载，并在对应场景作为 Canvas 背景绘制。后续如果要替换图片，保持同名文件即可。

## audio

`audio/` 目录中存放当前版本使用的背景音乐：

- `day.m4a`：白天场景 BGM
- `night.m4a`：夜晚场景 BGM

游戏开始后，进入白天场景会自动播放 `day.m4a`，进入夜晚场景会自动切换为 `night.m4a`。开始页和结局页默认停止播放。
