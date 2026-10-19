# 开始页参考图还原检查

final result: passed

## 比对依据

- 视觉源：`qa/start-reference.png`，用户提供，853 × 1844 px。
- 实现截图：`qa/start-v2-final-screen.jpg`，iPhone 屏幕区域，393 × 852 px；`qa/start-v2-pixel.jpg`，Pixel 屏幕区域，427 × 952 px。
- 浏览器测试视口：1400 × 1200 CSS px，iPhone 屏幕实测 393 × 852 CSS px，缩放 1。导出的手机截图与 CSS 尺寸一致。
- 参考图按宽度归一化至 393 × 850 px。iPhone 状态栏、摄像头和底部指示条属于受保护运行时，参考图未包含这些元素；比较内容时将这部分预期差异单独识别。
- 状态：开始页、未进入测试、说明弹层关闭、滚动位置为顶部。已有结果的恢复入口位于页面末尾，不影响参考图主内容。
- 合并全视图：`qa/start-comparison-01.jpg`、`qa/start-comparison-final.jpg`。
- 合并局部视图：`qa/start-focus-heading.jpg`、`qa/start-focus-cta.jpg`，分别检查标题与群像、四宫格与说明及主按钮。

## 比对记录

1. 初版发现 [P2] 主要内容高度超出手机可用区域，开始按钮在首屏下方；大标题也比归一化参考图更宽。证据为 `qa/start-comparison-01.jpg`。
2. 将开始页工具栏高度由 64 调整为 44 CSS px；标题调整为 52 px / 1.18；收紧四宫格、说明和页尾间距，并保留原图群像比例。后续截图 `qa/start-v2-final-screen.jpg` 与合并视图 `qa/start-comparison-final.jpg` 确认按钮完整显示，按钮顶部约 771.5、底部约 817.7，均处于 852 px 手机屏幕内。
3. 素材从用户提供图中提取，去除群像区域的原 UI 文本，纸底边缘进行柔化；标题、正文、数字和按钮均为 HTML。未把整页截图作为界面。最终全图与局部对照未发现影响使用或主要视觉的 P0/P1/P2 问题。

## 五项视觉核对

- 字体与排版：中文衬线大标题，朱红强调「是谁」，英文衬线副标题，正文使用系统无衬线；标题保持两行，四宫格标签不截断。系统宋体与参考字形存在轻微差异，归为 P3。
- 间距与布局：页头、标题、横向满幅群像、两行说明、四宫格、测试说明、数量信息与开始按钮按参考顺序排列。为原有手机状态栏保留空间，内容节奏相应紧凑；主按钮首屏可用。两款设备无水平溢出或遮挡。
- 色彩与样式：暖米白纸底、黑色标题、朱红强调与按钮、浅褐分隔线；说明区保留竹影背景与红色侧线。纹理、印章、图标与装饰均来自用户提供的图片素材。
- 图片：五人群像、山水楼阁、印章、四个特点图标与竹影取自同一参考源，保持人物顺序、色调和比例；群像有可访问替代说明，装饰图像使用空替代文本。
- 文案：开始页按截图采用「古代人格测试」「如果生在古代／你会是谁」、英文副标题、特点与说明文案；24 题、100 种结果保持现有实际数据。其他页面的产品名和功能保持原实现。

## 交互与工程检查

- 测试说明按钮打开原有说明弹层，关闭操作有效。
- 开始测试按钮进入第 1 / 24 题，未选择时下一题禁用。
- 返回开始页有效，进度恢复及上次结果入口继续复用原逻辑。
- iPhone 和 Pixel 10 已进行浏览器截图检查；控制台错误／警告列表为空。
- `npm run build` 通过（包含 TypeScript 与 28 个受保护运行时文件检查）。保留既有构建包体积提示；未修改运行时或锁文件。
- 未改动评分、人物库、分享解析与结果页面，不重复执行本次样式变更无关的内容测试。
- 未部署；临时浏览器尺寸设置已复原，首页预览保留。

## 后续微调

- P3：若后续提供参考图实际使用的可授权字体，可进一步收敛宋体字形与字重差异。

## 2026-10-18 交互调整复核

