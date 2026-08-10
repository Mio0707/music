# 动物乐队 IP 资产总表

更新时间：2026-08-09。本文只登记仓库中已经存在的角色视觉资产；手势图、乐谱和音频不属于角色 IP，另行管理。

## 角色设定

| 角色 | 产品内职责 | 当前可用形象 | 主要出现位置 |
| --- | --- | --- | --- |
| 小兔 | 唱唱名老师、乐谱识别陪伴 | 头像、演奏者全身图 | 唱唱名、分析加载、动物乐队 |
| 小狗 | 鼓手、桌面节奏课老师 | 头像、演奏者全身图、5 个教学状态图 | 身体演奏、动物乐队、创作 |
| 小熊 | 键盘手 | 头像、演奏者全身图 | 动物乐队、创作 |
| 小猫 | 贝斯手、旋律手势引导者 | 头像、演奏者全身图、2 个手势变体 | 感受旋律、动物乐队、创作 |
| 小狮子 | 萨克斯手 | 头像、演奏者全身图、号角演奏变体 | 动物乐队、创作 |

产品代码当前的乐队职责为：小狗=鼓、小兔=唱名、小熊=键盘、小猫=贝斯、小狮子=萨克斯。

## 主资产目录（唯一来源）

日后新增或替换儿童端角色资产时，优先放入 `prototype/assets/stickers/`；这里是当前儿童原型的角色资产主目录。

| 类别 | 路径 | 内容 |
| --- | --- | --- |
| 角色总图 | `performers-sheet.png` | 小兔、小狗、小猫、小狮子的演奏者原始合图 |
| 头像总图 | `avatars-sheet.png` | 小兔、小狗、小猫、小狮子的头像原始合图 |
| 小兔 | `performer-rabbit.png`、`avatar-rabbit.png` | 演奏者、头像 |
| 小狗 | `performer-dog.png`、`avatar-dog.png` | 演奏者、头像 |
| 小猫 | `performer-cat.png`、`avatar-cat.png` | 演奏者、头像 |
| 小熊 | `performer-bear-cropped.png`、`avatar-bear-cropped.png` | 已裁切的儿童端演奏者、头像 |
| 小狮子 | `performer-lion.png`、`avatar-lion.png` | 演奏者、头像 |
| 小狮子变体 | `performer-lion-trumpet.png` | 儿童端当前实际引用的演奏版本 |

> `*-key.png` 是带纯色背景的工作文件；`*-cropped.png` 是网页应使用的透明裁切版本。网页直接使用后者。

## 教学动作与场景资产

| 角色 | 路径 | 用途 |
| --- | --- | --- |
| 小狗 | `states/performer-dog-ready.png` | 课前准备 |
| 小狗 | `states/performer-dog-clap.png` | 拍手 |
| 小狗 | `states/performer-dog-pat-thighs.png` | 拍近身桌沿／拍腿提示 |
| 小狗 | `states/performer-dog-stop.png` | 停止 |
| 小狗 | `states/performer-dog-high-five.png` | 鼓励与完成反馈 |
| 小狗 | `body-rhythm/dog-table-actions.png` | 桌面节奏动作总引导图 |
| 小猫 | `performer-cat-gesture.png` | 旋律手势引导，儿童端当前使用 |
| 小猫 | `performer-cat-gesture-long-sleeve.png` | 长袖服装变体，尚未在当前儿童端引用 |
| 首页组合 | `home-feel.png` | “感受”入口的场景合成图 |
| 首页组合 | `home-create.png` | “创作”入口的场景合成图 |

## 跨项目副本

`audio-production/studio/assets/` 与 `children-music-studio/studio/assets/` 各保留小熊、小猫、小狗、小狮子的演奏者图，供独立工作台使用。

- 小狗、小猫、小狮子的副本与儿童端对应图内容一致。
- 小熊在三个位置的文件不同，应以 `prototype/assets/stickers/performer-bear-cropped.png` 作为儿童端正式版本；其他两份在统一视觉版本前不应互相覆盖。

## 命名与维护规则

1. 统一以 `角色-用途-状态` 命名，例如 `performer-dog-clap.png`、`avatar-cat.png`。
2. 新动作优先放在 `stickers/states/`，并同时补齐“准备、进行、完成”三个阶段，避免只有单帧可用。
3. 新服装、乐器或姿态使用明确后缀，例如 `performer-lion-saxophone.png`；不要用模糊的版本号代替用途。
4. 角色原始合图保留为编辑源，页面只引用单角色透明 PNG；裁切规则见 `crop_stickers.py`。
5. 每次替换角色图后，同步检查儿童原型和两个工作台的副本，防止同一角色在不同页面长相不一致。

## 当前待统一项

- 小狮子在角色设定中是“萨克斯手”，但儿童端实际引用文件名为 `performer-lion-trumpet.png`。应确认画面乐器；确认后将文件名与代码职责统一为同一个乐器名称。
- 小兔、小熊、小猫、小狮子目前缺少像小狗一样的教学动作组。优先补：准备、指向、庆祝／完成、暂停四类状态。
- 尚未建立角色色板、性格关键词、标准表情和授权／来源记录；这些是将角色从“插图素材”升级为可持续 IP 的下一批基础资料。
