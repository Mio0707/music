# AI音乐母版、JSON、试听与分轨流程

本目录负责提前制作16套“心情 × 律动”音乐素材。网页运行时只播放和混音已经确认的分轨，不临时重新作曲。

完整生产规范见项目根目录的 `AUDIO_PRODUCTION.md`；平台操作说明见 `audio-production/studio/README.md`。

## 当前生产结构

```text
项目总规范
  ├─ 4个心情主题母版
  ├─ 4个律动模板
  ├─ 1套动物乐器规则
  └─ 16个组合适配规则
          ↓
平台自动生成并展示提示词
          ↓
Qwen3.7-Max生成歌曲JSON
          ↓
程序检查主题继承和音乐规则
          ↓
FluidSynth渲染整段试听
          ↓
人工确认后生成正式分轨
```

同一心情的4个律动版本共享一份核心旋律动机和和声语言。4种律动负责改变速度、重音、节奏密度、鼓点、贝斯和键盘伴奏方式。键盘、贝斯、鼓、萨克斯和小兔唱名由统一的动物乐器规则管理。

## 启动平台

在项目根目录双击 `启动音乐分轨台.cmd`，或运行：

```powershell
python audio-production/studio/server.py --open
```

默认地址为 `http://127.0.0.1:8765`。

## 平台制作步骤

1. 选择一个心情，审核平台自动生成的心情母版提示词。
2. 调用 `Qwen3.7-Max` 生成主题JSON并锁定。
3. 选择一个律动，审核平台根据多层规则拼装的组合提示词。
4. 生成完整音乐JSON。
5. 自动检查核心动机、和弦、节拍、小节、音域、唱名和萨克斯短句。
6. 生成整段试听并人工确认。
7. 生成正式分轨，调节音量并导出WAV。

## 规则与数据位置

- `../music_studio_common/knowledge/project.json`：项目总规范。
- `../music_studio_common/knowledge/grooves.json`：4个律动模板。
- `../music_studio_common/knowledge/instruments.json`：5只动物的乐器职责。
- `../music_studio_common/knowledge/combinations.json`：16个组合适配规则。
- `../music_studio_common/knowledge/themes/`：已经锁定的心情母版。
- `studio-data/theme-drafts/`：AI心情草案，本机保存，不进入Git。
- `studio-data/records/`：提示词、模型返回、JSON和试听记录，本机保存，不进入Git。
- `studio-data/jobs/`：正式分轨任务，本机保存，不进入Git。

## 模型与本地音频

模型调用只从服务端环境变量读取 `DASHSCOPE_API_KEY`。不要把密钥写入代码、提示词、JSON或Git。

试听和分轨使用本机FluidSynth与MuseScore General音色库。公开部署时，这些组件运行在服务端，网页使用者不需要安装Python或音色库。

当前可直接渲染小熊键盘、小猫贝斯、小狗鼓和小狮子中音萨克斯；小兔唱名等待专属 `do/re/mi` 人声素材。
