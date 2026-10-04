# AGENTS.md — 给在这个仓库里干活的 AI（ChatGPT / Codex / Claude 通用）

## 这是什么
「虹海之城」：浏览器里运行的《原神》式 3D 开放世界（Three.js），构建成**单个 HTML 文件**。
- 线上地址（push 到 `main` 约 1–2 分钟后自动更新）：https://ycd-jerry.github.io/rainbow-sea-city/
- 仓库就是**唯一的正本**。不要再用任何旧的源码包、旧的 claude.ai 链接、旧的 HTML 去重建——那些都是旧快照，会把别人的改动覆盖掉。

## 每次干活的流程（必须）
1. 开工前 `git pull`，从最新的 `main` 开始。
2. 只改 `src/` 和 `template.html`。`rainbow-sea-city.html`、`test.html`、`dist/` 是构建产物，已被 `.gitignore`，不要手改、不要提交。
3. `npm ci && node build.mjs`，必须构建成功。
4. 用 `tests/` 里的脚本做无头浏览器测试（见下）。改了手机界面就必须跑 `t_hud.mjs` 和 `t_panels.mjs`。
5. 小步提交，提交信息写清楚改了什么；在 `CHANGELOG.md` 顶部加一条（版本号、日期、改了什么、测了什么）。
6. `git pull --rebase` 后再 `git push` 到 `main`。**不要 force push。** 另一个 AI 可能刚改过。
7. 推送后等 1–2 分钟，打开线上地址确认能玩，再向用户汇报。汇报时要诚实：哪些测过、哪些只是模拟、哪些没测。
8. 绝对不要把令牌、密码、API key 写进仓库或聊天里的文件。

## 目录
| 路径 | 内容 |
|---|---|
| `src/main.js` | 总装配：渲染器、存档、队伍、相机、所有界面逻辑、输入、主循环、`__dbg` 调试接口 |
| `src/*.js` | 地形、城市、建筑、自然、天空、海水、昼夜、玩家、战斗、敌人、特效、道具、宝箱、抽卡、副本、谜题、剧情、成就、地图、界面、角色模型（详见 `docs/HANDOFF-v13.md` 第 4 节的代码地图） |
| `template.html` | 全部 HTML 和 CSS（所有界面样式都在这里） |
| `build.mjs` | esbuild 打包：生成 `rainbow-sea-city.html`（单文件）、`test.html`（本地测试外壳）、`dist/index.html`（Pages 页面） |
| `tests/` | 无头浏览器测试脚本（Playwright + Chromium） |
| `docs/HANDOFF-v13.md` | 旧的交接说明：世界设定、代码地图、测试方法（发布部分已过时） |
| `.github/workflows/pages.yml` | push 到 main 后自动构建并发布到 GitHub Pages |

## 测试
- 先 `node build.mjs`，再在**仓库根目录**运行，例如 `node tests/t_hud.mjs 873x393`。脚本读的是根目录下的 `test.html?debug`。
- 需要 Chromium。设环境变量 `CHROME_PATH` 指向它；没设就用 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`。启动参数里已经带了软件渲染（swiftshader）。
- 无头软件渲染只有约 1 fps，**很慢**：一次测试控制在一两分钟内，长任务拆开跑。
- 主要脚本：
  - `t_hud.mjs 宽x高`：手机 HUD（按钮、队伍头像、小地图）有没有重叠，浮动摇杆。
  - `t_panels.mjs 宽x高 [面板名,...] [shot]`：每个全屏面板有没有控件超出屏幕、关闭按钮能不能点到。
  - `t_rv.mjs`：手机尺寸下跑一次十连抽，检查揭晓屏和总结屏。
  - `t_mobile.mjs`：竖屏提示和横屏。
  - `t_fix.mjs`：Alt 后重新锁定鼠标、守卫不上树。
  - `t_time.mjs`：时间环；`t_tiles.mjs`：九宫格光砖间距和菜单；`t_nan.mjs`、`t_err.mjs`：黑块防护和着色器报错。
- 手机检查的标准尺寸：667×375、740×340、873×393、932×430。

## 这个项目里已经踩过的坑（不要改回去）
- **手机界面**：电脑端界面不变；手机端样式都在 `body.touch` 下，尺寸单位用 `--s`（按屏幕高度等比缩放，以 393 px 为基准）。新面板必须在上面四个尺寸通过 `t_panels.mjs`。全屏面板要用高度断点（`@media (max-height: 520px)`）、四边留安全区、可滑动的窄条不要撑出屏幕、关闭按钮不小于 38 px。
- **手机按键布局**：攻击键最大在右下角；绝技键必须比技能键小；冲刺键紧挨拇指（攻击键上方、靠边）。左半屏是浮动摇杆。
- **剧情点屏闪蓝**：靠 `-webkit-tap-highlight-color: transparent` 解决，别删。
- **泛光黑块**：一个无效像素（NaN）会被泛光涂成一大片黑。`src/main.js` 里泛光前有一道清洗 pass，天空、光柱、水面着色器里也有除零保护，别删。
- **指针锁定**：松开 Alt 后的重新锁定是「软」的，被浏览器拒绝不算失败；只有连续 3 次点击都被拒才退回拖动模式。
- **敌人不能踩树**：树的碰撞体带 `tag: 'tree'`，敌人的地面计算会跳过它，并把它当墙。
- **时间环**：弧线用两段半圆、坐标保留两位小数；用一段近乎闭合的弧，浏览器会算错圆心，环会偏移。
- **中文文字都是写死在代码和模板里的**。要做英文版：先把所有中文抽成一张文本表，再翻译，最后做设置界面里的语言切换（现在还没有设置界面）。

## 已知没做的
萤、暖两个角色；新角色技能图标仍是通用的剑/弓图标；设置界面（语言、画质）；竖屏下各面板的布局。