- 依据：用户标注的开始页、答题页截图，以及文字列出的交互变更；本次保留已有视觉风格，按文字要求替换对应控件与文案。
- 首页证据：`qa/interaction-v3-home.jpg`。仅保留固定“开始测试”入口，无继续测试、重新开始或上次结果入口；存在未完成进度和已完成结果时均已验证。
- 答题证据：`qa/interaction-v3-quiz.jpg`。题目分类为实际维度“决策方式”等；页头没有“认识你的日常选择”，6px 进度条显示“1/24 4%”；原进度提示替换为“按照平常的你来选，不必寻找‘更好’的答案。”，不再在正文重复显示。
- 已实测：点击第 1 题选项自动到第 2 题，进度变为 2/24 8%；上一题可看到原答案并修改；返回首页再开始后恢复为第 1 题且所有选项未选；完整点击 24 题均自动前进，最后一题直接生成“谢道韫”结果（全 A 参考结果）；结果页无重新测试入口。
- 选项自动跳转前保留 260ms 勾选反馈，期间禁用选项和前进按钮；组件卸载、返回首页和外部导航会取消尚未执行的计时器。方向键可选中和浏览选项，按 Enter/空格确认后自动前进，或使用下一题。
- 字体、暖白／墨黑／朱红配色、题目与四选项结构保持一致；底部提示不遮挡按钮，进度条变粗后无布局溢出。未添加新图片或修改受保护设备外壳。
- TypeScript、生产构建与 28 个运行时文件检查通过；本次未改动匹配算法和 100 人物内容包。
- 本轮交互复核 final result: passed。


## 2026-10-18 品牌、说明与题目分组更新

- 产品名称统一为“古代人格测试”，覆盖首页、内页品牌、浏览器标题、分享图片和下载文件名。
- 删除测试说明中的“人物相关史料与题目仍处于内容评审阶段。”，删除结果页、分享页及图片上的通用娱乐说明。
- 题目按六个维度分为连续的四题组：1–4 决策方式、5–8 社交取向、9–12 变化偏好、13–16 表达方式、17–20 关注视角、21–24 组织方式。保留原题目 ID 与选项分值，测试参考答案按原题目 ID 转换顺序。
- 进度区加入六种对应图标、维度名称及本组题号，保留整体题号与百分比；进度条增至 8px。旧题序的答题草稿与新题序隔离，已生成的结果链接仍然兼容。
- 自动检查：7 项测试通过，包含全部 100 组参考答案、分组完整性、旧草稿隔离及分享链接；手机运行时 28 个保护文件检查通过；生产构建通过。
- 浏览器实测：逐一检查全部 24 题的当前分类与组内题号，点击选项自动推进，末题生成结果；测试说明无评审提示，分享图显示新名称、无通用娱乐说明；iPhone / Pixel 10 均检查布局。
- 截图：`qa/grouped-v4-quiz.jpg`、`qa/grouped-v4-social.jpg`、`qa/grouped-v4-share.jpg`、`qa/grouped-v4-pixel.jpg`。


## 2026-10-18 首页滚动与测试页精简

- 首页品牌栏与主体内容放在同一个 MobileScroll 中，取消首页固定头部；安全区随设备读取，测试说明 BottomSheet 独立于滚动内容。
- 测试说明弹窗及测试页移除中文句号“。”；说明内部句间使用逗号连接，动态题干、选项、错误与存储提示在显示层移除中文句号，不改变计分数据。
- 当前维度计数由“本组 1/4”精简为“1/4”，保留读屏标签。移除测试页顶部返回首页按钮，保留上一题与自动推进。
- 验证：构建与 28 个运行时保护文件检查通过；浏览器确认首页无固定头部且品牌与主体同步移动、弹窗内容无中文句号、测试页无“本组”和返回按钮；选中第 1 题后自动进入第 2 题。
- 截图：`qa/refine-v5-home.jpg`、`qa/refine-v5-info.jpg`、`qa/refine-v5-quiz.jpg`。


## 2026-10-18 进度合并与维度图标更新

- 将组内计数“1/4”替换为整体题号和百分比，放在维度名称同一行右侧，移除上方重复计数；保留 8px 整体进度条。第 9 题显示“变化偏好 9/24 38%”。
- 六维图标按用户截图轮廓更换为脑、双人、交叉箭头、圆形对话气泡、眼睛与组织结构树，采用一致的描边，延续原有暖红配色。
- 验证六组首题（1、5、9、13、17、21）的对应图标、唯一整体计数和百分比；从第 21 题返回第 9 题验证反向同步。生产构建与手机运行时完整性检查通过。
- 截图：`qa/progress-v6-1.jpg`、`qa/progress-v6-5.jpg`、`qa/progress-v6-9.jpg`、`qa/progress-v6-13.jpg`、`qa/progress-v6-17.jpg`、`qa/progress-v6-21.jpg`。


## 2026-10-18 静态首页与结果报告重构

