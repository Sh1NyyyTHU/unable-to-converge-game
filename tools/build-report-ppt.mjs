import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const runtimeRequire = createRequire(
  "C:/Users/chenwl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/"
);
const artifactTool = await import(pathToFileURL(runtimeRequire.resolve("@oai/artifact-tool")).href);

const {
  Presentation,
  PresentationFile,
  FileBlob,
  row,
  column,
  grid,
  layers,
  panel,
  text,
  image,
  shape,
  rule,
  fill,
  hug,
  fixed,
  fr,
  auto,
} = artifactTool;

const ROOT = process.cwd();
const OUT = path.join(ROOT, "output");
const RUN_STAMP = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const PREVIEW_DIR = path.join(OUT, `report-previews-${RUN_STAMP}`);
const PPTX_PREVIEW_DIR = path.join(OUT, `report-pptx-previews-${RUN_STAMP}`);
const DECK_PATH = path.join(OUT, `无法收敛-项目汇报-${RUN_STAMP}.pptx`);

const W = 1920;
const H = 1080;
const FONT = "Microsoft YaHei";

const C = {
  ink: "#fff2c2",
  muted: "#f0cb89",
  warm: "#d9853b",
  gold: "#ffd36c",
  green: "#9fd56f",
  blue: "#7ecbff",
  rose: "#ef8aa8",
  night: "#161629",
  brown: "#3b2114",
  paper: "#ffe0a3",
};

const assets = {
  start: "assets/pixel-backgrounds/start.png",
  day1: "assets/pixel-backgrounds/day1-network.png",
  day2: "assets/pixel-backgrounds/day2-document.png",
  day3: "assets/pixel-backgrounds/day3-room.png",
  day4: "assets/pixel-backgrounds/day4-presentation.png",
  night1: "assets/pixel-backgrounds/night1-family.png",
  night2: "assets/pixel-backgrounds/night2-friend.png",
  night3: "assets/pixel-backgrounds/night3-work.png",
  night4: "assets/backgrounds/night4-intimacy.png",
  ending: "assets/backgrounds/ending.png",
};

