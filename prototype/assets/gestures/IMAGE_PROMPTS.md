# 手势图片生成提示词

## 2026-08-05 三拍子差异化扩展（内置 ImageGen）

统一要求：以现有 `gesture-wave.png` 为风格参考；16:9 深藏蓝渐变背景；一条高对比、粗线、圆角、可连续描画的轨迹；儿童能用整条手臂模仿；无文字、数字、箭头、人物、音符、水印。

- `gesture-waltz-sway.png`：三拍摇摆，第一拍明确下沉，第二拍向外上方展开，第三拍柔和回收。
- `gesture-three-beat-sweep.png`：三拍大回旋，向下、向外、向上回到中心，动作流畅且不同于普通波浪。
- `gesture-three-petal.png`：一条连续线形成三片大型圆润花瓣，在下方中央保留清楚开口作为起点和终点，轻微挑战但不缠绕。
- `gesture-infinity.png`：大型横向无穷形，在最左侧保留清楚开口；从开口出发，依次完成第一圈、中心交叉和第二圈。
- `gesture-spiral.png`：一圈半的大螺旋，从开放大圆逐渐收到中心，圈距宽、不紧密。
- `gesture-three-peaks.png`：三个清楚的大型圆角峰顶，每拍一次向上伸展，轮廓几何化而非正弦波。

生成方式：内置 ImageGen。每个手势单独生成，再居中裁切为 640 × 360 PNG。

## 共用提示词

```text
Use case: scientific-educational. Asset type: children's music gesture instruction card for a classroom web app. Create a clean 16:9 landscape card with a perfectly flat dark navy background (#20283A). Center exactly one very thick, smooth, rounded gesture stroke with generous margins. The gesture must be readable from across a classroom and easy for a child to copy with one whole-arm movement. Flat vector-like raster illustration, crisp edges, no texture. No text, no letters, no numbers, no arrows, no hands, no people, no music notes, no border, no icons, no extra marks, no shadows, no gradient, no watermark.
```

## 基础生成变量

1. `hold`：一条从左到右的天蓝色长横线。
2. `rise`：一条从左下到右上的黄色斜线。
3. `fall`：一条从左上到右下的珊瑚红斜线。
4. `arch`：一个从左下升高、在中央到顶、再落到右下的青色大拱形。
5. `circle`：一个紫色闭合大圆圈。
6. `triangle`：一个橙色闭合等边三角形。
7. `square`：一个薄荷绿色闭合正方形。
8. `wave`：一条包含两个大波峰和两个大波谷的蓝色波浪线。
9. `pulses`：一排四个等距的粉红色圆点，不连接。

## 标准难度补充

- `climb_arcs`：采用用户确认的连续上行小拱线设计。
- `descend_arcs`：由连续上行小拱线的原始图片水平翻转，保持同一视觉语言。
- `valley`：采用用户确认的先下降再上升连续曲线。
- `accent_hold`：采用用户确认的折线上升、下降后接长线设计。
- `bounces`：单独使用 ImageGen 生成四个相连的大拱线，提示词要求四个等大的慢弹跳动作、珊瑚粉粗线、深蓝背景，禁止文字和装饰。

所有图片禁止文字、箭头、手部人物和额外装饰。