- Source visual truth: `/var/folders/lp/n95737zd1wb0lqnkbjn07r9c0000gn/T/codex-clipboard-24b1eb8f-c134-4915-944c-ee3d59c7fcd5.jpg`（780 × 6324）。用户要求参考展示内容，保留项目纸色与朱红配色；不将附件人物、87% 和八维数值作为本次真实测试数据。
- Implementation: `qa/result-v7-full.png`（393 × 3048）、`qa/result-v7-preview.png`、`qa/result-v7-bottom.jpg`；分段原始浏览器截图为 `qa/result-v7-part-*.png`，滚动坐标记录于 `qa/result-v7-captures.json`。
- Viewport: browser 1400 × 1200；iPhone 屏幕 DOM 实测 393 × 852 CSS px（scale 1），报告滚动窗口 393 × 734。参考图归一化为宽 393px 的 `qa/result-v7-reference.png`。报告截图按真实滚动偏移拼接，未注入 CSS 或改变浏览器状态伪造长图；设备 home indicator 在最后一屏保留。
- State: 完成 24 题，匹配薛涛，同频指数 77%；全部六段内容完整展示。人物与指数为实际答案计算，与参考中的缇萦不同，属于正常数据状态差异。
- Full-view comparison: `qa/result-v7-comparison.png`。Focused comparisons: `qa/result-v7-comparison-top.png` 和 `qa/result-v7-comparison-bottom.png`，均已打开查看。

### Findings / comparison history

- [P2, fixed] 初次实现将双按钮固定在底部，遮挡首屏下方内容，底部安全区可见正文穿出。已移除结果页固定 footer，把两级按钮放在报告末尾，与参考内容顺序一致。修复后在连续截图、完整拼接图和末尾截图中复查，无内容被固定操作区遮挡。
- 无剩余 P0/P1/P2。参考的八维能力结构改为当前实际测量的六维倾向，刻度明确两端含义；三句内容使用产品寄语，避免伪造历史人物语录。用户要求参考内容，暖纸底色、朱红强调色及字体沿用现有品牌，属于既有产品约束。

### Required fidelity surfaces

- Typography: 概览指数突出显示、人物名采用现有中文衬线字体，章节及正文采用产品无衬线字体；检查长人名与段落换行，无截断。正文 12–13px 与参考的较大字级存在预期密度差异，保留本项目手机排版体系。
- Spacing/layout: 概览加六张章节卡片；嵌套内容块有独立留白；末尾两级按钮顺序正确，报告可滚动到底，首页全屏静态适配且按钮完整可见。
- Colors/tokens: 使用原纸色、墨色、朱红和轻边框，未把附件紫色主题扩散到产品其他页面。
- Image/assets: 首页沿用已确认群像资产；报告只使用图标库人物标识，无新增插画。参考中的装饰图标不作为独立展示内容要求。
- Copy/content: 完整覆盖人物概览、心声、画像、倾向、共同底色、现实表现、盲点、风险、建议及三句寄语；文案随当前六维倾向与人物变化。没有加入全局娱乐提示。

### Validation

- 8 项数据测试通过，包含所有 100 位人物参考答案、报告生成、匹配指数边界、旧分享链接兼容、新指数范围校验与精确分数不外传。
- 生产构建通过；28 个保护运行时文件完整性检查通过。
- 浏览器实测完整 24 题、六段报告滚动、分享图生成及分享链接、返回结果、重新测试回首页、重新开始为第 1 题且四项未选、下一题按钮禁用。
- 新公开分享页的薛涛与 77% 同频指数与本人结果一致，完整报告各段可见。
- iPhone 首页 wheel 与拖动前后标题 y 均为 228、scrollTop 为 0，页面无 MobileScroll；Pixel 首页内容与开始按钮位于有效高度内。测试说明弹窗仍可打开与关闭。
- 浏览器控制台错误与警告：空。临时 viewport 已恢复默认，本地预览已保留。

final result: passed

## Result hierarchy and heading icons — 2026-10-18

- Scope: remove the result header's home button; make retest a secondary text entry; add content-specific icons to all six report titles.
- Implementation: result header uses the existing brand-only header. Retest remains a semantic button with muted 12px text, transparent background, no border and a 44px touch target. Share remains the primary action.
- Heading icons: person / bar chart / link / globe / warning triangle / quote, all from the existing Radix icon library, 18px in the app coordinate space with consistent cinnabar color and spacing. Decorative icons are hidden from assistive technology; heading text and numbering remain accessible.
- Browser validation: completed all 24 questions, generated 薛涛 / 77%, verified six headings each contain exactly one icon and no 首页 button exists. Computed retest styles confirmed transparent background, 0px border and 44px minimum height. Share opens the generated character card; 返回结果 works; text retest returns to the homepage with 开始测试 visible. Browser console has no warnings or errors.
- Visual verification: inspected the top and bottom report views; no heading overflow or operation overlap. Saved screenshot: `qa/result-v8-bottom.jpg` (includes the brand-only header, quote icon, primary share action and muted retest text).
- Checks: `npm run check:runtime` passed for all 28 protected files; `npm run build` passed. Existing bundle-size advisory remains. No quiz scoring/content changes or runtime changes.
- Local preview retained at http://localhost:4173/; no deployment.