function asset(relPath) {
  const fullPath = path.join(ROOT, relPath);
  const bytes = fsSync.readFileSync(fullPath);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function tx(value, options = {}) {
  return text(value, {
    width: options.width ?? fill,
    height: options.height ?? hug,
    columnSpan: options.columnSpan,
    rowSpan: options.rowSpan,
    name: options.name,
    style: {
      fontFace: FONT,
      fontFamily: FONT,
      fontSize: options.size ?? 28,
      bold: options.bold ?? false,
      color: options.color ?? C.ink,
      textAlign: options.align ?? "left",
      lineSpacingMultiple: options.lineSpacingMultiple ?? 1.08,
      ...options.style,
    },
  });
}

function bgImage(relPath, overlay = "rgba(19, 13, 18, 0.58)") {
  return [
    image({
      name: `bg-${path.basename(relPath)}`,
      dataUrl: asset(relPath),
      width: fill,
      height: fill,
      fit: "cover",
      alt: "游戏场景背景",
    }),
    panel({ name: "bg-scrim", width: fill, height: fill, fill: overlay }),
  ];
}

function composeSlide(slide, children) {
  slide.compose(layers({ name: "slide-root", width: fill, height: fill }, children), {
    frame: { left: 0, top: 0, width: W, height: H },
    baseUnit: 8,
  });
}

function footer(label) {
  return row(
    {
      name: "footer-row",
      width: fill,
      height: hug,
      align: "center",
      justify: "between",
      padding: { x: 96, y: 52 },
    },
    [
      rule({ name: "footer-rule", width: fixed(180), stroke: "rgba(255, 211, 108, 0.68)", weight: 4 }),
      tx(label, { name: "footer-label", width: hug, size: 19, color: "rgba(255, 226, 165, 0.78)" }),
    ]
  );
}

function bigTitle(title, subtitle, kicker = "") {
  return column(
    { name: "title-stack", width: fill, height: hug, gap: 22 },
    [
      kicker
        ? tx(kicker, {
            name: "kicker",
            width: fill,
            size: 23,
            bold: true,
            color: C.gold,
            style: { characterSpacing: 1.2 },
          })
        : text("", { width: fixed(1), height: fixed(1), style: { fontSize: 1, color: "rgba(0,0,0,0)" } }),
      tx(title, {
        name: "slide-title",
        width: fill,
        size: 72,
        bold: true,
        color: C.ink,
        style: { lineSpacingMultiple: 0.98 },
      }),
      subtitle
        ? tx(subtitle, {
            name: "slide-subtitle",
            width: fixed(1180),
            size: 30,
            color: "rgba(255, 229, 177, 0.88)",
          })
        : text("", { width: fixed(1), height: fixed(1), style: { fontSize: 1, color: "rgba(0,0,0,0)" } }),
    ]
  );
}

function chip(label, color = C.gold) {
  return panel(
    {
      name: `chip-${label}`,
      width: hug,
      height: hug,
      padding: { x: 18, y: 10 },
      fill: "rgba(48, 28, 18, 0.76)",
      line: { color, width: 2 },
      borderRadius: 6,
    },
    tx(label, { width: hug, size: 19, bold: true, color })
  );
}

function thumb(relPath, label, tone = C.gold) {
  return panel(
    {
      name: `thumb-${label}`,
      width: fill,
      height: fill,
      fill: "rgba(0,0,0,0)",
      line: { color: "rgba(255, 222, 154, 0.34)", width: 2 },
      borderRadius: 10,
    },
    layers(
      { width: fill, height: fill },
      [
        image({ dataUrl: asset(relPath), width: fill, height: fill, fit: "cover", alt: label }),
        panel({ width: fill, height: fill, fill: "rgba(20, 14, 15, 0.34)" }),
        column(
          { width: fill, height: fill, justify: "end", padding: { x: 18, y: 16 } },
          [tx(label, { size: 21, bold: true, color: tone })]
        ),
      ]
    )
  );
}

function statBar(label, value, color) {
  return column(
    { width: fill, height: hug, gap: 10 },
    [
      row(
        { width: fill, height: hug, justify: "between", align: "center" },
        [
          tx(label, { width: hug, size: 24, color: C.ink, bold: true }),
          tx(String(value), { width: fixed(80), size: 24, color, bold: true, align: "right" }),
        ]
      ),
      layers(
        { width: fill, height: fixed(18) },
        [
          shape({ width: fill, height: fixed(18), fill: "rgba(255,255,255,0.14)", borderRadius: 9 }),
          shape({ width: fixed(Math.round(620 * value / 100)), height: fixed(18), fill: color, borderRadius: 9 }),
        ]
      ),
    ]
  );
}

function addCover(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    ...bgImage(assets.start, "rgba(27, 15, 16, 0.46)"),
    column(
      { width: fill, height: fill, padding: { x: 116, y: 96 }, justify: "between" },
      [
        row({ width: fill, height: hug, justify: "between", align: "center" }, [
          tx("项目汇报", { width: hug, size: 24, bold: true, color: C.gold }),
          tx("原生 HTML / Canvas 2D 叙事游戏", { width: hug, size: 22, color: "rgba(255, 226, 173, 0.82)" }),
        ]),
        column({ width: fixed(1240), height: hug, gap: 28 }, [
          tx("无法\n收敛", {
            name: "cover-title",
            width: fixed(900),
            size: 122,
            bold: true,
            color: "#fff4bd",
            style: { lineSpacingMultiple: 0.82 },
          }),
          tx("一个关于表达、误解与停止解释的叙事解谜游戏", {
            name: "cover-subtitle",
            width: fixed(1020),
            size: 34,
            color: "rgba(255, 229, 181, 0.92)",
          }),
          row({ width: hug, height: hug, gap: 16 }, [
            chip("白天：可验证问题", C.green),
            chip("夜晚：关系误读", C.rose),
            chip("结局：边界重构", C.gold),
          ]),
        ]),
        tx("作品主题 / 艺术形式 / 故事结构 / 视觉风格", {
          name: "cover-bottom",
          width: fill,
          size: 24,
          color: "rgba(255, 230, 177, 0.82)",
        }),
      ]
    ),
  ]);
}

