# DiffSinger 阿里云部署记录（二期）

> 状态：方案已记录，二期执行。当前不创建云资源、不产生阿里云费用。
>
> 目标：在备课后台按“心情 × 律动 × 古诗”生产可审核、可复用的古诗歌曲包，异步生成小兔整首人声、逐句人声和审核混音。儿童端选择古诗时只读取已经发布的资源，并与儿童作品进行本地轻量混音，不在课堂现场等待GPU生成。

## 1. 当前已经验证的能力

- DiffSinger 已在本地 `D:\DiffSinger` 部署成功。
- RTX 4060（8 GB 显存）可以完成中文歌声推理。
- 《静夜思》已经实现：88 BPM、2 小节前奏、4 句演唱、每句结尾半拍停顿、2 小节尾奏。
- 已经可以分别输出人声 WAV、伴奏 WAV 和最终混音 WAV。
- 本地适配脚本：
  - `audio-production/scripts/synthesize_jingyesi_diffsinger.py`
  - `audio-production/scripts/mix_jingyesi_diffsinger.py`

当前使用的 OpenCpop 模型只用于内部技术验证。正式上线前必须换成有明确商业授权的中文声库，或训练获得授权的“小兔歌手模型”。

## 2. 工作流职责与输入要求

### 2.1 必须先区分“旋律生成”和“歌声合成”

DiffSinger负责把已经确定的歌词、音高和时值合成为歌声，本身不负责决定一首诗应该使用什么旋律。

完整工作流分成两步：

1. **旋律母版生成**：规则引擎、旋律模型和教师共同确定歌词分句、音高、起拍、时值、停顿和换气，形成音符级母版。
2. **DiffSinger歌声合成**：工作流编排代理读取确认后的母版，生成各律动适配版，再调用DiffSinger把每个版本唱出来。

搭建和批量生产阶段由Codex承担工作流编排：Codex不替教师跳过内容确认，但负责准备输入、调用DiffSinger、收集结果和执行自动检查。

### 2.2 Codex负责的自动化步骤

收到一条确认过的旋律母版后，Codex依次完成：

1. 检查诗句、音符、BPM、拍号、调性、结构和伴奏是否齐全。
2. 把母版转换成统一歌曲JSON，并保留原始版本。
3. 根据目标律动配置调整音符起点、时值、重音、句尾停顿和换气，生成多个律动适配版。
4. 保留核心音高和乐句走向；只有规则检查发现拥挤、咬字困难或超出音域时，才生成需要教师确认的小范围修改建议。
5. 为每个适配版生成DiffSinger推理输入。
6. 开发期调用本地`D:\DiffSinger`；二期云端完成后改为调用歌声API。
7. 生成整首人声，并按统一时间轴切出四句独立人声。
8. 将各版本人声与对应参考伴奏混音，输出后台审核试听。
9. 自动检查句序、歌词缺失、音域、总长度、人声进入小节、前奏/尾奏误唱、削波和响度。
10. 生成歌曲包、检查报告和版本记录，交给教师试听确认；未经确认不发布。

### 2.3 需要提供的旋律母版

正式生产不能只提供一段WAV。优先级如下：

| 输入形式 | 是否推荐 | 用途与限制 |
| --- | --- | --- |
| 统一歌曲JSON | 最推荐 | 音高、歌词、时值、停顿和结构最清楚，可直接生成律动适配版 |
| DiffSinger工程或推理输入文件 | 可用 | 需要转换并补齐心情、律动、结构和发布信息 |
| MIDI＋逐字歌词/音节对齐 | 可用 | 必须能够确定每个字对应哪个音符，不能只给一条无歌词MIDI |
| 只有人声WAV | 只用于快速预览 | 可以做小范围变速，但无法可靠修改逐字节奏、换气和声调关系，不作为正式歌曲包母版 |

音符级母版至少需要：

- 古诗ID、诗名、作者、四句正文和确认后的普通话读音。
- 心情、母版律动、母版BPM、拍号、调性和目标年龄。
- 前奏、演唱和尾奏的小节数量。
- 每句开始小节、句尾停顿和换气拍数。
- 每个字的音高、起始拍、持续拍数及其所属诗句。
- 正式音色ID和模型版本。
- 需要生成的目标律动及目标BPM。

### 2.4 需要提供的伴奏