final result: passed

## Automatic-advance button feedback — 2026-10-18

- Selecting an answer now puts the footer next button into a pressed visual state during the existing 260ms selection feedback interval: darker cinnabar, full opacity, 1px downward offset and inset shadow. The last question applies the same treatment to 查看结果.
- Reused `pending` for the class and `aria-busy`; the button stays disabled during advancement, without dispatching a synthetic click or creating another timer. Unanswered questions retain the disabled appearance. A fresh question resets the pressed/busy state.
- Browser verification: immediately after selecting the first answer, the next button had is-advancing, aria-busy=true, disabled=true, opacity=1 and background rgb(141, 50, 40). Screenshot captured this state at `qa/quiz-v9-auto-pressed.jpg`. The subsequent question showed 2/24 8%, no checked answers, no pressed state and aria-busy=false.
- Returning to question 1 preserved its answer and enabled manual next. Completed all 24 questions; 查看结果 showed identical pressed/busy feedback and automatically opened 薛涛 / 77%. Browser errors and warnings: none.
- `npm run check:runtime` passed (28 protected files); `npm run build` passed with the existing bundle-size advisory. No runtime, scoring or question changes. Local preview retained.

final result: passed

## Instruction bullets and quiz copy removal — 2026-10-18

- Four instruction paragraphs are now a semantic list, with a visible “·” marker and 14px hanging indentation per item. Text content, sheet behavior and close action are preserved.
- Removed the quiz footer guidance “按照平常的你来选，不必寻找‘更好’的答案”. No empty paragraph remains; necessary quiz errors still render conditionally with role=alert.
- Browser verification: all four list items are visible with the correct marker; line wraps align with body text. Open/close sheet works. Quiz snapshot contains no removed guidance (count=0); selecting an option advances from 1/24 4% to 2/24 8%. No browser warnings/errors.
- Screenshots inspected: `qa/info-v10-bullets.jpg`, `qa/quiz-v10-no-footer-hint.jpg`.
- Runtime integrity passed (28 protected files); production build passed with the existing bundle-size advisory. Preview retained; no deployment.

final result: passed


## Illustrated results and sharing — 2026-10-18

- Source: approved `design-concepts/result-portrait-jikang-preview.png` and the user's two illustration approval attachments. Portrait style crop: `design-concepts/portrait-style-reference.png`.
- Implementation: each of 100 people has a distinct local 1024×768 WebP under `public/art/portraits/`, selected by stable person ID. Own result, public result and downloadable 1080×1440 PNG use the same corresponding image. Text, actual match percentage and QR remain programmatically rendered. Portraits are artistic interpretations.
- Reference comparison: opened the approved source and matching iPhone own-result capture together in `qa/result-v11-comparison-own.png`. The watercolor portrait, name/index row, paper palette, cinnabar emphasis, identity tags and character-voice hierarchy match. The implementation uses native app typography and a 603px card instead of the image concept's roughly 528px card at equal width. The whole hero fits the own-result first viewport; no clipped identity or overlap. Actual 100% and answer-derived voice differ from the concept's illustrative 85% and example text by design.
- Asset review: generated and inspected every portrait individually, then reviewed all four `qa/portraits-v11-contact-*.jpg` sheets. All 100 images decode, have the required dimensions and distinct SHA256 values. Gender, character category and associated props were checked; no missing assets remain. Total assets are approximately 15MB; pages load only the current person.
- Browser validation: completed 24 questions for Cao Xueqin and Ji Kang, reached their actual 100% results, opened sharing, downloaded and inspected 1080×1440 PNGs with their matching portraits. Public links for Laozi and Shangguan Wan'er load their own images. Four-character names and long era text fit on iPhone and Pixel 10 without horizontal overflow. Save-image fallback sheet and return-to-result work.
- QR validation: all 2401 encoded modules agree with the QR generated for the displayed result URL (`qa/poster-v11-qr-validation.json`). Localhost sharing is still limited to this device; physical-phone and public-domain scanning are not claimed as verified.
- Final captures inspected: `qa/result-v11-final.png`, `qa/share-v11-final.png`, `qa/poster-v11-jikang.png` and `qa/poster-v11-caoxueqin.png`. The two final page screenshots are combined in `qa/illustrated-pages-v11.png`.
- Checks: 9 data/asset tests passed using Node 24; all 28 protected runtime files passed integrity checks; TypeScript and production build passed. Existing JS bundle-size advisory remains. Browser console warnings/errors are empty. No runtime files, scoring or question content changed.
- No open P0/P1/P2 findings. Viewport override reset, iPhone preview retained at http://localhost:4173/; no deployment.