function addThesis(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    grid(
      { name: "two-world-bg", width: fill, height: fill, columns: [fr(1), fr(1)] },
      [
        image({ dataUrl: asset(assets.day1), width: fill, height: fill, fit: "cover", alt: "白天电脑网络场景" }),
        image({ dataUrl: asset(assets.night1), width: fill, height: fill, fit: "cover", alt: "夜晚家庭对话场景" }),
      ]
    ),
    panel({ width: fill, height: fill, fill: "rgba(17, 12, 16, 0.60)" }),
    column(
      { width: fill, height: fill, padding: { x: 112, y: 86 }, justify: "between" },
      [
        bigTitle(
          "核心思想：\n能解决的问题会反馈，无法收敛的关系只会偏移",
          "游戏把“表达”设计成一个系统：白天给出明确输入和结果，夜晚则让解释不断被重新解释。",
          "01 / CORE IDEA"
        ),
        row({ width: fill, height: fixed(280), gap: 64, align: "end" }, [
          column({ width: fill, height: hug, gap: 12 }, [
            tx("白天", { size: 40, bold: true, color: C.green }),
            tx("问题可以拆分为步骤，可以验证，可以完成。玩家获得行动反馈。", {
              size: 27,
              color: "rgba(245, 230, 187, 0.9)",
            }),
          ]),
          column({ width: fill, height: hug, gap: 12 }, [
            tx("夜晚", { size: 40, bold: true, color: C.rose }),
            tx("误解没有单一答案。越解释，越可能被转译成新的压力。", {
              size: 27,
              color: "rgba(245, 230, 187, 0.9)",
            }),
          ]),
        ]),
      ]
    ),
  ]);
}

function addLoop(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    ...bgImage(assets.day4, "rgba(24, 15, 17, 0.72)"),
    column(
      { width: fill, height: fill, padding: { x: 96, y: 74 }, gap: 34 },
      [
        bigTitle("叙事结构：四天循环，两个世界", "每一天都先处理现实问题，再进入同主题的人际误解。", "02 / STRUCTURE"),
        grid(
          {
            width: fill,
            height: fill,
            columns: [fr(1), fr(1), fr(1), fr(1)],
            rows: [fr(1), fr(1)],
            columnGap: 18,
            rowGap: 18,
          },
          [
            thumb(assets.day1, "Day 1  修电脑网络", C.green),
            thumb(assets.day2, "Day 2  修改文档", C.green),
            thumb(assets.day3, "Day 3  整理房间", C.green),
            thumb(assets.day4, "Day 4  准备汇报", C.green),
            thumb(assets.night1, "Night 1  家庭对话", C.rose),
            thumb(assets.night2, "Night 2  朋友聊天", C.rose),
            thumb(assets.night3, "Night 3  工作沟通", C.rose),
            thumb(assets.night4, "Night 4  亲密关系", C.rose),
          ]
        ),
        footer("白天推进秩序，夜晚暴露偏移；循环本身就是主题。"),
      ]
    ),
  ]);
}

function addStory(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    ...bgImage(assets.night2, "rgba(15, 12, 24, 0.72)"),
    column(
      { width: fill, height: fill, padding: { x: 108, y: 82 }, gap: 46 },
      [
        bigTitle("故事内容：不是寻找真相，而是观察解释如何失效", "", "03 / STORY"),
        grid(
          { width: fill, height: fill, columns: [fr(0.92), fr(1.08)], columnGap: 90 },
          [
            column({ width: fill, height: fill, gap: 28 }, [
              tx("白天的四个问题", { size: 42, bold: true, color: C.green }),
              tx("网络断开\n文档混乱\n房间失序\n汇报未成形", {
                size: 40,
                bold: true,
                color: "#fff3c3",
                style: { lineSpacingMultiple: 1.16 },
              }),
              tx("它们都能被拆成动作：检查、整理、归位、练习。完成后世界变稳定。", {
                size: 27,
                color: "rgba(255, 230, 185, 0.88)",
              }),
            ]),
            column({ width: fill, height: fill, gap: 28 }, [
              tx("夜晚的四段关系", { size: 42, bold: true, color: C.rose }),
              tx("家人把疲惫听成指责\n朋友把休息听成疏远\n同事把风险听成否定\n亲密关系把边界听成冷淡", {
                size: 34,
                bold: true,
                color: "#ffe6b3",
                style: { lineSpacingMultiple: 1.18 },
              }),
              tx("玩家的核心体验不是“说服成功”，而是感到语言被不断改写。", {
                size: 27,
                color: "rgba(255, 230, 185, 0.88)",
              }),
            ]),
          ]
        ),
      ]
    ),
  ]);
}

