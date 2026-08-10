# 合作表演模块 · Design QA

## 检查范围

- 角色选择页
- 古诗演唱家练习
- 身体节奏家练习
- 旋律指挥家练习
- 集体合作演奏页

## 视觉依据

- 角色选择设计稿：`output/product-design/collaborative-performance/01-role-selection-with-existing-ip.png`
- 古诗演唱设计稿：`output/product-design/collaborative-performance/02-singing-practice-template.png`
- 集体演奏设计稿：`output/product-design/collaborative-performance/03-group-performance.png`
- 浏览器实测对照：`prototype/qa-role-comparison.png`

## 浏览器验证

- 本地地址：`http://127.0.0.1:4173/`
- 浏览器：Codex In-app Browser
- 视口：1280 × 720
- 角色卡、练习入口、上一句/下一句、完成练习、集体演奏解锁、倒计时、暂停/再演一次均已实际操作。
- 古诗页已确认简谱在上、歌词在下，并保留句末换气提示。
- 身体节奏页已确认读取“稳稳走”律动贴纸的动作资源，显示“动 · 打 · 动 · 打”。
- 旋律指挥页已确认逐小节使用“感受 → 画旋律”的现有手势图片；没有使用贯穿全曲的连续曲线。
- 集体演奏页已确认三条任务同时呈现，并会随小节同步切换提示。
- 浏览器 console：0 error，0 warning。

## 视觉对照结论

- 信息层级、三角色配色、IP分工、卡片结构和主操作位置与选定设计稿一致。
- 为适配现有 980px 产品外壳，卡片间距和标题尺寸做了等比例收敛；没有影响角色识别与课堂操作。
- 练习页沿用现有产品的暖色背景、深蓝标题、圆角卡片与实物IP资源，没有引入新的视觉体系。
- 未发现影响使用的裁切、重叠、错误间距、缺图或不可点击控件。

## 自动测试

- `node --test prototype/tests/*.test.js`
- 结果：6/6 通过。

## 修订记录

1. 接入三类现有资源：古诗简谱与歌词、律动贴纸动作、逐小节旋律手势。
2. 新增三个独立练习入口、练习完成状态与集体演奏解锁逻辑。
3. 新增集体演奏倒计时、同步提示、暂停、再演一次与交换角色状态。
4. 完成真实浏览器路径检查和设计稿并排对照。

## 2026-08-09 · 创作第 3 步整体重构

### 对照依据

- 原页面视觉语言：`prototype/qa-source-old-refine.png`（1765 × 1854 px）。
- 新页面浏览器截图：`prototype/qa-poetry-finish.png`（817 × 1056 px）。
- 确认完成状态截图：`prototype/qa-poetry-finish-confirmed.png`。
- 并排对照证据：`prototype/qa-poetry-comparison.png`。
- 浏览器 CSS 视口：831 × 1074，`devicePixelRatio = 1.75`。对照页把两张截图归一到相同显示宽度后检查整体层级、密度和视觉语言。
- 状态：想念 × 稳稳走，进入创作第 3 步；默认推荐《静夜思》，随后确认使用该唱段。

### 五项视觉检查

- 字体与层级：沿用微软雅黑/苹方回退和原页面的深蓝粗标题；主标题、步骤标题、卡片标题与辅助信息没有错误换行或截断。
- 间距与布局：980px 产品外壳内保持三段式结构；步骤条、古诗卡、合成卡在 831px 宽度下无横向溢出。
- 色彩：保留暖米色背景、珊瑚红主操作、薄荷绿完成态和紫蓝正文色；状态语义一致。
- 图片质量：小兔与动物乐队全部复用现有 IP 图片，没有占位图、拉伸或透明边缘异常。
- 文案与产品逻辑：已移除“AI轻量优化、画旋律、逐拍身体演奏”；改为“匹配古诗唱段—试听合成—确认作品”，并明确合作表演是后续独立模块。

