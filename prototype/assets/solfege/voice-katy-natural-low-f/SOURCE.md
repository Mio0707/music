# Katy 自然低音唱名包（F 调课程专用）

本目录由项目现有 Katy 唱名素材离线派生，用于《东方红》F 调课程中的三个低音：

- `sol.wav`：C4（261.626 Hz）
- `la.wav`：D4（293.665 Hz）
- `si.wav`：E4（329.628 Hz）

`sol`、`la` 来自 `../voice-katy/` 原声音色；`si` 来自 `../voice-katy-child-clean-v2/si.wav`，保留已经校正的“si”发音。处理采用时域基音同步叠加，使音高降低时尽量保留原有声线和时长，避免浏览器直接减慢播放造成的粗重、发闷。

生成脚本：`audio-production/scripts/create_natural_low_solfege.py`

原始素材作者、来源及 CC BY 4.0 授权信息见 `../voice-katy/SOURCE.md`。派生素材继续保留原作者 digifishmusic 的署名要求。
