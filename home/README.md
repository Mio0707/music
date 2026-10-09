# 动物乐队家庭版 H5 MVP

开发位置：Mio0707/music 的 feature/animal-band-home-mvp 分支，home/ 目录。学校版及 Qwen Skill 保持不变。

## 功能

- 学音乐：从共享 data 读取 3 个节奏模式，提供预备拍、触屏拍击与基于时间间隔的匹配评分。
- 旋律与唱名：从共享 data 选择《洋娃娃和小熊跳舞》《找朋友》《摇篮曲》，经 core 将核谱转换为事件流，试听前四小节的合成旋律；麦克风可记录演唱。
- 玩乐队：4 套创作包（快乐跳跃、温柔摇摆、勇敢向前、思念平稳），四只动物各有 WAV 分轨，支持四段八小节的开关编排。
- 8 键键盘：用网页录制两小节 MIDI 音符事件，并在乐队播放中叠加自己的旋律。
- 我的作品：用 IndexedDB 存储编曲与录音，支持重开、删除、导出 JSON，不提供用户账号和跨设备同步。

## 本地运行

需要 Node.js 20+、npm 以及两个私有 GitHub 仓库的读取权限：Mio0707/animal-band-data 和 Mio0707/animal-band-core。

切换到 feature/animal-band-home-mvp 分支，在 music 仓库的 home 目录执行：

    npm install
    npm run dev

随后浏览器打开 http://127.0.0.1:5173/ 。

构建命令：

    npm run build

源仓库为 Private，npm 安装 git 依赖需要开发电脑配置有效的 GitHub SSH 或 HTTPS 访问凭据。代码中没有密钥。不要让用户浏览器请求私有 GitHub Raw 地址。

### 原始音乐与贴纸素材

dev/build 前自动调用 scripts/stage-legacy-assets.mjs。源码资源来自旧 music 仓库固定 Git commit，具体 SHA-1 和字节长度在 assets/legacy-source.json 中锁定。脚本优先验证已缓存文件；若在原音乐仓库工作区，优先使用经过哈希验证的原版本地文件；在独立 animal-band-home 仓库或单独下载 ZIP 中则自动经 GitHub Raw 下载固定版本的 22 个文件，并验证 Git blob SHA。**不依赖原仓库存在于相邻目录。** 生成产物位于 public/generated/ 并被 gitignore 排除。

### 共享依赖

- @animal-band/data：Mio0707/animal-band-data，固定 commit 81a782ca99f6ca98ad5ee413872264cd6719a73c。
- @animal-band/core：Mio0707/animal-band-core，固定 commit 60e5b74a676221d703ac7f51194e5d900f220b84。
- 乐谱、编曲和节奏 JSON 来自 data 包；底层音乐转换和时间计算由 core 包提供；家庭交互层保留在 home/src。

## 当前限制

1. 本阶段仅选择少量内容做端到端流程，data 库中仍有 10 首歌曲和 16 套创作包。
2. 原核谱中的反复、倚音、喊声、二声部等结构未全部完善；源审核状态不等于对外发布就绪。
3. 旋律示范采用浏览器合成音，不是真人唱名；不自动评价歌声音准。
4. 教材歌曲乐谱尚没有相应的动物 WAV 分轨，所以学唱歌曲与乐队编曲此时不是同一首作品，不能宣称按教材歌曲编曲已经实现。
5. 旧 music 的 WAV 分轨暂用于预览，正式分发要审查许可与文件部署。
6. 作品/儿童录音只在本机 IndexedDB，清理浏览器数据可能丢失，建议导出 JSON。录音需要 HTTPS 或 localhost。
7. 按用户要求：第二步即学校端、Skill 改造目前不做。

## 代码目录

- src/content.js：共享数据内容入口
- src/domain.mjs：节奏评分、作品规则、量化与保存前校验
- src/audio.js：WebAudio 演示、节奏和动物分轨调度、8 键录制
- src/storage.js：IndexedDB
- src/main.js：学音乐／玩乐队／我的作品的交互
- src/style.css：家庭端贴纸视觉
- tests/domain.test.mjs：纯算法与编曲规则单元测试
- scripts/stage-legacy-assets.mjs：原有媒体资源自动分发

## 独立仓库迁移

可以把本目录 home/ 直接作为新仓库的根目录，不需再复制原 music 任何其它目录。源码和 22 个二进制资源的哈希在 assets/legacy-source.json 中锁定。音频正式发布前建议迁至统一素材存储，减少对旧公共仓库的构建期依赖。

## 测试

当前 GitHub Actions 运行 JavaScript 语法、领域单元测试和原始资源哈希校验，含经 GitHub Raw 独立下载素材；因两个 GitHub 共享仓库为 Private，CI 暂未配置跨仓库读取凭据，**不等于完整 Vite 浏览器运行验收**。

    npm test
    npm run build

第二条需要在能访问两份 Private 依赖的开发机运行。下一步若创建 Mio0707/animal-band-home 独立仓库，可将 home/ 整体提升为新仓库根目录。