function addMechanics(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    ...bgImage(assets.night3, "rgba(17, 12, 22, 0.76)"),
    column(
      { width: fill, height: fill, padding: { x: 96, y: 76 }, gap: 36 },
      [
        bigTitle("系统设计：选择不是正确答案，而是代价分配", "三类夜晚选择分别改变清晰度、理解率、解释成本和自我保留度。", "04 / MECHANICS"),
        grid(
          { width: fill, height: fill, columns: [fr(1.12), fr(0.88)], columnGap: 70 },
          [
            column({ width: fill, height: fill, gap: 20 }, [
              panel(
                {
                  width: fill,
                  height: hug,
                  padding: { x: 30, y: 26 },
                  fill: "rgba(70, 37, 24, 0.72)",
                  line: { color: "rgba(255, 211, 108, 0.45)", width: 2 },
                  borderRadius: 8,
                },
                column({ width: fill, height: hug, gap: 14 }, [
                  tx("更详细地解释", { size: 31, bold: true, color: C.gold }),
                  tx("清晰度上升，但成本变高；对方可能把原因听成责备。", { size: 24, color: C.ink }),
                ])
              ),
              panel(
                {
                  width: fill,
                  height: hug,
                  padding: { x: 30, y: 26 },
                  fill: "rgba(70, 37, 54, 0.72)",
                  line: { color: "rgba(239, 138, 168, 0.50)", width: 2 },
                  borderRadius: 8,
                },
                column({ width: fill, height: hug, gap: 14 }, [
                  tx("更委婉地表达", { size: 31, bold: true, color: C.rose }),
                  tx("冲突感降低，但误解会从新的入口进入。", { size: 24, color: C.ink }),
                ])
              ),
              panel(
                {
                  width: fill,
                  height: hug,
                  padding: { x: 30, y: 26 },
                  fill: "rgba(38, 73, 50, 0.70)",
                  line: { color: "rgba(159, 213, 111, 0.55)", width: 2 },
                  borderRadius: 8,
                },
                column({ width: fill, height: hug, gap: 14 }, [
                  tx("暂停解释，保护自己", { size: 31, bold: true, color: C.green }),
                  tx("不立刻修复关系，但停止把自我交给证明。", { size: 24, color: C.ink }),
                ])
              ),
            ]),
            column({ width: fill, height: fill, gap: 24, justify: "center" }, [
              statBar("表达清晰度", 65, C.blue),
              statBar("对方理解率", 42, C.green),
              statBar("解释成本", 80, "#f38b70"),
              statBar("自我保留度", 38, C.gold),
              tx("结局由这些指标共同决定：无限解释、沉默系统、边界重构。", {
                size: 26,
                bold: true,
                color: "rgba(255, 236, 188, 0.92)",
              }),
            ]),
          ]
        ),
      ]
    ),
  ]);
}