### 交互与 focused evidence

- “单独听小兔唱段”可切换为暂停状态。
- “试听合成效果”会同时播放孩子的四段编排与预制人声，并可暂停。
- “就用这个版本”会进入完成态，解锁“完成并保存作品”和“进入合作表演”。
- focused 检查使用 `qa-poetry-finish-confirmed.png`，确认合成卡与下一步操作在同一视区内清楚可见。
- 浏览器 console：0 error，0 warning。

### 比较历史

1. 原页面存在 P1 产品逻辑错位：把 AI 优化、画旋律和身体演奏同时放在创作完成页。已重构为古诗匹配与人声混合主任务。
2. 修订后并排复查未发现新的 P0/P1/P2；原有视觉语言、IP资源和主操作层级均被保留。

## 2026-08-09 · 儿童端信息简化

### 依据与状态

- 修改前截图：`prototype/qa-poetry-finish.png`（817 × 1056 px）。
- 儿童选择页：`prototype/qa-child-poetry-choice.png`（838 × 1021 px）。
- 儿童完成页：`prototype/qa-child-poetry-success.png`。
- 并排对照：`prototype/qa-child-simplification-comparison.png`。
- CSS 视口：838 × 1021，`devicePixelRatio = 1.75`；并排对照时归一到相同显示宽度。

### 检查结果

- 字体与层级：只保留一个任务标题、一首诗和一个主按钮；儿童不需要阅读说明段落。
- 间距与布局：选择页主要内容完整落在一个视口内，无横向溢出或底部关键操作遮挡。
- 色彩：继续使用原有暖色背景、深蓝标题和珊瑚红主按钮；没有引入新的视觉语言。
- 图片质量：小兔和动物乐队继续使用现有正式 IP 图片，清晰且比例正常。
- 文案：移除步骤条、BPM、匹配原因、混音规则、教师后台说明和候选诗占位；儿童流程变为“听小兔唱／听完整作品—就选这首”。
- 完成态不再向下追加复杂信息，而是切换为独立庆祝页，提供“听完整作品、保存、合作表演”三个动作。
- 浏览器实测：两种试听均可进入和退出播放状态；选定后成功切换完成页。
- 浏览器 console：0 error，0 warning。

### 比较历史

1. 上一版存在 P1 信息密度问题：产品过程和成人规则占据儿童决策页大部分空间。
2. 已删除非儿童任务信息，并改为单屏决策与独立完成态。
3. 修改后并排复查未发现新的 P0/P1/P2。

## 2026-08-09 · 创作完成后的玩法分流

### 依据与状态

- 修改前：`prototype/qa-child-poetry-choice.png`（838 × 1021 px），创作完成后直接进入《静夜思》。
- 修改后：`prototype/qa-finish-path-choice.png`（767 × 1021 px），先选择“唱古诗”或“做成明信片”。
- 并排证据：`prototype/qa-finish-path-comparison.png`。
- CSS 视口：767 × 1021，`devicePixelRatio = 1.75`；对照页归一到相同显示宽度。

### 检查结果

- 字体与层级：主问题“接下来想怎么玩？”突出；两张卡片标题与行动按钮层级一致。
- 间距与布局：两个入口完整位于首屏，无溢出、遮挡或错误换行。
- 色彩：唱古诗使用暖橙色，明信片使用薄荷绿色，仍属于现有产品色板。
- 图片质量：唱古诗复用小兔正式 IP；明信片复用孩子刚才创作的动物乐队 IP。
- 文案与逻辑：分流页不再提前显示《静夜思》内容；唱古诗进入独立选诗页，明信片直接进入现有明信片页。
- 交互验证：两条入口、各自返回路径、古诗确认后进入合作表演均已实际点击验证。
- 明信片页面已移除合作表演按钮，避免两条路径再次混合。
- 浏览器 console：0 error，0 warning。

### 比较历史

