# 动物乐队设计台

## 当前生产流程

平台不再把 16 个“心情 × 律动”当作互相独立的音乐生成任务，而是采用主题改编结构：

1. 选择开心、放松、勇敢或想念。
2. 审核心情母版提示词，由 `Qwen3.7-Max` 生成核心旋律、和声家族、旋律习惯、力度与乐句表达。
3. 检查并锁定心情主题 JSON。母版锁定后才开放该心情的四个律动。
4. 选择稳稳走、蹦蹦跳、摇一摇或向前冲。平台自动把项目规范、心情母版、律动模板和组合适配规则拼成提示词。
5. 由 `Qwen3.7-Max` 生成完整音乐 JSON，自动检查核心旋律继承、节拍、音域与萨克斯规则。
6. 生成整段试听；确认后再生成小熊、小猫、小狗和小狮子的正式分轨。

每个心情母版只锁定一次，每个组合只制作一次。这样同一心情的四个律动版本会继承同一段核心旋律和和声语言。

## 信息保存位置

- 项目总规范：`audio-production/knowledge/project.json`
- 四种律动模板：`audio-production/knowledge/grooves.json`
- 动物乐器规则：`audio-production/knowledge/instruments.json`
- 16 种组合适配：`audio-production/knowledge/combinations.json`
- 已锁定心情母版：`audio-production/knowledge/themes/`
- AI 心情草案：`audio-production/studio-data/theme-drafts/`
- 音乐制作记录：`audio-production/studio-data/records/`
- 正式分轨任务：`audio-production/studio-data/jobs/`

调用千问前，需要在运行服务的电脑或云端设置 `DASHSCOPE_API_KEY`。密钥只由服务端读取，不能写进网页、JSON 或 Git。

## 启动方式

在项目根目录双击 `启动音乐分轨台.cmd`，浏览器会自动打开 `http://127.0.0.1:8765`。启动后不要关闭本地处理窗口。

## 分轨与调音

生成正式分轨后，可以：

1. 播放四条同步轨道并调整各自动物音量。
2. 使用静音或独奏检查单条轨道。
3. 为小熊键盘切换试听音色。
4. 导出单条 WAV 或当前混音 WAV。
5. 从历史分轨中重新打开，不必重复生成。

小狮子使用中音萨克斯。AI 必须直接写出它的具体音符、拍点、时值和力度，程序不再把文字说明当作演奏结果。

## 面向他人使用

使用者不需要安装 Python、FluidSynth 或音色库；这些组件应运行在平台服务端。公开使用前还需要接入登录、权限、用量限制和对象存储访问控制。