每个目标律动需要一份对应的审核伴奏或四条对齐分轨。伴奏要求：

- 纯伴奏，不包含旧人声或唱名。
- 与歌曲JSON使用相同拍号、BPM和八小节结构。
- 文件从第1小节第1拍开始，不能带未记录的额外倒数或空白。
- 当前模板固定为2小节前奏、4小节演唱、2小节尾奏。
- WAV优先，PCM 44.1 kHz或48 kHz；同一歌曲包内统一采样率。
- 如果提供分轨，所有分轨必须等长、同起点并保持动物出场数据不变。

### 2.5 母版到多个律动的处理原则

- 同一律动只改变速度，且BPM变化在约±10%以内时，可以直接按拍缩放音符时值，再重新合成人声。
- 跨律动时不能只对最终WAV做倍速。稳稳走、蹦蹦跳、摇一摇和向前冲需要各自的节奏、重音和换气适配。
- 核心旋律音高优先保持不变；节奏适配优先改变起拍、时值、弱起、句尾长音和停顿。
- 摇摆版本要在音符级时间中表达摇摆关系，不能把稳定型WAV简单减速。
- 每个适配版都重新调用DiffSinger，并单独生成完整人声、四句人声和审核混音。
- 任一版本出现歌词听不清、连续大跳、音域超限或换气不足时，只标记该版本需要修改，不影响其他已通过版本。

### 2.6 一次任务的最小输入清单

开始生成前，至少确认以下内容：

- [ ] 一首审核古诗及正确读音。
- [ ] 一份音符级旋律母版，而不是只有WAV。
- [ ] 母版BPM、拍号、调性和2＋4＋2结构。
- [ ] 目标律动与各自BPM。
- [ ] 每个目标律动对应的八小节伴奏。
- [ ] 正式或内部测试用的DiffSinger音色ID。
- [ ] 输出目录、歌曲包版本号和是否允许覆盖旧版本。

## 3. 二期推荐架构

```text
备课后台
   ↓ 提交生成任务
歌声 API（FastAPI）
   ↓
任务队列（初期可单任务串行，后期使用 Redis）
   ↓
DiffSinger GPU Worker（模型常驻显存）
   ↓
人声 WAV
   ↓
自动混音（参考伴奏 + 人声，用于后台审核）
   ↓
阿里云 OSS
   ↓ 返回试听地址与歌曲包清单
备课后台
   ↓ 人工确认并发布
儿童端候选诗库
```

首版采用异步任务，不要求老师一直停留在生成页面。模型在服务启动时只加载一次，每次请求不重复加载。

## 4. 云产品选择

### 二期 MVP：GPU ECS

优先使用 GPU ECS，便于安装、调试和查看日志。

建议起步配置：

- Linux 系统；
- NVIDIA T4 16 GB，或 A10/vGPU 8 GB 以上；
- 4～8 核 CPU；
- 16 GB 以上内存；
- 50～100 GB ESSD；
- Alibaba Cloud Linux 3 GPU 预装镜像；
- Docker 和 NVIDIA Container Toolkit。

本地 8 GB 显存已经验证可推理，所以二期无需一开始购买多卡或高端训练服务器。

### 后续扩容：PAI-EAS

老师数量和并发量明显增加后，再将同一个 Docker 镜像部署到 PAI-EAS。EAS 支持自定义镜像、HTTP/gRPC、GPU资源、监控和自动扩缩容。

注意：普通自定义 DiffSinger 服务通常按资源占用时间计费，不是单纯按生成次数计费。可以设置工作时间扩容、夜间缩容到 0，但重新启动会有模型冷启动时间。

## 5. 部署前必须确认

- [ ] 确定阿里云地域，ECS、ACR、OSS尽量保持同地域。
- [ ] 确定预计同时生成任务数和每天任务量。
- [ ] 确定正式“小兔歌手”模型及商业授权。
- [ ] 确定古诗、伴奏和生成音频的保存周期。
- [ ] 确定备课后台使用的登录鉴权方式。
- [ ] 确定是否允许老师输入任意文本，还是只选择审核后的古诗库。

## 6. 推荐部署步骤

### 第一步：整理服务输入格式

备课后台不直接上传任意 MIDI 让服务猜测，而是提交统一的歌曲 JSON。旋律生成和教师校对发生在DiffSinger之前；DiffSinger只负责把已经确认的歌词、音高和时值唱出来：

