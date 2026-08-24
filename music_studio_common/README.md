# 音乐制作公共模块

这里是原始 4 × 4 音乐生产台与新版儿童音乐设计台的单一公共实现。

## 内容

- `server.py`：JSON 生成、自动修复、校验、试听、分轨、混音、发布和 HTTP API。
- `scripts/`：两套工作台共同使用的模型调用、MIDI、WAV、混音和校验脚本。
- `knowledge/`：项目规范、心情母版、律动、动物乐器与组合规则。

两个产品入口仍然保留：

- `audio-production/studio/server.py` 配置旧版 4 × 4 制作台，默认端口 8765。
- `children-music-studio/studio/server.py` 配置新版儿童音乐设计台，默认端口 8766。
- `prototype/server.py` 挂载新版设计台，并统一从 4174 端口提供教师备课平台。

新增公共生产能力时应优先修改这里，不要把相同脚本重新复制到产品目录。