final result: passed


## Homepage and share copy — 2026-10-18

- Homepage description now exactly uses “通过多组情境选择，探索你的决断、洞察、表达与担当”. Removed question/person-count row and no-history/no-login footer note. Preserved the fixed fitted screen and start action. Pretty wrapping prevents a single orphan character on the final line.
- Share poster heading, native share title, accessible image description and 100 character share summaries use the requested “历史人物匹配结果” wording. Downloaded PNG was inspected at `qa/poster-v12-copy.png`; the longer heading and summary fit without clipping.
- Browser checks: iPhone and Pixel homepage copy verified, both removed elements absent, start opens 1/24 4%, full 24-answer flow generates result and illustrated share card, downloaded 1080×1440 PNG carries new heading. Retest returns to the simplified homepage. Console errors/warnings empty. Screenshots: `qa/home-v12-copy.png`, `qa/home-v12-pixel.png`, `qa/share-v12-copy.png`.
- Eight existing data tests passed; build and all 28 runtime protection checks passed. No changes to scoring or runtime. iPhone homepage preview retained locally, no deployment.

final result: passed


## Homepage face-orientation variety — 2026-10-18

- User requested varied face directions and frontal portraits in the existing homepage ensemble. GPT Image edited the original illustration; central strategist and rightmost woman now face the viewer. Left scholar, red-robed woman and armored warrior retain varied side/three-quarter angles. Five-person composition, props, ink-watercolor style, paper palette and mountain scenery are preserved.
- Output `public/art/home-reference/historical-ensemble-v2.webp` is 853×595, matching the original asset dimensions. Original asset retained. Generation prompt/source recorded in `design-concepts/home-face-orientations-v2.json`. Only the homepage asset reference and durable guidance changed; page layout and functionality are unchanged.
- Inspected generated asset and live iPhone/Pixel screenshots: new frontal faces are visible, no missing faces or obvious anatomy errors, no cropping at heads, soft bottom fade blends into paper and start action fits. Screenshots: `qa/home-v13-faces-iphone.png`, `qa/home-v13-faces-pixel.png`; cropped phone preview `qa/home-v13-faces-preview.png`.
- Build and integrity checks passed for all 28 protected runtime files. No scoring/runtime changes. Old preview had stopped; restarted the local Vite server and verified the updated page in a fresh in-app browser tab. Preview retained at http://localhost:4173/. No deployment.

final result: passed


## Share-page copy cleanup — 2026-10-18

- Source: user attachments `/var/folders/lp/n95737zd1wb0lqnkbjn07r9c0000gn/T/codex-clipboard-6d87196b-ab81-4642-b816-39470a1db23d.png` and `/var/folders/lp/n95737zd1wb0lqnkbjn07r9c0000gn/T/codex-clipboard-96854398-3c48-4f12-8ae3-2b43e9c1be7c.png`.
- Removed the share-page eyebrow, poster question/result-count line, poster caption and the entire circled helper area (manual fallback entry, link/privacy explanation and local-preview notice). Automatic failure recovery remains available.
- Visual evidence inspected: `qa/share-v13-clean.png` (393×852), `qa/poster-v13-clean.png` (actual downloaded 1080×1440 PNG), `qa/share-v13-comparison.jpg` and `qa/share-v13-detail.jpg`. Source crops were proportionally normalized to 393px width; source shows 卓文君 / 92%, implementation shows 谢道韫 / 86%. Comparison checks removal and layout rather than identical character state.
- Typography: existing font family and hierarchy preserved. Spacing: removed empty margins and moved poster summary upward to close the deleted line's gap. Colors: existing paper and cinnabar palette preserved. Artwork: character portrait and QR retained without overlap. Content: all four requested areas are absent, including the count line in the downloaded PNG.
- Browser validation: completed the 24-question flow, opened sharing, downloaded and inspected the PNG, and copied the result link with success feedback. No console errors or warnings. Save and copy controls remain visible in the phone viewport.
- Checks: runtime integrity passed for all 28 protected files; production build passed with the existing bundle-size advisory. No scoring or runtime changes. Local preview retained at http://localhost:4173/; no deployment.
- No open P0/P1/P2 findings.

final result: passed