```json
{
  "poemId": "jingyesi",
  "mood": "miss",
  "masterGroove": "steady",
  "bpm": 88,
  "meter": "4/4",
  "key": "C",
  "voiceId": "rabbit_v1",
  "structure": {
    "introBars": 2,
    "vocalBars": 4,
    "outroBars": 2
  },
  "targetGrooves": [
    { "groove": "steady", "bpm": 88, "accompanimentId": "longing_steady_v01" },
    { "groove": "bounce", "bpm": 96, "accompanimentId": "longing_bounce_v01" },
    { "groove": "sway", "bpm": 84, "accompanimentId": "longing_sway_v01" },
    { "groove": "drive", "bpm": 108, "accompanimentId": "longing_drive_v01" }
  ],
  "lines": [
    {
      "text": "床前明月光",
      "startBar": 3,
      "breathAfterBeats": 0.5,
      "notes": [
        {
          "lyric": "床",
          "pitch": "G4",
          "startBeat": 0,
          "durationBeats": 0.5
        }
      ]
    }
  ]
}
```

音符、歌词、停顿和伴奏都以这一份 JSON 为准，避免 MIDI、页面和合成脚本出现多个不同版本。

### 第二步：封装 DiffSinger API

建议接口：

```text
POST /v1/singing/jobs          创建歌声任务
GET  /v1/singing/jobs/{id}     查询任务状态
GET  /health                   健康检查
GET  /ready                    模型是否加载完成
```

创建任务后立即返回 `jobId`：

```json
{
  "jobId": "sing_20260809_001",
  "status": "queued"
}
```

完成后返回：

```json
{
  "jobId": "sing_20260809_001",
  "status": "completed",
  "packageUrl": "https://oss.example/package.json",
  "variants": [
    {
      "groove": "steady",
      "bpm": 88,
      "vocalUrl": "https://oss.example/variants/steady/vocal.wav",
      "lineUrls": [
        "https://oss.example/variants/steady/lines/line-1.wav",
        "https://oss.example/variants/steady/lines/line-2.wav",
        "https://oss.example/variants/steady/lines/line-3.wav",
        "https://oss.example/variants/steady/lines/line-4.wav"
      ],
      "mixUrl": "https://oss.example/variants/steady/mix.wav"
    }
  ]
}
```

### 第三步：制作 Docker 镜像

镜像中包含：

- Python 和 CUDA 兼容环境；
- DiffSinger 推理代码；
- 中文音素转换；
- FastAPI 服务；
- FFmpeg/混音程序；
- 模型配置，但大模型权重可以放 OSS、NAS 或独立模型目录。

镜像启动时：

1. 检查 GPU；
2. 下载或挂载指定模型；
3. 加载声学模型和声码器到显存；
4. 模型加载完成后，`/ready` 才返回成功；
5. 开始接收生成任务。

### 第四步：上传镜像到 ACR

- 创建阿里云容器镜像服务 ACR；
- 仓库设为私有；
- ECS/EAS 与 ACR 使用同地域、VPC 内网拉取；
- 给镜像标版本，例如 `rabbit-singer-api:0.1.0`；
- 不把 API 密钥和 OSS 密钥写进镜像。

### 第五步：创建 GPU ECS

- 使用带 NVIDIA 驱动、CUDA、Docker 和 NVIDIA Container Toolkit 的 GPU 镜像；
- 系统盘至少 50 GB；
- 只开放必要的 HTTPS 入口；
- DiffSinger 容器使用 GPU；
- 服务只允许备课后台或内网网关调用，不直接裸露 GPU 服务端口。

### 第六步：配置 OSS

建议目录：

```text
singing-jobs/{jobId}/input.json
singing-jobs/{jobId}/master.json
singing-jobs/{jobId}/variants/steady/song.json
singing-jobs/{jobId}/variants/steady/vocal.wav
singing-jobs/{jobId}/variants/steady/lines/line-1.wav
singing-jobs/{jobId}/variants/steady/lines/line-2.wav
singing-jobs/{jobId}/variants/steady/lines/line-3.wav
singing-jobs/{jobId}/variants/steady/lines/line-4.wav
singing-jobs/{jobId}/variants/steady/mix.wav
singing-jobs/{jobId}/variants/bounce/...
singing-jobs/{jobId}/variants/sway/...
singing-jobs/{jobId}/variants/drive/...
singing-jobs/{jobId}/package.json
singing-jobs/{jobId}/metadata.json
```