function addForm(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    ...bgImage(assets.start, "rgba(24, 15, 16, 0.76)"),
    column(
      { width: fill, height: fill, padding: { x: 112, y: 82 }, gap: 48 },
      [
        bigTitle("艺术形式：轻量网页游戏，把浏览器变成舞台", "", "05 / ART FORM"),
        grid({ width: fill, height: fill, columns: [fr(1.08), fr(0.92)], columnGap: 70 }, [
          column({ width: fill, height: fill, gap: 34, justify: "center" }, [
            tx("原生 HTML", { size: 58, bold: true, color: C.gold }),
            tx("+ CSS 响应式画布", { size: 58, bold: true, color: C.green }),
            tx("+ JavaScript 状态机", { size: 58, bold: true, color: C.rose }),
            tx("+ Canvas 2D 绘制", { size: 58, bold: true, color: C.blue }),
          ]),
          panel(
            {
              width: fill,
              height: fill,
              padding: { x: 40, y: 36 },
              fill: "rgba(255, 224, 163, 0.10)",
              line: { color: "rgba(255, 211, 108, 0.38)", width: 2 },
              borderRadius: 10,
            },
            column({ width: fill, height: fill, gap: 24, justify: "center" }, [
              tx("形式服务主题", { size: 36, bold: true, color: C.ink }),
              tx("没有复杂操作、没有战斗系统，只有点击选择和数值反馈。玩家被迫关注语言本身的偏移。", {
                size: 29,
                color: "rgba(255, 232, 187, 0.9)",
              }),
              tx("轻量网页也方便部署、分享和课堂/展览现场演示。", {
                size: 29,
                color: "rgba(255, 232, 187, 0.9)",
              }),
            ])
          ),
        ]),
      ]
    ),
  ]);
}

function addVisualStyle(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    panel({ width: fill, height: fill, fill: "#24171d" }),
    column(
      { width: fill, height: fill, padding: { x: 96, y: 72 }, gap: 34 },
      [
        bigTitle("画风：像素化生活场景 + 复古对话 UI", "画面不是为了写实，而是把日常经验压缩成可识别的情绪空间。", "06 / VISUAL STYLE"),
        grid(
          { width: fill, height: fixed(520), columns: [fr(1.15), fr(0.85), fr(0.85)], columnGap: 22 },
          [
            thumb(assets.day3, "暖色白天：秩序与行动", C.green),
            thumb(assets.night4, "冷紫夜晚：不安与防御", C.rose),
            thumb(assets.ending, "结局空间：余波与停顿", C.gold),
          ]
        ),
        row({ width: fill, height: hug, gap: 18, align: "center" }, [
          chip("像素颗粒", C.gold),
          chip("低饱和背景", C.muted),
          chip("高对比 UI", C.ink),
          chip("人物头像符号化", C.rose),
          chip("扫描线与抖动感", C.blue),
        ]),
      ]
    ),
  ]);
}

function addSoundRhythm(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    ...bgImage(assets.night1, "rgba(14, 12, 25, 0.76)"),
    column(
      { width: fill, height: fill, padding: { x: 112, y: 84 }, gap: 52 },
      [
        bigTitle("声音与节奏：让玩家在昼夜之间换气", "", "07 / AUDIO & RHYTHM"),
        grid({ width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 80 }, [
          column({ width: fill, height: fill, gap: 28, justify: "center" }, [
            tx("三段 BGM", { size: 52, bold: true, color: C.gold }),
            tx("day.m4a：白天行动\nnight.m4a：夜晚压力\nending.m4a：结局回声", {
              size: 36,
              bold: true,
              color: C.ink,
              style: { lineSpacingMultiple: 1.24 },
            }),
            tx("音乐随场景自动切换，开始页保持静默，避免在玩家未交互前打破浏览器播放规则。", {
              size: 27,
              color: "rgba(255, 232, 190, 0.88)",
            }),
          ]),
          column({ width: fill, height: fill, gap: 30, justify: "center" }, [
            row({ width: fill, height: fixed(84), gap: 10, align: "end" },
              Array.from({ length: 18 }, (_, i) =>
                shape({
                  width: fill,
                  height: fixed(26 + ((i * 17) % 55)),
                  fill: i % 3 === 0 ? C.green : i % 3 === 1 ? C.rose : C.gold,
                  borderRadius: 4,
                })
              )
            ),
            tx("交互节奏", { size: 44, bold: true, color: C.rose }),
            tx("白天：点击正确步骤，得到反馈。\n夜晚：每个按钮都是一种表达策略，也是一种损耗方式。", {
              size: 31,
              color: C.ink,
              style: { lineSpacingMultiple: 1.18 },
            }),
          ]),
        ]),
      ]
    ),
  ]);
}