1. 上一版存在 P1 路径错误：创作完成后强制进入古诗流程，缺少明信片分支。
2. 已改成两个同级大入口，并拆分后续页面职责。
3. 修改后复查未发现新的 P0/P1/P2。

## 2026-08-09 · 多首候选诗与 2＋4＋2 混音完成页

### 依据与状态

- 原问题截图：`prototype/qa-source-poem-success-ui.png`（1299 × 1142 px）。
- 多首候选诗页面：`prototype/qa-poem-candidates.png`（1265 × 712 px）。
- 修正后的完成页：`prototype/qa-poem-success-final.png`（1265 × 712 px）。
- 同一输入中的并排证据：`prototype/qa-poem-success-comparison.png`（1265 × 712 px）。
- 浏览器 CSS 视口：1280 × 720，`devicePixelRatio = 1.75`；实现截图扣除滚动条后为 1265 × 712。对比图把源图和实现图放入等宽区域，以顶部内容区为基准检查角色站位、信息层级和完成卡片密度。
- 状态：想念 × 稳稳走；《静夜思》已选中并完成混合。

### 五项视觉检查

- 字体与层级：继续使用现有深蓝粗标题和儿童端大字号；候选诗标题、作者、正文与状态标记层级清楚，长诗名允许自然换行。
- 间距与布局：候选页三张卡片等宽排列；完成页压缩了无意义的舞台高度，主操作仍位于首屏附近。
- 色彩：沿用暖米色背景、珊瑚红可用态、灰色待生成态和薄荷绿完成态，没有引入新的视觉体系。
- 图片质量：所有角色继续使用现有动物 IP；主唱小兔与四位乐手改为独立网格区域，比例一致，无重叠和裁切。
- 文案与内容：当前心情展示 3 首候选诗；只有《静夜思》显示“小兔会唱”，其余明确显示“人声准备中”。完成页用“前奏 2 小节—小兔演唱 4 小节—尾奏 2 小节”直接表达混音结果。

### 交互与时间轴验证

- 已实际走通“玩法选择—唱古诗—查看三首候选—选择《静夜思》—进入完成页”。
- 候选诗数据覆盖开心、放松、勇敢、想念四种心情，每种 3 首；自动测试确认目前只有《静夜思》绑定人声音频。
- 完整作品按四个两小节段落播放：第 1 段纯伴奏，第 2、3 段加入人声，第 4 段停止人声并保留尾奏。
- 单句演唱试听的起点已从错误的第 2–5 小节偏移改为人声文件内的第 0–3 小节。
- `node --check prototype/app.js` 与 `node --test prototype/tests/*.test.js` 均通过；6/6 测试成功。

### 比较历史

1. 原完成页存在 P1：小兔遮住狮子、角色大小差异过大，且舞台上方空白过多。
2. 首次修订出现 P1：标签选择器同时命中小兔图片，导致主唱不显示；已缩小选择器范围。
3. 修正后并排复查：主唱与乐队分区清楚，时间轴可读，未发现新的 P0/P1/P2。

final result: passed

## 2026-08-10 - Collaboration practice refinement

- Evidence: `qa-latest-comparison.html`, using the previous and current body/melody screenshots in one side-by-side review surface at 875 x 1021.
- Flow verified in the in-app browser: poem choice goes directly to collaboration; the removed success transition does not appear.
- Singing verified on line 2; each of the four poem lines is now bound to a separate WAV clip.
- Body practice copy is reduced to the child-facing task and the full-work button uses the vocal mix.
- Melody practice copy is reduced; full-work playback advances the active gesture card, and selecting a card seeks to that bar.
- Gesture replacement uses the existing gesture asset library and saves immediately; the default first-bar gesture was restored after QA.
- Visual review: no new clipping, overlap, broken image, inconsistent type, or inaccessible primary action was found.
- Automated checks: all prototype test scripts passed, including the dedicated collaboration test.

final result: passed