返回给前端的地址使用有期限的签名 URL，不将 OSS Bucket 设置为完全公开。

### 第七步：任务队列与并发

初期一张 GPU 一次只处理一个任务，其他任务进入队列，避免多个任务同时抢显存。

任务状态：

```text
queued → validating → adapting → singing → splitting → mixing → uploading → review_ready
                 ↘ failed        ↘ failed     ↘ failed
```

失败任务应保存错误原因，并允许老师重新生成。相同歌曲 JSON 和音色可以计算哈希并复用缓存，减少重复费用。

### 第八步：安全措施

- API 使用后台身份令牌或内网调用；
- 设置单次歌词长度、音符数量和音频时长上限；
- 限制老师账号的生成频率；
- 记录模型版本、规则版本和输入 JSON；
- 禁止未授权真人音色克隆；
- 正式音色保存演员授权和模型使用范围证明。

### 第九步：监控和告警

至少记录：

- 任务成功率；
- 排队时长；
- 单曲生成耗时；
- GPU 显存和利用率；
- 模型冷启动耗时；
- 每天生成次数；
- OSS 存储量；
- ECS/EAS实际费用。

## 7. 验收标准

- [ ] 能通过 API 提交《静夜思》歌曲 JSON。
- [ ] 返回任务 ID，页面不需要等待长连接。
- [ ] Codex能够用一条音符级母版生成指定的多个律动歌曲JSON。
- [ ] 每个律动版本都重新调用DiffSinger，不使用最终人声WAV简单倍速作为正式结果。
- [ ] 能生成独立人声 WAV。
- [ ] 能生成四段顺序正确、长度可用于逐句练习的人声 WAV。
- [ ] 四句句尾都有可听见的换气停顿。
- [ ] 能保持原有 88 BPM、2+4+2 小节结构。
- [ ] 不增加孩子没有选择的伴奏乐器。
- [ ] 能输出后台审核混音和歌曲包清单并上传 OSS。
- [ ] 未经教师确认的任务不会进入儿童端候选诗库。
- [ ] 同一输入重复生成可以命中缓存。
- [ ] 服务重启后模型能自动恢复并通过 `/ready` 检查。
- [ ] 正式音色具有明确的商业授权。

## 8. 成本控制原则

- 开发期使用按量 GPU ECS，用完立即停止；
- 正式初期根据备课高峰设置定时开关机；
- 模型常驻时按资源占用计费，即使没有请求也可能产生费用；
- 对相同古诗、旋律和音色使用结果缓存；
- 低频古诗模板可以提前批量生成；
- 并发量上升后再评估 PAI-EAS 自动扩缩容或 GPU 共享。

## 9. 二期开始时的执行顺序

1. 确认正式声库授权；
2. 把本地脚本整理为统一歌曲JSON，并固定母版与目标律动字段；
3. 由Codex完成“母版 → 多律动歌曲JSON”的转换脚本和规则测试；
4. 由Codex调用本地`D:\DiffSinger`，跑通整首人声、逐句人声、混音和检查报告；
5. 在本地封装FastAPI，并完成接口测试；
6. 制作GPU Docker镜像；
7. 创建ACR、OSS和按量GPU ECS；
8. 将Codex的本地调用改为歌声API调用并联调备课后台；
9. 进行20～50首古诗、多律动适配的压力和质量测试；
10. 根据调用量决定是否迁移PAI-EAS。

## 10. 阿里云官方参考

- GPU ECS 规格：<https://help.aliyun.com/zh/ecs/user-guide/gpu-accelerated-compute-optimized-and-vgpu-accelerated-instance-families-1>
- GPU 预装镜像：<https://help.aliyun.com/en/ecs/user-guide/alibaba-cloud-linux-3-with-pre-installed-nvidia-gpu-drivers>
- PAI-EAS 自定义镜像：<https://help.aliyun.com/en/pai/deploy-a-model-service-by-using-a-custom-image>
- PAI-EAS 计费：<https://help.aliyun.com/en/pai/product-overview/billing-of-eas>
- PAI-EAS 定时扩缩容：<https://help.aliyun.com/en/pai/enable-or-disable-the-scheduled-auto-scaling-feature>