function addMeaning(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    ...bgImage(assets.ending, "rgba(17, 13, 20, 0.64)"),
    column(
      { width: fill, height: fill, padding: { x: 112, y: 90 }, justify: "between" },
      [
        bigTitle("作品价值：把“说清楚”从道德要求变成可被质疑的机制", "", "08 / MEANING"),
        tx("玩家最终带走的不是一套沟通技巧，而是一个更尖锐的问题：\n当关系把每次解释都改写成新误解时，我是否还必须继续解释？", {
          name: "meaning-claim",
          width: fixed(1360),
          size: 48,
          bold: true,
          color: "#fff3bd",
          style: { lineSpacingMultiple: 1.12 },
        }),
        row({ width: fill, height: hug, gap: 22 }, [
          chip("适合课堂讨论", C.green),
          chip("适合互动展陈", C.gold),
          chip("适合继续扩写章节", C.rose),
        ]),
      ]
    ),
  ]);
}

function addRoadmap(presentation) {
  const slide = presentation.slides.add();
  composeSlide(slide, [
    ...bgImage(assets.day2, "rgba(23, 14, 15, 0.74)"),
    column(
      { width: fill, height: fill, padding: { x: 112, y: 84 }, gap: 52 },
      [
        bigTitle("后续方向：从短篇原型扩展为可复玩的叙事系统", "", "09 / NEXT"),
        grid({ width: fill, height: fill, columns: [fr(1), fr(1), fr(1)], columnGap: 42 }, [
          column({ width: fill, height: fill, gap: 20, justify: "center" }, [
            tx("内容扩展", { size: 42, bold: true, color: C.gold }),
            tx("增加更多天数、更多关系类型，让误解模式形成可比较的谱系。", { size: 30, color: C.ink }),
          ]),
          column({ width: fill, height: fill, gap: 20, justify: "center" }, [
            tx("系统扩展", { size: 42, bold: true, color: C.green }),
            tx("加入存档、章节选择、音量控制，让玩家回看不同选择的代价。", { size: 30, color: C.ink }),
          ]),
          column({ width: fill, height: fill, gap: 20, justify: "center" }, [
            tx("表现扩展", { size: 42, bold: true, color: C.rose }),
            tx("为结局增加专属画面、音效和更明确的情绪转场。", { size: 30, color: C.ink }),
          ]),
        ]),
        footer("汇报重点：主题明确，形式轻量，视听风格和机制共同服务“无法收敛”的体验。"),
      ]
    ),
  ]);
}

async function saveNativeBlob(blob, filePath) {
  const buffer = Buffer.from(await blob.arrayBuffer());
  await fs.writeFile(filePath, buffer);
}

async function exportPreviews(presentation, dir) {
  await fs.mkdir(dir, { recursive: true });
  for (let i = 0; i < presentation.slides.count; i += 1) {
    const slide = presentation.slides.getItem(i);
    const png = await slide.export({ format: "png" });
    await saveNativeBlob(png, path.join(dir, `slide-${String(i + 1).padStart(2, "0")}.png`));
    const layout = await slide.export({ format: "layout" });
    await saveNativeBlob(layout, path.join(dir, `slide-${String(i + 1).padStart(2, "0")}.layout.json`));
  }
}

async function build() {
  await fs.mkdir(OUT, { recursive: true });

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  addCover(presentation);
  addThesis(presentation);
  addLoop(presentation);
  addStory(presentation);
  addMechanics(presentation);
  addForm(presentation);
  addVisualStyle(presentation);
  addSoundRhythm(presentation);
  addMeaning(presentation);
  addRoadmap(presentation);

  await exportPreviews(presentation, PREVIEW_DIR);

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(DECK_PATH);

  let pptxParity = "not_checked";
  try {
    const imported = await PresentationFile.importPptx(await FileBlob.load(DECK_PATH));
    await exportPreviews(imported, PPTX_PREVIEW_DIR);
    pptxParity = "checked";
  } catch (error) {
    pptxParity = `failed: ${error.message}`;
  }

  console.log(JSON.stringify({
    deck: DECK_PATH,
    previews: PREVIEW_DIR,
    pptxPreviews: PPTX_PREVIEW_DIR,
    slideCount: presentation.slides.count,
    pptxParity,
  }, null, 2));
}

await build();
