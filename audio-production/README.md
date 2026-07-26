# 音乐骨架与 MIDI 本地流程

这个目录只负责把一份经过审核的音乐骨架变成标准 MIDI；它不会在网页运行时生成音乐。

## 第一次准备

```powershell
python -m pip install -r audio-production/requirements.txt
```

百炼 CLI 已安装并完成控制台登录。JSON Mode 脚本只从本机环境变量 `DASHSCOPE_API_KEY` 读取百炼模型 API Key；不要把 Key 放进本目录、Git 或聊天。

## 纵向测试：happy_bounce_v01

1. 先预览将要交给百炼的提示词（不会调用模型）：

```powershell
python audio-production/scripts/generate_skeleton.py --task audio-production/tasks/happy_bounce_v01.json --dry-run
```

2. 配好模型 API Key 后，再生成骨架 JSON：

```powershell
python audio-production/scripts/generate_skeleton_json_mode.py --task audio-production/tasks/happy_bounce_v01.json --output audio-production/manifests/happy_bounce_v01.skeleton.json
```

3. 检查骨架是否严格符合两小节、96 BPM、4/4、C 大调与儿童音域：

```powershell
python audio-production/scripts/validate_skeleton.py --task audio-production/tasks/happy_bounce_v01.json --skeleton audio-production/manifests/happy_bounce_v01.skeleton.json
```

4. 只有检查通过后，才导出标准 MIDI：

```powershell
python audio-production/scripts/render_midi.py --skeleton audio-production/manifests/happy_bounce_v01.skeleton.json --output audio-production/midi/happy_bounce_v01.mid
```

5. 使用固定开源音源渲染 WAV 试听版：

```powershell
python audio-production/scripts/render_wav.py --fluidsynth "C:\Users\Administrator\AppData\Local\music-audio-tools\fluidsynth-v2.5.7\fluidsynth-v2.5.7-win10-x64-cpp11\bin\fluidsynth.exe" --soundfont "C:\Users\Administrator\AppData\Local\music-audio-tools\sounds\MuseScore_General.sf3" --midi audio-production/midi/happy_bounce_v01.bailian_manual_v02.mid --output audio-production/previews/happy_bounce_preview_v03_loop.wav --duration-seconds 5 --loop-crossfade-ms 20
```

当前固定音色方案：小熊使用 Grand Piano（GM 0），小猫使用 Acoustic Bass（GM 32），小狗使用标准鼓组（MIDI 通道 10），小狮子后续使用 Alto Sax（GM 65）。小兔唱名不使用乐器音色代替，后续单独制作可控的 `do/re/mi` 人声。

`--duration-seconds 5` 保证两小节严格等长；短交叉淡化把自然尾音接回开头，减少循环接缝的爆点。

6. 把确认后的总 MIDI 拆成当前已有的动物分轨：

```powershell
python audio-production/scripts/split_midi_stems.py --midi audio-production/midi/happy_bounce_v01.bailian_manual_v02.mid --output-dir audio-production/midi/stems --prefix happy_bounce_v01
```

目前会导出小熊、小猫、小狗三个 MIDI；小狮子和小兔要等各自素材完成后再加入，脚本不会用占位音色冒充它们。

## 本地分轨平台

双击项目根目录的 `启动音乐分轨台.cmd`，即可在浏览器中上传 JSON、自动生成分轨、同步循环试听、调整每轨音量，并导出当前混音。详细说明见 `audio-production/studio/README.md`。

生成 MIDI 就像先把乐队共用的总谱印好：小熊与小兔之后都必须读取同一份旋律数据，不能各唱各的。
