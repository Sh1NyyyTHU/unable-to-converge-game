"use strict";

const BASE_WIDTH = 960;
const BASE_HEIGHT = 540;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 触屏设备检测
const IS_TOUCH_DEVICE = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

let dpr = 1;
let mouse = { x: -1, y: -1 };
let buttons = [];
let hotspots = [];
let jitterTick = 0;
let animationStarted = false;

const BACKGROUND_SOURCES = {
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

const AUDIO_SOURCES = {
  day: "assets/audio/day.m4a",
  night: "assets/audio/night.m4a",
  ending: "assets/audio/ending.m4a",
};

const BackgroundImages = Object.fromEntries(
  Object.entries(BACKGROUND_SOURCES).map(([key, src]) => {
    const image = new Image();
    image.src = src;
    return [key, image];
  })
);

const AudioManager = {
  unlocked: false,
  activeMode: null,
  volume: 0.42,
  tracks: typeof Audio === "function"
    ? Object.fromEntries(
        Object.entries(AUDIO_SOURCES).map(([key, src]) => {
          const audio = new Audio(src);
          audio.loop = true;
          audio.preload = "auto";
          audio.volume = 0.42;
          return [key, audio];
        })
      )
    : {},

  unlock() {
    this.unlocked = true;
  },

  play(mode) {
    if (!this.unlocked || !this.tracks[mode]) {
      return;
    }

    if (this.activeMode === mode && !this.tracks[mode].paused) {
      return;
    }

    this.stopInactiveTracks(mode);
    this.activeMode = mode;

    const track = this.tracks[mode];
    track.volume = this.volume;
    track.play().catch(() => {
      // Some browsers may still block playback until a stronger user gesture.
    });
  },

  stopInactiveTracks(mode) {
    Object.entries(this.tracks).forEach(([key, track]) => {
      if (key === mode) {
        return;
      }
      track.pause();
      track.currentTime = 0;
    });
  },

  stop() {
    Object.values(this.tracks).forEach((track) => {
      track.pause();
      track.currentTime = 0;
    });
    this.activeMode = null;
  },

  syncWithScene() {
    if (GameState.scene === "day" || GameState.scene === "dayResult") {
      this.play("day");
      return;
    }

    if (GameState.scene === "night" || GameState.scene === "nightResult") {
      this.play("night");
      return;
    }

    if (GameState.scene === "ending") {
      this.play("ending");
      return;
    }

    this.stop();
  },
};

const NIGHT_EFFECTS = {
  detail: {
    label: "更详细地解释",
    hint: "补充背景、过程和原因。",
    shortcut: "1",
    delta: { clarity: 10, understanding: -5, cost: 15, self: -8 },
  },
  gentle: {
    label: "更委婉地表达",
    hint: "降低语气，避免刺激对方。",
    shortcut: "2",
    delta: { clarity: 8, understanding: -3, cost: 12, self: -6 },
  },
  pause: {
    label: "暂停解释，保护自己",
    hint: "停止追加说明，保留边界。",
    shortcut: "3",
    delta: { clarity: 0, understanding: 0, cost: -5, self: 8 },
  },
  reframe: {
    label: "换个角度重新表达",
    hint: "承认感受，但不接受归因。",
    shortcut: "4",
    delta: { clarity: 6, understanding: 2, cost: 8, self: -2 },
  },
};

const NIGHT_PORTRAITS = {
  1: {
    name: "家人",
    style: "family",
    skin: "#e7ad7b",
    hair: "#53351f",
    shirt: "#9c5c2c",
    accent: "#f0c06c",
    bg: "#91b878",
  },
  2: {
    name: "朋友",
    style: "friend",
    skin: "#efb986",
    hair: "#c46b38",
    shirt: "#4f8a56",
    accent: "#f3d26f",
    bg: "#78a8b8",
  },
  3: {
    name: "同事",
    style: "coworker",
    skin: "#dfaa78",
    hair: "#2f2922",
    shirt: "#566f9b",
    accent: "#e4d7b0",
    bg: "#8c8fa3",
  },
  4: {
    name: "对方",
    style: "partner",
    skin: "#efb58f",
    hair: "#8f463e",
    shirt: "#9b5c77",
    accent: "#f1b17c",
    bg: "#9b789c",
  },
};

const DAY_SCENE_AREA = { x: 50, y: 92, w: 860, h: 274 };

const DAY_HOTSPOTS = {
  1: [
    {
      id: "computer",
      label: "断网电脑",
      action: "检查网络",
      step: 0,
      x: 356,
      y: 132,
      w: 222,
      h: 112,
      feedback: "你点击了电脑。网络图标是灰色，网页和消息都无法连接。",
    },
    {
      id: "router",
      label: "路由器",
      action: "重启路由器",
      step: 1,
      x: 646,
      y: 176,
      w: 128,
      h: 68,
      feedback: "你长按路由器电源，等待指示灯重新稳定亮起。",
    },
    {
      id: "wifi",
      label: "重新连接",
      action: "重新连接",
      step: 2,
      x: 452,
      y: 160,
      w: 84,
      h: 64,
      feedback: "你在电脑上重新连接网络，页面终于刷新出来。",
    },
    {
      id: "lamp",
      label: "台灯",
      wrong: "台灯照亮了桌面，但网络不会因此恢复。",
      x: 210,
      y: 138,
      w: 92,
      h: 118,
    },
  ],
  2: [
    {
      id: "paragraphs",
      label: "长段落",
      action: "拆分段落",
      step: 0,
      x: 298,
      y: 126,
      w: 176,
      h: 150,
      feedback: "你把长段落拆开，阅读阻力明显下降。",
    },
    {
      id: "arrows",
      label: "顺序箭头",
      action: "调整顺序",
      step: 1,
      x: 492,
      y: 138,
      w: 160,
      h: 130,
      feedback: "你按原因、过程、结论重新排列内容。",
    },
    {
      id: "conclusion",
      label: "结论标记",
      action: "突出结论",
      step: 2,
      x: 662,
      y: 154,
      w: 138,
      h: 104,
      feedback: "你把结论放到最容易看见的位置，审核人终于抓住重点。",
    },
    {
      id: "font-color",
      label: "字体颜色",
      wrong: "换颜色只能制造新的噪声，不能修正逻辑顺序。",
      x: 160,
      y: 144,
      w: 96,
      h: 86,
    },
  ],
  3: [
    {
      id: "shirt",
      label: "床上的衣服",
      action: "分类物品",
      step: 0,
      group: "clothes",
      required: 3,
      x: 248,
      y: 164,
      w: 118,
      h: 60,
      feedback: "衣服被先放进待收纳的一堆。",
    },
    {
      id: "socks",
      label: "地上的袜子",
      action: "分类物品",
      step: 0,
      group: "clothes",
      required: 3,
      x: 450,
      y: 238,
      w: 96,
      h: 54,
      feedback: "袜子被拣出来，和衣物放到一起。",
    },
    {
      id: "pants",
      label: "椅边裤子",
      action: "分类物品",
      step: 0,
      group: "clothes",
      required: 3,
      x: 594,
      y: 194,
      w: 118,
      h: 70,
      feedback: "最后一件散落衣物也被分类好了。",
    },
    {
      id: "bottle",
      label: "空瓶",
      action: "丢弃垃圾",
      step: 1,
      group: "trash",
      required: 2,
      x: 318,
      y: 246,
      w: 56,
      h: 72,
      feedback: "空瓶被丢进垃圾袋，地面露出一小块。",
    },
    {
      id: "wrapper",
      label: "旧包装",
      action: "丢弃垃圾",
      step: 1,
      group: "trash",
      required: 2,
      x: 730,
      y: 244,
      w: 84,
      h: 56,
      feedback: "旧包装被清走，房间的噪声少了一层。",
    },
    {
      id: "wardrobe",
      label: "收纳柜",
      action: "归位收纳",
      step: 2,
      x: 662,
      y: 118,
      w: 128,
      h: 132,
      feedback: "衣物和杂物被放回合适的位置，空间恢复秩序。",
    },
    {
      id: "phone",
      label: "手机",
      wrong: "刷手机会让房间保持原状。先处理眼前的物品。",
      x: 548,
      y: 292,
      w: 74,
      h: 36,
    },
  ],
  4: [
    {
      id: "outline",
      label: "提纲便签",
      action: "整理提纲",
      step: 0,
      x: 264,
      y: 142,
      w: 138,
      h: 120,
      feedback: "汇报提纲确定：背景、问题、方案、结论。",
    },
    {
      id: "slides",
      label: "幻灯片",
      action: "制作幻灯片",
      step: 1,
      x: 438,
      y: 120,
      w: 202,
      h: 146,
      feedback: "幻灯片只保留必要信息，每页对应一个重点。",
    },
    {
      id: "mic",
      label: "练习表达",
      action: "练习表达",
      step: 2,
      x: 676,
      y: 154,
      w: 120,
      h: 108,
      feedback: "你练习了一遍，把卡顿的地方重新改顺。",
    },
    {
      id: "cover-only",
      label: "封面",
      wrong: "只做封面会让内容继续散着。先把骨架搭起来。",
      x: 146,
      y: 156,
      w: 92,
      h: 118,
    },
  ],
};

// 拖拽目标区域：每个白天任务步骤对应的拖放目标
const DAY_DROP_TARGETS = {
  1: [
    { x: 620, y: 144, w: 180, h: 100, label: "拖到路由器区域", step: 0 },
    { x: 430, y: 130, w: 140, h: 90, label: "拖到电脑网络图标", step: 1 },
    { x: 480, y: 155, w: 60, h: 50, label: "拖到连接按钮", step: 2 },
  ],
  2: [
    { x: 298, y: 126, w: 176, h: 150, label: "拖到文档段落区", step: 0 },
    { x: 492, y: 138, w: 160, h: 130, label: "拖到排序箭头区", step: 1 },
    { x: 662, y: 154, w: 138, h: 104, label: "拖到结论标记区", step: 2 },
  ],
  3: [
    { x: 430, y: 180, w: 220, h: 120, label: "拖到分类收纳区", step: 0 },
    { x: 280, y: 260, w: 160, h: 70, label: "拖到垃圾处理区", step: 1 },
    { x: 662, y: 118, w: 128, h: 132, label: "拖到收纳柜", step: 2 },
  ],
  4: [
    { x: 264, y: 142, w: 138, h: 120, label: "拖到提纲区", step: 0 },
    { x: 438, y: 120, w: 202, h: 146, label: "拖到幻灯片区", step: 1 },
    { x: 676, y: 154, w: 120, h: 108, label: "拖到练习区", step: 2 },
  ],
};

// 连击奖励阈值
const COMBO_THRESHOLDS = [3, 6, 10, 15];

const DAY_TASKS = [
  {
    day: 1,
    title: "修电脑网络问题",
    scene: "白天 / 书桌",
    problem: "电脑右下角的网络图标变成灰色。网页打不开，消息也发不出去。",
    steps: ["检查网络", "重启路由器", "重新连接"],
    wrong: ["清空桌面图标", "调整屏幕亮度", "重装输入法"],
    progress: [
      "你确认不是网页本身的问题，网络确实断开了。",
      "路由器重新启动，指示灯开始稳定闪烁。",
      "电脑重新连上网络。页面刷新出来，问题解决。",
    ],
    solved: "连接恢复。这个问题有明确的原因，也有明确的反馈。",
  },
  {
    day: 2,
    title: "修改工作文档",
    scene: "白天 / 办公桌",
    problem: "文档堆满长段落，逻辑顺序跳跃，结论被埋在细节里。",
    steps: ["拆分段落", "调整顺序", "突出结论"],
    wrong: ["更换字体颜色", "增加更多形容词", "复制旧版本"],
    progress: [
      "长段被拆开，阅读阻力明显下降。",
      "内容按原因、过程、结论重新排列。",
      "结论被放到开头和小节末尾，审核人终于看懂重点。",
    ],
    solved: "文档通过审核。具体问题可以被拆开，也可以被验证。",
  },
  {
    day: 3,
    title: "整理房间",
    scene: "白天 / 房间",
    problem: "衣服、纸箱、杂物散在地上。你几乎找不到可以落脚的位置。",
    steps: ["分类物品", "丢弃垃圾", "归位收纳"],
    wrong: ["把灯调暗", "坐下刷手机", "换一张床单"],
    progress: [
      "物品被分成衣物、文件、杂物和待丢弃几类。",
      "空盒子和旧包装被清走，地面露了出来。",
      "常用物放到手边，不常用的收进柜子。房间恢复秩序。",
    ],
    solved: "空间变清楚了。混乱不是消失，而是被放回合适的位置。",
  },
  {
    day: 4,
    title: "准备汇报",
    scene: "白天 / 会议室",
    problem: "明天要汇报，你需要把材料整理成别人能跟上的表达。",
    steps: ["整理提纲", "制作幻灯片", "练习表达"],
    wrong: ["临时换主题", "只做封面", "等待灵感出现"],
    progress: [
      "提纲确定：背景、问题、方案、结论。",
      "幻灯片只保留必要信息，每页对应一个重点。",
      "你练习了一遍，把卡顿的地方重新改顺。",
    ],
    solved: "汇报准备完成。能解决的问题，通常会在行动后变得更稳定。",
  },
];

const NIGHT_DIALOGUES = [
  {
    day: 1,
    title: "家庭对话",
    scene: "夜晚 / 餐桌",
    goal: "让家人理解：我只是有点累，不是对你有意见。",
    player: "我最近只是有点累。",
    other: "你每天就知道说累，谁不累？",
    responses: {
      detail: {
        player: "我不是抱怨，只是最近事情比较多，白天处理完以后有点透支。",
        other: "所以你还是觉得我们给你压力了？",
        note: "你把原因说得更完整了，但对方把原因听成了责备。",
      },
      gentle: {
        player: "我没有别的意思，可能只是今天状态不太好。",
        other: "你现在连话都不想好好说了？",
        note: "语气变轻了，误解却换了一个入口。",
      },
      pause: {
        player: "我先休息一会儿，等状态好一点再聊。",
        other: "你又在逃避。",
        note: "误解没有马上消失，但你没有继续把自己耗进去。",
      },
      reframe: {
        player: "我听到你觉得被忽视了。我确实累了，但这不改变我对你的在意。",
        other: "你嘴上说在意，但行动上完全看不出来。",
        note: "你承认了对方的感受，但没有接受归因。对方暂时无法接住这个区分。",
      },
    },
    followUp: {
      player: "我想把话说清楚一点。",
      other: "你看，你还是觉得我们不理解你。",
    },
    responses2: {
      detail: {
        player: "我不是在评价你们，我只是在描述自己的状态。",
        other: "你现在连家里人都要分得这么清楚了？",
        note: "解释变得更精确，关系里的防御却没有下降。",
      },
      gentle: {
        player: "可能是我表达得不好，我只是需要一点休息。",
        other: "那不还是我们让你没法休息吗？",
        note: "你把责任往自己身上收了一点，对方仍然听见了指责。",
      },
      pause: {
        player: "我不继续解释了。我现在需要休息。",
        other: "随便你。",
        note: "对话没有变温和，但你保住了停止的权利。",
      },
      reframe: {
        player: "我不是在争论谁对谁错。我只是需要先恢复能量，然后再好好谈。",
        other: "等你恢复了也还是这些话。",
        note: "你试图把冲突和时间分开，但对方的预期没有改变。",
      },
    },
  },
  {
    day: 2,
    title: "朋友聊天",
    scene: "夜晚 / 手机屏幕",
    goal: "让朋友理解：我只是需要休息，不是不把你当朋友。",
    player: "我最近状态不太好，想自己待一会儿。",
    other: "你是不是不把我当朋友了？",
    responses: {
      detail: {
        player: "不是，我只是需要一点安静的时间，不是针对你，也不是要疏远你。",
        other: "你解释这么多，听起来就是已经在疏远了。",
        note: "你试图消除歧义，但对方从解释长度里读出了距离。",
      },
      gentle: {
        player: "我很在意你，只是这两天可能没办法及时回应。",
        other: "真的在意就不会让我等。",
        note: "你降低了冲突感，却没有改变对方的判断标准。",
      },
      pause: {
        player: "我今天先不继续聊了，明天再回复你。",
        other: "好吧，随你。",
        note: "关系没有被立刻修复，但你的休息没有继续被谈判。",
      },
      reframe: {
        player: "我理解你可能觉得被冷落了。我确实在退后，但不是从你这里退后。",
        other: "那你能不能说清楚你到底需要什么？",
        note: "你承认了对方的感受，也表达了边界。对方开始问具体问题了。",
      },
    },
    followUp: {
      player: "我需要休息，但这不代表关系变了。",
      other: "你越这样说，我越觉得你在推开我。",
    },
    responses2: {
      detail: {
        player: "我只是短时间没办法保持高频回应，不是减少对你的重视。",
        other: "你已经开始给友情排优先级了。",
        note: "你解释了边界，对方却把边界理解成降级。",
      },
      gentle: {
        player: "我怕说得太硬会伤到你，所以想慢一点讲。",
        other: "所以你也知道这句话会伤人。",
        note: "委婉没有减少误读，只让对方抓住了新的重点。",
      },
      pause: {
        player: "我今天到这里。等我休息好再联系你。",
        other: "嗯。",
        note: "没有得到完整理解，但你没有继续透支来换即时回应。",
      },
      reframe: {
        player: "我对你的重视不需要用秒回来证明。但如果你需要确认，我可以说清楚。",
        other: "你说吧，我听着。",
        note: "你把证明的压力从自己身上卸掉，同时给了对方一个可接收的位置。",
      },
    },
  },
  {
    day: 3,
    title: "工作沟通",
    scene: "夜晚 / 聊天窗口",
    goal: "让同事理解：我指出文件问题是为了减少风险，不是在否定你。",
    player: "这个文件里有几个数据可能需要再检查一下。",
    other: "你是不是觉得我工作做得不好？",
    responses: {
      detail: {
        player: "我不是评价你，只是这些数据会影响后续判断，所以想提前排除风险。",
        other: "你还是觉得我没有把关好。",
        note: "你把目标讲清楚了，但对方仍然把问题听成评价。",
      },
      gentle: {
        player: "可能我看得也不一定对，要不我们一起再确认一下？",
        other: "你这么说不就是觉得我不可靠吗？",
        note: "你让出了一部分确定性，对方却把让步理解成试探。",
      },
      pause: {
        player: "我先把需要复核的地方标出来，明天按文件本身处理。",
        other: "行，你标吧。",
        note: "你把沟通拉回任务，没有继续证明自己的动机。",
      },
      reframe: {
        player: "我理解被指出问题会让人不舒服。我的目标只是让交付更安全，不是评价你。",
        other: "你说得好听，但挑错的时候也没见你客气。",
        note: "你区分了流程和评价，但对方还没准备好接受这个区分。",
      },
    },
    followUp: {
      player: "我讨论的是文件风险，不是个人评价。",
      other: "你把这两件事分开说，就是在暗示我有问题。",
    },
    responses2: {
      detail: {
        player: "如果数据没问题，复核会让文件更稳；如果有问题，现在改成本最低。",
        other: "你连我会出错都已经预设好了。",
        note: "你的逻辑更完整了，对方仍然把流程听成了不信任。",
      },
      gentle: {
        player: "我可能说得太直接了，但我的关注点只是交付风险。",
        other: "你现在是在说我玻璃心吗？",
        note: "你降低了锋利度，却没有改变对方的归因。",
      },
      pause: {
        player: "我先不讨论动机，只把复核项写清楚。",
        other: "那就按你说的来。",
        note: "任务继续推进，你也停止为自己的善意辩护。",
      },
      reframe: {
        player: "你做的部分我没问题。只是这几个数据点会影响整体判断，我们一起过一遍？",
        other: "行，你说哪几个。",
        note: "你把焦点从人转移到具体数据，对方终于开始看向文件本身。",
      },
    },
  },
  {
    day: 4,
    title: "亲密关系对话",
    scene: "夜晚 / 房间",
    goal: "让对方理解：我今天冷淡是因为累，不是不在乎你。",
    player: "我今天有点累，不是针对你。",
    other: "你是不是不喜欢我了？",
    responses: {
      detail: {
        player: "我在乎你，只是今天消耗太大，反应慢不是因为感情变少。",
        other: "如果真的在乎，为什么还要让我猜？",
        note: "你努力把事实和感情分开，对方却只接住了不安。",
      },
      gentle: {
        player: "对不起，我可能表现得不够好，但我不是不在乎你。",
        other: "你看，你也知道自己变了。",
        note: "道歉让语气变软，也让对方获得了新的证据。",
      },
      pause: {
        player: "我不想在很累的时候证明感情。我们明天再谈。",
        other: "你现在连证明都不愿意了。",
        note: "对方仍然不满意，但你第一次没有把自己放进无尽证明里。",
      },
      reframe: {
        player: "我听到你在担心。我不是不爱你了，只是今天太累，没办法用你想要的方式回应。",
        other: "那为什么以前可以，现在不可以？",
        note: "你接住了对方的情绪，但对方把'现在做不到'听成了'变心了'。",
      },
    },
    followUp: {
      player: "我需要先恢复，不想在疲惫时争论。",
      other: "那你就是把我放在最后。",
    },
    responses2: {
      detail: {
        player: "我不是把你放在最后，我是不想用很差的状态回应重要的人。",
        other: "重要的人还需要排队等你有状态？",
        note: "你试图证明重视，对方却把等待理解成被冷落。",
      },
      gentle: {
        player: "我知道你会难受，但我今天真的没有余力继续谈。",
        other: "你知道我难受还停下来？",
        note: "共情没有带来接收，反而被改写成新的亏欠。",
      },
      pause: {
        player: "我不会在疲惫时继续证明爱。明天再谈。",
        other: "你就是不愿意面对。",
        note: "误解仍在，但你没有把边界交出去。",
      },
      reframe: {
        player: "我没办法用疲惫的状态给出好的回应。等明天我状态恢复，我们再认真谈。",
        other: "那我就等你到明天。",
        note: "你没有证明爱，但给了明确的时间。对方虽然不甘，但接受了延后。",
      },
    },
  },
];

const GameState = {
  scene: "start",
  day: 1,
  phase: "day",
  clarity: 50,
  understanding: 50,
  cost: 0,
  self: 100,
  dayStep: 0,
  feedback: "",
  nightChoice: null,
  nightRound: 0,
  ending: null,
  // 拖拽系统
  isDragging: false,
  dragHotspot: null,
  dragX: 0,
  dragY: 0,
  dragOffsetX: 0,
  dragOffsetY: 0,
  // 粒子系统
  particles: [],
  // 连击系统
  combo: 0,
  comboMax: 0,
  comboTimer: 0,
  lastActionTime: 0,
  // 过渡动画
  transitionAlpha: 1,
  transitionTarget: null,
  isTransitioning: false,
  // 决策日志
  decisionLog: [],
  showLog: false,
  // 音效开关
  sfxEnabled: true,
  // 触屏候选
  touchCandidate: null,
};

class Button {
  constructor(x, y, w, h, label, onClick, options = {}) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
    this.onClick = onClick;
    this.subLabel = options.subLabel || "";
    this.kind = options.kind || "primary";
    this.disabled = options.disabled || false;
    this.multiline = options.multiline || false;
    this.fontSize = options.fontSize || 17;
    this.maxLines = options.maxLines || 2;
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  draw(context) {
    const hovering = !this.disabled && this.contains(mouse.x, mouse.y);
    const palette = getButtonPalette(this.kind, hovering, this.disabled);

    context.save();
    context.fillStyle = palette.shadow;
    context.fillRect(this.x + 4, this.y + 5, this.w, this.h);
    roundRect(context, this.x, this.y, this.w, this.h, 4);
    context.fillStyle = palette.fill;
    context.fill();
    context.lineWidth = hovering ? 4 : 3;
    context.strokeStyle = palette.outer;
    context.stroke();
    context.lineWidth = 1;
    context.strokeStyle = palette.stroke;
    context.strokeRect(this.x + 6, this.y + 6, this.w - 12, this.h - 12);

    context.fillStyle = palette.text;
    context.font = `700 ${this.fontSize}px Microsoft YaHei, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    if (this.multiline) {
      drawButtonText(context, this.label, this.x + this.w / 2, this.y + this.h / 2, this.w - 22, this.fontSize + 4, this.maxLines);
    } else {
      context.fillText(this.label, this.x + this.w / 2, this.y + (this.subLabel ? 24 : this.h / 2));
    }

    if (this.subLabel) {
      context.fillStyle = palette.subText;
      context.font = "13px Microsoft YaHei, sans-serif";
      context.fillText(this.subLabel, this.x + this.w / 2, this.y + 50);
    }
    context.restore();
  }
}

function getButtonPalette(kind, hovering, disabled) {
  if (disabled) {
    return {
      fill: "rgba(91, 68, 45, 0.58)",
      outer: "#3f2a1c",
      stroke: "rgba(238, 205, 139, 0.16)",
      shadow: "rgba(20, 12, 7, 0.35)",
      text: "rgba(244, 221, 166, 0.48)",
      subText: "rgba(244, 221, 166, 0.34)",
    };
  }

  const palettes = {
    primary: {
      fill: hovering ? "#b96a31" : "#8e4f2b",
      outer: "#3b2114",
      stroke: hovering ? "#ffd77c" : "#d59c55",
      shadow: "rgba(36, 20, 10, 0.54)",
      text: "#fff4c7",
      subText: "#f3dca0",
    },
    calm: {
      fill: hovering ? "#4f9b55" : "#397845",
      outer: "#17381e",
      stroke: hovering ? "#d7f294" : "#93c96b",
      shadow: "rgba(12, 38, 20, 0.52)",
      text: "#fbffd4",
      subText: "#d6ec9e",
    },
    danger: {
      fill: hovering ? "#9b4f68" : "#73374f",
      outer: "#341729",
      stroke: hovering ? "#ffc0a0" : "#d8897b",
      shadow: "rgba(32, 14, 22, 0.5)",
      text: "#fff1d0",
      subText: "#e6c09c",
    },
    ghost: {
      fill: hovering ? "rgba(98, 119, 70, 0.42)" : "rgba(84, 91, 61, 0.32)",
      outer: "#2e2f20",
      stroke: hovering ? "#d5d58b" : "#978c5d",
      shadow: "rgba(18, 18, 10, 0.36)",
      text: "#fff0bd",
      subText: "#cdbd8a",
    },
  };

  return palettes[kind] || palettes.primary;
}

// ===== 粒子系统 =====
class Particle {
  constructor(x, y, vx, vy, color, life, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.size = size || 3;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.08;
    this.life -= 1;
  }

  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.restore();
  }

  get alive() {
    return this.life > 0;
  }
}

function spawnParticles(x, y, count, color, spread, life, size) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * (spread || 3)) + 0.5;
    GameState.particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 1,
      color || "#ffd36c",
      (life || 30) + Math.floor(Math.random() * 15),
      size || 3
    ));
  }
}

// ===== 音效系统（使用振荡器合成，无需外部文件）=====
const SFX = {
  audioCtx: null,

  init() {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        // 不支持
      }
    }
  },

  play(freq, duration, type, volume, ramp) {
    if (!GameState.sfxEnabled || !this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type || "square";
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime((volume || 0.08), this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + (duration || 0.12));
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + (duration || 0.12));
    } catch (e) {
      // 静默处理
    }
  },

  click() { this.play(800, 0.06, "square", 0.06); },
  success() { this.play(523, 0.1, "square", 0.08); this.play(659, 0.1, "square", 0.08); setTimeout(() => this.play(784, 0.15, "square", 0.08), 80); },
  error() { this.play(150, 0.2, "sawtooth", 0.07); },
  combo() { this.play(880, 0.08, "square", 0.06); setTimeout(() => this.play(1100, 0.08, "square", 0.06), 60); },
  transition() { this.play(440, 0.2, "sine", 0.05); setTimeout(() => this.play(330, 0.3, "sine", 0.05), 120); },
};

function resetGame() {
  Object.assign(GameState, {
    scene: "start",
    day: 1,
    phase: "day",
    clarity: 50,
    understanding: 50,
    cost: 0,
    self: 100,
    dayStep: 0,
    dayObjectState: {},
    feedback: "",
    nightChoice: null,
    nightRound: 0,
    ending: null,
    isDragging: false,
    dragHotspot: null,
    dragX: 0,
    dragY: 0,
    particles: [],
    combo: 0,
    comboMax: 0,
    comboTimer: 0,
    lastActionTime: 0,
    transitionAlpha: 1,
    transitionTarget: null,
    isTransitioning: false,
    decisionLog: [],
    showLog: false,
    touchCandidate: null,
  });
}

function startGame() {
  Object.assign(GameState, {
    scene: "day",
    day: 1,
    phase: "day",
    dayStep: 0,
    dayObjectState: {},
    feedback: "拖拽高亮物件到虚线目标区域，按合理顺序处理问题。",
    nightChoice: null,
    nightRound: 0,
    combo: 0,
    comboMax: 0,
    comboTimer: 0,
    lastActionTime: Date.now(),
    decisionLog: [{ day: 1, phase: "day", action: "游戏开始", time: new Date().toLocaleTimeString() }],
  });
  SFX.init();
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

// ===== 连击系统 =====
function updateCombo(success) {
  const now = Date.now();
  const timeSinceLastAction = now - GameState.lastActionTime;
  GameState.lastActionTime = now;

  if (success) {
    if (timeSinceLastAction < 8000) {
      GameState.combo += 1;
      GameState.comboMax = Math.max(GameState.comboMax, GameState.combo);
      if (GameState.combo >= 3) {
        SFX.combo();
      }
    } else {
      GameState.combo = 1;
    }
  } else {
    GameState.combo = 0;
  }
}

function getComboBonus() {
  if (GameState.combo >= 15) return { clarity: 3, self: 3, label: "完美节奏 ×15+" };
  if (GameState.combo >= 10) return { clarity: 2, self: 2, label: "行云流水 ×10" };
  if (GameState.combo >= 6) return { clarity: 1, self: 1, label: "渐入佳境 ×6" };
  if (GameState.combo >= 3) return { clarity: 0, self: 1, label: "连续行动 ×3" };
  return null;
}

// ===== 过渡动画 =====
function startTransition(targetScene, callback) {
  GameState.isTransitioning = true;
  GameState.transitionTarget = { scene: targetScene, callback };
  GameState.transitionAlpha = 0;
}

function updateTransition() {
  if (!GameState.isTransitioning) return;

  if (GameState.transitionAlpha < 1) {
    GameState.transitionAlpha += 0.06;
    if (GameState.transitionAlpha >= 1) {
      GameState.transitionAlpha = 1;
      if (GameState.transitionTarget) {
        GameState.transitionTarget.callback();
        AudioManager.syncWithScene();
        SFX.transition();
      }
      GameState.isTransitioning = false;
      GameState.transitionTarget = null;
    }
  }
}

function drawTransitionOverlay() {
  if (!GameState.isTransitioning) return;

  const alpha = GameState.transitionAlpha < 0.5
    ? GameState.transitionAlpha * 2
    : (1 - GameState.transitionAlpha) * 2;

  ctx.save();
  ctx.fillStyle = `rgba(18, 12, 24, ${alpha})`;
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  // 扫描线效果
  for (let y = 0; y < BASE_HEIGHT; y += 4) {
    if (y % 8 < 4) {
      ctx.fillStyle = `rgba(255, 230, 160, ${alpha * 0.08})`;
      ctx.fillRect(0, y, BASE_WIDTH, 2);
    }
  }
  ctx.restore();
}

// ===== 决策日志 =====
function addDecision(action, detail) {
  GameState.decisionLog.push({
    day: GameState.day,
    phase: GameState.phase,
    action,
    detail: detail || "",
    time: new Date().toLocaleTimeString(),
    clarity: GameState.clarity,
    understanding: GameState.understanding,
    cost: GameState.cost,
    self: GameState.self,
  });
}

function drawDecisionLog() {
  if (!GameState.showLog) return;

  ctx.save();
  ctx.fillStyle = "rgba(18, 10, 22, 0.92)";
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  ctx.fillStyle = "#ffd36c";
  ctx.font = "700 26px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("📋 决策日志", BASE_WIDTH / 2, 50);

  ctx.fillStyle = "#a0a0c0";
  ctx.font = "13px Microsoft YaHei, sans-serif";
  ctx.fillText("按 Tab 键关闭", BASE_WIDTH / 2, 78);

  const logs = GameState.decisionLog.slice(-12);
  ctx.textAlign = "left";
  logs.forEach((log, i) => {
    const y = 110 + i * 34;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,230,160,0.08)" : "rgba(0,0,0,0.2)";
    ctx.fillRect(60, y - 8, 840, 30);

    ctx.fillStyle = log.phase === "night" ? "#f0a8cc" : "#c9ef82";
    ctx.font = "600 13px Microsoft YaHei, sans-serif";
    ctx.fillText(`D${log.day} ${log.phase === "night" ? "🌙" : "☀️"}`, 75, y + 12);

    ctx.fillStyle = "#eee0c0";
    ctx.font = "13px Microsoft YaHei, sans-serif";
    ctx.fillText(log.action, 150, y + 12);

    ctx.fillStyle = "#988868";
    ctx.font = "11px Microsoft YaHei, sans-serif";
    ctx.fillText(`C:${log.clarity} U:${log.understanding} $:${log.cost} S:${log.self}`, 520, y + 12);

    ctx.fillStyle = "#666680";
    ctx.fillText(log.time, 750, y + 12);
  });

  ctx.restore();
}

function applyStats(delta) {
  GameState.clarity = clamp(GameState.clarity + (delta.clarity || 0));
  GameState.understanding = clamp(GameState.understanding + (delta.understanding || 0));
  GameState.cost = clamp(GameState.cost + (delta.cost || 0));
  GameState.self = clamp(GameState.self + (delta.self || 0));
}

function getCurrentDayTask() {
  return DAY_TASKS[GameState.day - 1];
}

function getCurrentNightDialogue() {
  return NIGHT_DIALOGUES[GameState.day - 1];
}

function getCurrentNightPrompt() {
  const dialogue = getCurrentNightDialogue();
  if (GameState.nightRound === 0) {
    return { player: dialogue.player, other: dialogue.other };
  }
  return dialogue.followUp;
}

function getCurrentNightResponse(choice) {
  const dialogue = getCurrentNightDialogue();
  return GameState.nightRound === 0 ? dialogue.responses[choice] : dialogue.responses2[choice];
}

function getDayState() {
  const key = String(GameState.day);
  if (!GameState.dayObjectState[key]) {
    GameState.dayObjectState[key] = { clicked: {}, groups: {} };
  }
  return GameState.dayObjectState[key];
}

function completeDayStep(feedback) {
  const task = getCurrentDayTask();
  GameState.feedback = feedback || task.progress[GameState.dayStep];
  GameState.dayStep += 1;

  updateCombo(true);
  const comboBonus = getComboBonus();
  const baseStats = { clarity: 5, self: 5 };

  if (comboBonus) {
    baseStats.clarity += comboBonus.clarity || 0;
    baseStats.self += comboBonus.self || 0;
    GameState.feedback += ` [${comboBonus.label}]`;
  }

  applyStats(baseStats);
  SFX.success();

  if (GameState.dayStep >= task.steps.length) {
    addDecision("白天完成", `${task.title} - ${task.solved}`);
    startTransition("dayResult", () => {
      GameState.scene = "dayResult";
      GameState.feedback = task.solved;
    });
  }
}

function handleDayHotspot(hotspot) {
  const task = getCurrentDayTask();
  const expected = task.steps[GameState.dayStep];
  const state = getDayState();

  if (hotspot.wrong) {
    GameState.feedback = hotspot.wrong;
    updateCombo(false);
    SFX.error();
    spawnParticles(hotspot.x + hotspot.w / 2, hotspot.y + hotspot.h / 2, 8, "#f38b70", 2, 20, 2);
    return;
  }

  if (hotspot.step !== GameState.dayStep || hotspot.action !== expected) {
    GameState.feedback = `现在需要"${expected}"。"${hotspot.label}"还不是当前关键点。（提示：试试拖动物件到高亮目标区域）`;
    SFX.error();
    return;
  }

  if (hotspot.group) {
    const group = state.groups[hotspot.group] || [];
    if (!group.includes(hotspot.id)) {
      group.push(hotspot.id);
      state.groups[hotspot.group] = group;
    }
    state.clicked[hotspot.id] = true;

    const remaining = hotspot.required - group.length;
    if (remaining > 0) {
      GameState.feedback = `${hotspot.feedback} 还剩 ${remaining} 个相关物件。`;
      SFX.click();
      spawnParticles(hotspot.x + hotspot.w / 2, hotspot.y + hotspot.h / 2, 5, "#ffd36c", 1.5, 15, 2);
      addDecision("收集物件", hotspot.label);
      return;
    }
  }

  state.clicked[hotspot.id] = true;
  spawnParticles(hotspot.x + hotspot.w / 2, hotspot.y + hotspot.h / 2, 12, "#9fd56f", 3, 25, 3);
  addDecision("正确操作", hotspot.label);
  completeDayStep(hotspot.feedback);
}

class Hotspot {
  constructor(config) {
    Object.assign(this, config);
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  draw(context) {
    const hovering = this.contains(mouse.x, mouse.y);
    const current = this.step === GameState.dayStep && !this.wrong;
    const done = isHotspotDone(this);

    if (done && this.group) {
      drawCollectedMarker(context, this);
      return;
    }

    context.save();
    context.globalAlpha = current ? 1 : 0.58;

    if (current || hovering) {
      const pulse = 0.45 + Math.sin(jitterTick * 0.08) * 0.16;
      context.fillStyle = hovering ? "rgba(255, 220, 116, 0.16)" : `rgba(159, 213, 111, ${pulse * 0.18})`;
      roundRect(context, this.x, this.y, this.w, this.h, 6);
      context.fill();
      context.lineWidth = hovering ? 4 : 3;
      context.strokeStyle = hovering ? "#fff0a6" : "#9fd56f";
      context.stroke();
    }

    if (hovering || current) {
      drawHotspotTag(context, this);
    }
    context.restore();
  }
}


function handleNightChoice(choice) {
  GameState.nightChoice = choice;
  applyStats(NIGHT_EFFECTS[choice].delta);
  GameState.feedback = getCurrentNightResponse(choice).note;

  updateCombo(choice !== "pause");
  spawnParticles(480, 330, 15, "#f0a8cc", 4, 30, 4);
  SFX.click();
  addDecision("夜晚回应", NIGHT_EFFECTS[choice].label);

  startTransition("nightResult", () => {
    GameState.scene = "nightResult";
  });
}

function goToNight() {
  addDecision("进入夜晚", `第${GameState.day}天 · ${getCurrentNightDialogue().title}`);
  SFX.transition();
  startTransition("night", () => {
    GameState.scene = "night";
    GameState.phase = "night";
    GameState.nightChoice = null;
    GameState.nightRound = 0;
    GameState.feedback = "你试着把意思说清楚。";
  });
}

function continueNightDialogue() {
  GameState.nightRound += 1;
  SFX.transition();
  startTransition("night", () => {
    GameState.scene = "night";
    GameState.nightChoice = null;
    GameState.feedback = "误解没有消失。你还可以继续解释，也可以停下来。";
  });
}

function goToNextDayOrEnding() {
  if (GameState.day >= 4) {
    resolveEnding();
    addDecision("游戏结局", GameState.ending.title);
    SFX.transition();
    startTransition("ending", () => {
      GameState.scene = "ending";
    });
    return;
  }

  GameState.day += 1;
  GameState.phase = "day";
  GameState.dayStep = 0;
  GameState.dayObjectState = {};
  GameState.nightRound = 0;
  SFX.transition();
  startTransition("day", () => {
    GameState.scene = "day";
    GameState.nightChoice = null;
    GameState.feedback = "新的一天开始。拖拽场景中的物件到目标区域，一步步处理具体问题。";
    addDecision("新的一天", `第${GameState.day}天开始`);
  });
}

function resolveEnding() {
  if (GameState.cost >= 80 || GameState.self <= 25) {
    GameState.ending = {
      title: "结局一：无限解释",
      text: "你终于学会了如何不引发争执。代价是，你越来越少说出真实的自己。",
    };
  } else if (GameState.clarity <= 40 && GameState.understanding <= 40) {
    GameState.ending = {
      title: "结局二：沉默系统",
      text: "系统稳定了，因为它不再接收输入。没有争执，也没有理解。",
    };
  } else {
    GameState.ending = {
      title: "结局三：边界重构",
      text: "你仍然无法让所有人理解你。但你终于明白，无法收敛的关系，不一定需要继续训练。",
    };
  }
}

function resizeCanvasForDpr() {
  dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(BASE_WIDTH * dpr);
  canvas.height = Math.floor(BASE_HEIGHT * dpr);
  canvas.style.width = "min(100%, 960px)";
  canvas.style.height = "auto";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * BASE_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * BASE_HEIGHT,
  };
}

canvas.addEventListener("mousemove", (event) => {
  mouse = getPointerPosition(event);

  // 拖拽中更新位置
  if (GameState.isDragging && GameState.dragHotspot) {
    GameState.dragX = mouse.x - GameState.dragOffsetX;
    GameState.dragY = mouse.y - GameState.dragOffsetY;
  }

  const hoveringButton = buttons.some((button) => !button.disabled && button.contains(mouse.x, mouse.y));
  const hoveringHotspot = !GameState.isDragging && hotspots.some((hotspot) => hotspot.contains(mouse.x, mouse.y));
  const hoveringDropTarget = GameState.isDragging && getCurrentDropTarget() && getCurrentDropTarget().contains(mouse.x, mouse.y);

  if (GameState.isDragging) {
    canvas.style.cursor = hoveringDropTarget ? "grabbing" : "grabbing";
  } else if (hoveringButton || hoveringHotspot) {
    canvas.style.cursor = "pointer";
  } else if (getCurrentDropTarget() && getCurrentDropTarget().contains(mouse.x, mouse.y)) {
    canvas.style.cursor = "grab";
  } else {
    canvas.style.cursor = "default";
  }
});

canvas.addEventListener("mouseleave", () => {
  mouse = { x: -1, y: -1 };
  if (GameState.isDragging) {
    endDrag(false);
  }
});

canvas.addEventListener("mousedown", (event) => {
  mouse = getPointerPosition(event);
  AudioManager.unlock();
  SFX.init();

  // 左键拖拽
  const hotspot = findHotspotAt(mouse.x, mouse.y);
  if (hotspot && isCurrentStepHotspot(hotspot) && !isHotspotDone(hotspot) && !hotspot.wrong) {
    GameState.isDragging = true;
    GameState.dragHotspot = hotspot;
    GameState.dragOffsetX = mouse.x - hotspot.x;
    GameState.dragOffsetY = mouse.y - hotspot.y;
    GameState.dragX = hotspot.x;
    GameState.dragY = hotspot.y;
    SFX.click();
    return;
  }
});

canvas.addEventListener("mouseup", (event) => {
  if (!GameState.isDragging) return;

  mouse = getPointerPosition(event);
  const dropTarget = getCurrentDropTarget();
  const hotspot = GameState.dragHotspot;

  if (dropTarget && dropTarget.contains(mouse.x, mouse.y)) {
    // 成功拖到目标
    spawnParticles(dropTarget.x + dropTarget.w / 2, dropTarget.y + dropTarget.h / 2, 20, "#ffd36c", 5, 35, 4);
    SFX.success();
    endDrag(true);
    if (hotspot && hotspot.onClick) {
      hotspot.onClick();
    }
  } else {
    // 拖放失败，弹回
    endDrag(false);
  }
});

canvas.addEventListener("click", (event) => {
  if (GameState.isDragging) return;

  mouse = getPointerPosition(event);
  AudioManager.unlock();
  SFX.init();
  const hit = buttons.find((button) => !button.disabled && button.contains(mouse.x, mouse.y));
  if (hit) {
    hit.onClick();
    AudioManager.syncWithScene();
    return;
  }

  const hotspot = findHotspotAt(mouse.x, mouse.y);
  if (hotspot) {
    hotspot.onClick();
    AudioManager.syncWithScene();
  }
});

// 键盘快捷键
window.addEventListener("keydown", (event) => {
  // Tab 切换决策日志
  if (event.key === "Tab") {
    event.preventDefault();
    GameState.showLog = !GameState.showLog;
    return;
  }

  // 夜晚场景快捷键
  if (GameState.scene === "night" && !GameState.isTransitioning) {
    const choices = Object.keys(NIGHT_EFFECTS);
    const index = parseInt(event.key) - 1;
    if (index >= 0 && index < choices.length) {
      handleNightChoice(choices[index]);
      AudioManager.syncWithScene();
      return;
    }
  }

  // 夜晚结果页面快捷键
  if (GameState.scene === "nightResult" && !GameState.isTransitioning) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const canContinueNight = GameState.nightRound === 0;
      if (canContinueNight) {
        continueNightDialogue();
      } else {
        goToNextDayOrEnding();
      }
      AudioManager.syncWithScene();
      return;
    }
  }

  // 白天结果页面快捷键
  if (GameState.scene === "dayResult" && !GameState.isTransitioning) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToNight();
      AudioManager.syncWithScene();
      return;
    }
  }

  // 结局页
  if (GameState.scene === "ending" && !GameState.isTransitioning) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      resetGame();
      AudioManager.syncWithScene();
      return;
    }
  }

  // S 键开关音效
  if (event.key === "s" || event.key === "S") {
    GameState.sfxEnabled = !GameState.sfxEnabled;
  }
});

// ===== 移动端触屏支持 =====
let touchStartPos = { x: 0, y: 0 };
let touchStartTime = 0;
let touchMoved = false;
const TAP_MOVE_THRESHOLD = 12; // 移动超过此像素视为拖拽，否则为点击
const TAP_TIME_THRESHOLD = 300; // 超过此毫秒视为长按
let touchRipple = null; // 触摸涟漪 { x, y, alpha, radius }

canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  const touch = event.touches[0];
  const pos = getPointerPosition(touch);
  mouse = pos;
  touchStartPos = { x: pos.x, y: pos.y };
  touchStartTime = Date.now();
  touchMoved = false;

  // iOS AudioContext 必须在用户手势中恢复
  AudioManager.unlock();
  SFX.init();
  if (SFX.audioCtx && SFX.audioCtx.state === "suspended") {
    SFX.audioCtx.resume();
  }

  // 检查是否在可拖拽的热点上
  const hotspot = findHotspotAt(pos.x, pos.y);
  if (hotspot && isCurrentStepHotspot(hotspot) && !isHotspotDone(hotspot) && !hotspot.wrong) {
    // 不立即开始拖拽，等 move 超过阈值
    GameState.touchCandidate = hotspot;
    // 显示触摸涟漪
    touchRipple = { x: pos.x, y: pos.y, alpha: 0.6, radius: 4, maxRadius: 28 };
  } else {
    GameState.touchCandidate = null;
  }
}, { passive: false });

canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  const touch = event.touches[0];
  const pos = getPointerPosition(touch);
  mouse = pos;

  const dx = pos.x - touchStartPos.x;
  const dy = pos.y - touchStartPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // 移动到阈值以上才开始拖拽
  if (!touchMoved && distance >= TAP_MOVE_THRESHOLD) {
    touchMoved = true;
    touchRipple = null; // 取消涟漪

    if (GameState.touchCandidate) {
      const h = GameState.touchCandidate;
      GameState.isDragging = true;
      GameState.dragHotspot = h;
      GameState.dragOffsetX = touchStartPos.x - h.x;
      GameState.dragOffsetY = touchStartPos.y - h.y;
      GameState.dragX = h.x;
      GameState.dragY = h.y;
      GameState.touchCandidate = null;
      SFX.click();
    }
  }

  if (GameState.isDragging && GameState.dragHotspot) {
    GameState.dragX = pos.x - GameState.dragOffsetX;
    GameState.dragY = pos.y - GameState.dragOffsetY;
  }
}, { passive: false });

canvas.addEventListener("touchend", (event) => {
  event.preventDefault();
  GameState.touchCandidate = null;

  const elapsed = Date.now() - touchStartTime;

  if (GameState.isDragging) {
    // 拖拽结束
    const dropTarget = getCurrentDropTarget();
    const hotspot = GameState.dragHotspot;

    if (dropTarget && dropTarget.contains(mouse.x, mouse.y)) {
      spawnParticles(dropTarget.x + dropTarget.w / 2, dropTarget.y + dropTarget.h / 2, 20, "#ffd36c", 5, 35, 4);
      SFX.success();
      endDrag(true);
      if (hotspot && hotspot.onClick) {
        hotspot.onClick();
      }
    } else {
      endDrag(false);
    }
  } else if (!touchMoved && elapsed < TAP_TIME_THRESHOLD) {
    // 轻触（tap）：优先热点，其次按钮
    const hotspot = findHotspotAt(mouse.x, mouse.y);
    if (hotspot) {
      touchRipple = { x: mouse.x, y: mouse.y, alpha: 0.5, radius: 4, maxRadius: 22 };
      SFX.click();
      if (hotspot.onClick) {
        hotspot.onClick();
        AudioManager.syncWithScene();
      }
    } else {
      const hit = buttons.find((button) => !button.disabled && button.contains(mouse.x, mouse.y));
      if (hit) {
        touchRipple = { x: mouse.x, y: mouse.y, alpha: 0.5, radius: 4, maxRadius: 22 };
        SFX.click();
        hit.onClick();
        AudioManager.syncWithScene();
      }
    }
  }
  // 长按不做任何事（防止 iOS 文本选择等）
}, { passive: false });

canvas.addEventListener("touchcancel", (event) => {
  // 触摸被打断（如来电、系统手势等）
  GameState.touchCandidate = null;
  touchRipple = null;
  if (GameState.isDragging) {
    endDrag(false);
  }
});

// 绘制触摸涟漪
function drawTouchRipple() {
  if (!touchRipple) return;

  touchRipple.radius += (touchRipple.maxRadius - touchRipple.radius) * 0.3;
  touchRipple.alpha -= 0.04;

  if (touchRipple.alpha <= 0) {
    touchRipple = null;
    return;
  }

  ctx.save();
  ctx.globalAlpha = touchRipple.alpha;
  ctx.strokeStyle = "#ffd36c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(touchRipple.x, touchRipple.y, touchRipple.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

window.addEventListener("resize", resizeCanvasForDpr);

function startRenderLoop() {
  if (animationStarted) {
    return;
  }
  animationStarted = true;
  requestAnimationFrame(renderFrame);
}

function renderFrame() {
  updateTransition();
  updateParticles();
  draw();
  requestAnimationFrame(renderFrame);
}

function updateParticles() {
  GameState.particles = GameState.particles.filter(p => {
    p.update();
    return p.alive;
  });
}

function draw() {
  buttons = [];
  hotspots = [];
  jitterTick += 1;
  ctx.imageSmoothingEnabled = false;
  resetTextState(ctx);

  if (GameState.scene === "start") {
    drawStart();
  } else if (GameState.scene === "day") {
    drawDay();
  } else if (GameState.scene === "dayResult") {
    drawDayResult();
  } else if (GameState.scene === "night") {
    drawNight();
  } else if (GameState.scene === "nightResult") {
    drawNightResult();
  } else if (GameState.scene === "ending") {
    drawEnding();
  }

  buttons.forEach((button) => button.draw(ctx));

  // 绘制拖放目标区域
  drawDropTarget();

  // 绘制拖拽中的物件
  drawDraggedItem();

  // 绘制粒子
  GameState.particles.forEach(p => p.draw(ctx));

  // 绘制过渡效果
  drawTransitionOverlay();

  // 绘制决策日志
  drawDecisionLog();

  // 绘制连击指示器
  drawComboIndicator();

  // 绘制触摸涟漪
  drawTouchRipple();
}

// ===== 拖拽辅助函数 =====
function isCurrentStepHotspot(hotspot) {
  const task = getCurrentDayTask();
  if (!task) return false;
  const expected = task.steps[GameState.dayStep];
  return hotspot.step === GameState.dayStep && hotspot.action === expected && !hotspot.wrong;
}

class DropTarget {
  constructor(x, y, w, h, label, step) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
    this.step = step;
  }

  contains(px, py) {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
}

function getCurrentDropTarget() {
  if (GameState.scene !== "day") return null;
  const targets = DAY_DROP_TARGETS[GameState.day];
  if (!targets) return null;
  const target = targets[GameState.dayStep];
  if (!target) return null;
  return new DropTarget(target.x, target.y, target.w, target.h, target.label, target.step);
}

function drawDropTarget() {
  if (GameState.scene !== "day" || GameState.isTransitioning) return;

  const target = getCurrentDropTarget();
  if (!target) return;

  const pulse = 0.5 + Math.sin(jitterTick * 0.06) * 0.2;
  const hovering = target.contains(mouse.x, mouse.y);
  const dragging = GameState.isDragging;

  ctx.save();
  ctx.globalAlpha = dragging ? (hovering ? 0.45 : 0.25) : pulse * 0.35;
  ctx.setLineDash([8, 4]);
  ctx.lineDashOffset = jitterTick * 0.5;

  ctx.strokeStyle = hovering && dragging ? "#ffd36c" : "#9fd56f";
  ctx.lineWidth = hovering && dragging ? 4 : 3;
  ctx.strokeRect(target.x, target.y, target.w, target.h);

  ctx.fillStyle = hovering && dragging ? "rgba(255, 211, 108, 0.12)" : "rgba(159, 213, 111, 0.06)";
  ctx.fillRect(target.x, target.y, target.w, target.h);

  // 目标标记
  ctx.setLineDash([]);
  ctx.fillStyle = hovering && dragging ? "#ffd36c" : "rgba(159, 213, 111, 0.7)";
  ctx.font = "600 13px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(dragging ? "释放到这里" : "拖拽目标 → " + target.label, target.x + target.w / 2, target.y - 6);

  // 十字准星
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  ctx.strokeStyle = hovering && dragging ? "#ffd36c" : "rgba(159, 213, 111, 0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  ctx.restore();
}

function drawDraggedItem() {
  if (!GameState.isDragging || !GameState.dragHotspot) return;

  const h = GameState.dragHotspot;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(255, 211, 108, 0.25)";
  roundRect(ctx, GameState.dragX, GameState.dragY, h.w, h.h, 6);
  ctx.fill();
  ctx.strokeStyle = "#ffd36c";
  ctx.lineWidth = 3;
  ctx.setLineDash([4, 2]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#fff4c7";
  ctx.font = "700 15px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(h.label, GameState.dragX + h.w / 2, GameState.dragY + h.h / 2);

  // 拖拽粒子尾迹
  if (jitterTick % 2 === 0) {
    spawnParticles(GameState.dragX + h.w / 2, GameState.dragY + h.h / 2, 1, "#ffd36c", 1, 8, 2);
  }

  ctx.restore();
}

function endDrag(success) {
  if (!success && GameState.dragHotspot) {
    SFX.error();
    spawnParticles(
      GameState.dragX + GameState.dragHotspot.w / 2,
      GameState.dragY + GameState.dragHotspot.h / 2,
      6, "#f38b70", 2, 15, 2
    );
  }
  GameState.isDragging = false;
  GameState.dragHotspot = null;
  GameState.dragX = 0;
  GameState.dragY = 0;
}

// ===== 连击指示器 =====
function drawComboIndicator() {
  if (GameState.combo < 3) return;

  const now = Date.now();
  const timeSinceAction = now - GameState.lastActionTime;
  if (timeSinceAction > 5000) return;

  const alpha = Math.min(1, (5000 - timeSinceAction) / 1000);
  const pulse = 1 + Math.sin(jitterTick * 0.1) * 0.1;

  ctx.save();
  ctx.globalAlpha = alpha;

  const comboBonus = getComboBonus();
  const label = comboBonus ? comboBonus.label : `连击 ×${GameState.combo}`;

  ctx.fillStyle = "#3a1d25";
  ctx.fillRect(BASE_WIDTH - 220, 82, 200, 28);
  ctx.fillStyle = "#7b3a45";
  ctx.fillRect(BASE_WIDTH - 222, 80, 200, 28);

  ctx.font = `700 ${Math.floor(14 * pulse)}px Microsoft YaHei, sans-serif`;
  ctx.fillStyle = "#ffd36c";
  ctx.textAlign = "center";
  ctx.fillText(`🔥 ${label}`, BASE_WIDTH - 120, 100);
  ctx.restore();
}

function findHotspotAt(x, y) {
  for (let i = hotspots.length - 1; i >= 0; i--) {
    if (hotspots[i].contains(x, y)) return hotspots[i];
  }
  return null;
}

function drawStart() {
  drawBaseBackground("start");
  drawTitleBlock("无法收敛", "一个关于表达、误解与停止解释的叙事游戏");

  ctx.save();
  ctx.fillStyle = "#fff0bd";
  ctx.font = "18px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  wrapText(
    ctx,
    "白天的问题有步骤、有反馈、有完成。夜晚的误解却不断偏移，越解释越像一个无法收敛的系统。",
    BASE_WIDTH / 2,
    256,
    640,
    30
  );

  drawConvergenceDiagram(360, 330);
  ctx.restore();

  buttons.push(new Button(390, 430, 180, 54, "开始游戏", startGame, { kind: "primary" }));
}

function drawDay() {
  const task = getCurrentDayTask();
  drawBaseBackground("day");
  drawHeader(task.scene);
  drawStatusBars();
  drawDayScene(task);

  drawPanel(42, 386, 876, 118, "rgba(83, 48, 26, 0.88)", "#d6a65b");

  ctx.fillStyle = "#fff1bd";
  ctx.font = "700 24px Microsoft YaHei, sans-serif";
  ctx.fillText(task.title, 68, 422);

  ctx.fillStyle = "#ead0a0";
  ctx.font = "16px Microsoft YaHei, sans-serif";
  wrapText(ctx, task.problem, 68, 452, 560, 23);

  ctx.fillStyle = "#c8e082";
  ctx.font = "15px Microsoft YaHei, sans-serif";
  ctx.fillText(`当前目标：${task.steps[GameState.dayStep]}（${GameState.dayStep + 1} / ${task.steps.length}）`, 650, 422);

  ctx.fillStyle = "#ffe8aa";
  ctx.font = "15px Microsoft YaHei, sans-serif";
  wrapText(ctx, GameState.feedback, 650, 452, 230, 22);
  drawDayProgressTrail(task);
}

function drawDayResult() {
  const task = getCurrentDayTask();
  drawBaseBackground("day");
  drawHeader(task.scene);
  drawStatusBars();
  drawDayScene(task, true);

  drawPanel(170, 300, 620, 150, "rgba(76, 92, 44, 0.88)", "#d8be68");
  ctx.fillStyle = "#fff4bf";
  ctx.font = "700 26px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("白天任务完成", BASE_WIDTH / 2, 342);

  ctx.fillStyle = "#f5dba3";
  ctx.font = "17px Microsoft YaHei, sans-serif";
  wrapText(ctx, GameState.feedback, BASE_WIDTH / 2, 378, 520, 26, "center");

  buttons.push(new Button(390, 460, 180, 48, "进入夜晚", goToNight, { kind: "calm" }));
}

function drawNight() {
  const dialogue = getCurrentNightDialogue();
  const prompt = getCurrentNightPrompt();
  drawBaseBackground("night");
  drawHeader(dialogue.scene);
  drawStatusBars();
  drawNightScene(dialogue);
  drawWarningMessages();

  drawCharacterDialogueBox({
    dialogue,
    heading: dialogue.title,
    goal: dialogue.goal,
    playerText: prompt.player,
    otherText: prompt.other,
    note: "",
    portraitKey: dialogue.day,
  });

  const choiceKeys = Object.keys(NIGHT_EFFECTS);
  const btnWidth = 160;
  const startX = 58;
  const gap = (640 - btnWidth * 4) / 3;

  choiceKeys.forEach((choice, index) => {
    const label = getCurrentNightResponse(choice).player;
    const effect = NIGHT_EFFECTS[choice];
    const kindMap = { pause: "calm", reframe: "ghost", detail: "danger", gentle: "danger" };

    buttons.push(
      new Button(
        startX + index * (btnWidth + gap), 430, btnWidth, 58,
        `[${effect.shortcut}] ${label}`,
        () => handleNightChoice(choice),
        {
          kind: kindMap[choice] || "danger",
          multiline: true,
          fontSize: 12,
          maxLines: 3,
          subLabel: effect.hint,
        }
      )
    );
  });

  // 快捷键提示（根据设备类型）
  ctx.save();
  ctx.fillStyle = "rgba(255,230,160,0.45)";
  ctx.font = "12px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  if (IS_TOUCH_DEVICE) {
    ctx.fillText("💡 轻触选项按钮进行回应  |  长按场景物件进行拖拽", BASE_WIDTH / 2, 510);
  } else {
    ctx.fillText("💡 按键 1-4 快速选择  |  Tab 查看决策日志  |  S 开关音效", BASE_WIDTH / 2, 510);
  }
  ctx.restore();
}

function drawNightResult() {
  const dialogue = getCurrentNightDialogue();
  const choice = GameState.nightChoice;
  if (!choice || !NIGHT_EFFECTS[choice]) return; // 过渡期间的安全检查

  const result = getCurrentNightResponse(choice);
  drawBaseBackground("night");
  drawHeader(dialogue.scene);
  drawStatusBars();
  drawNightScene(dialogue, true);
  drawWarningMessages();

  drawCharacterDialogueBox({
    dialogue,
    heading: NIGHT_EFFECTS[choice].label,
    goal: "",
    playerText: result.player,
    otherText: result.other,
    note: GameState.feedback,
    portraitKey: dialogue.day,
  });

  const canContinueNight = GameState.nightRound === 0;
  buttons.push(
    new Button(
      450,
      444,
      150,
      42,
      canContinueNight ? "继续对话" : GameState.day >= 4 ? "查看结局" : "下一天",
      canContinueNight ? continueNightDialogue : goToNextDayOrEnding,
      { kind: "primary" }
    )
  );
}

function drawEnding() {
  drawBaseBackground("ending");
  drawStatusBars();

  ctx.save();
  ctx.fillStyle = "rgba(255, 229, 158, 0.18)";
  for (let i = 0; i < 12; i += 1) {
    ctx.fillRect(60 + i * 78, 118 + ((i % 3) * 13), 46, 1);
  }

  drawPanel(150, 150, 660, 250, "rgba(74, 45, 28, 0.92)", "#d6a65b");
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff1bd";
  ctx.font = "700 32px Microsoft YaHei, sans-serif";
  ctx.fillText(GameState.ending.title, BASE_WIDTH / 2, 214);

  ctx.fillStyle = "#f2d6a1";
  ctx.font = "19px Microsoft YaHei, sans-serif";
  wrapText(ctx, GameState.ending.text, BASE_WIDTH / 2, 270, 540, 32, "center");

  ctx.fillStyle = "#d6b26f";
  ctx.font = "14px Microsoft YaHei, sans-serif";
  ctx.fillText("最终状态", BASE_WIDTH / 2, 350);
  ctx.restore();

  buttons.push(new Button(390, 438, 180, 50, "重新开始", resetGame, { kind: "primary" }));
}

function drawBaseBackground(mode) {
  const gradients = {
    start: ["#4f7b45", "#72502d", "#2f4f32"],
    day: ["#78a85a", "#d6ad66", "#3d6a43"],
    night: ["#1b203d", "#402b52", "#18243a"],
    ending: ["#2d2642", "#6a452c", "#223828"],
  };
  const colors = gradients[mode] || gradients.start;

  drawSceneBackgroundImage(mode);

  const gradient = ctx.createLinearGradient(0, 0, BASE_WIDTH, BASE_HEIGHT);
  gradient.addColorStop(0, imageIsReady(getBackgroundKey(mode)) ? `${colors[0]}7a` : colors[0]);
  gradient.addColorStop(0.58, imageIsReady(getBackgroundKey(mode)) ? `${colors[1]}58` : colors[1]);
  gradient.addColorStop(1, imageIsReady(getBackgroundKey(mode)) ? `${colors[2]}a8` : colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

  ctx.save();
  ctx.globalAlpha = mode === "night" ? 0.2 : 0.16;
  for (let y = 0; y <= BASE_HEIGHT; y += 16) {
    for (let x = 0; x <= BASE_WIDTH; x += 16) {
      if ((x / 16 + y / 16) % 2 === 0) {
        ctx.fillStyle = mode === "night" ? "#72508a" : "#f2c878";
        ctx.fillRect(x, y, 8, 8);
      }
    }
  }
  ctx.restore();
}

function getBackgroundKey(mode) {
  if (mode === "day") return `day${GameState.day}`;
  if (mode === "night") return `night${GameState.day}`;
  return mode;
}

function imageIsReady(key) {
  const image = BackgroundImages[key];
  return Boolean(image && image.complete && image.naturalWidth > 0);
}

function drawSceneBackgroundImage(mode) {
  const key = getBackgroundKey(mode);
  const image = BackgroundImages[key];

  if (!imageIsReady(key)) {
    return;
  }

  const scale = Math.max(BASE_WIDTH / image.naturalWidth, BASE_HEIGHT / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = (BASE_WIDTH - drawWidth) / 2;
  const y = (BASE_HEIGHT - drawHeight) / 2;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
  ctx.restore();
}

function drawTitleBlock(title, subtitle) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#432818";
  ctx.font = "700 58px Microsoft YaHei, sans-serif";
  ctx.fillText(title, BASE_WIDTH / 2 + 4, 146);
  ctx.fillStyle = "#fff0ad";
  ctx.strokeStyle = "#5f351d";
  ctx.lineWidth = 5;
  ctx.fillText(title, BASE_WIDTH / 2, 142);
  ctx.strokeText(title, BASE_WIDTH / 2, 142);
  ctx.fillText(title, BASE_WIDTH / 2, 142);

  ctx.fillStyle = "#ffe1a0";
  ctx.font = "700 20px Microsoft YaHei, sans-serif";
  ctx.fillText(subtitle, BASE_WIDTH / 2, 184);
  ctx.restore();
}

function drawHeader(sceneName) {
  ctx.save();
  ctx.fillStyle = "rgba(73, 43, 25, 0.86)";
  ctx.fillRect(0, 0, BASE_WIDTH, 76);
  ctx.fillStyle = "#2c1b12";
  ctx.fillRect(0, 72, BASE_WIDTH, 4);
  ctx.fillStyle = "rgba(255, 226, 143, 0.28)";
  ctx.fillRect(0, 4, BASE_WIDTH, 3);

  ctx.fillStyle = "#fff1b8";
  ctx.font = "700 22px Microsoft YaHei, sans-serif";
  ctx.fillText("无法收敛", 42, 34);

  ctx.fillStyle = "#e0bc78";
  ctx.font = "15px Microsoft YaHei, sans-serif";
  ctx.fillText(`第 ${GameState.day} 天 · ${sceneName}`, 42, 58);

  ctx.textAlign = "right";
  ctx.fillStyle = GameState.phase === "night" ? "#f0a8cc" : "#c9ef82";
  ctx.font = "600 16px Microsoft YaHei, sans-serif";
  ctx.fillText(GameState.phase === "night" ? "夜晚：误解场景" : "白天：可解决问题", 918, 42);
  ctx.restore();
}

function drawStatusBars() {
  const stats = [
    ["表达清晰度", GameState.clarity, "#7ecbff"],
    ["对方理解率", GameState.understanding, "#9adc5d"],
    ["解释成本", GameState.cost, "#f38b70"],
    ["自我保留度", GameState.self, "#ffd46b"],
  ];

  ctx.save();
  stats.forEach((stat, index) => {
    const x = 486 + index * 108;
    const y = 18;
    drawMiniBar(x, y, 92, 8, stat[1], stat[2]);
    ctx.fillStyle = "#f0d39a";
    ctx.font = "12px Microsoft YaHei, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(stat[0], x, y + 28);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff5c9";
    ctx.fillText(String(stat[1]), x + 92, y + 28);
  });
  ctx.restore();
}

function drawMiniBar(x, y, w, h, value, color) {
  ctx.save();
  ctx.fillStyle = "#2d1b12";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = "#6d4a2d";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#3a2719";
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  const fillWidth = Math.max(0, Math.floor((w * value) / 100));
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, Math.max(0, fillWidth - 4), h - 4);
  ctx.restore();
}

function drawWarningMessages() {
  const messages = [];
  if (GameState.cost > 80) {
    messages.push("解释成本过高：继续解释正在消耗你。");
  }
  if (GameState.self < 30) {
    messages.push("自我保留度过低：你正在为了避免误解而丢失真实表达。");
  }

  ctx.save();
  messages.forEach((message, index) => {
    ctx.fillStyle = "#3a1d25";
    ctx.fillRect(244, 92 + index * 34, 480, 26);
    ctx.fillStyle = "#7b3a45";
    ctx.fillRect(240, 88 + index * 34, 480, 26);
    ctx.strokeStyle = "#ffc08d";
    ctx.lineWidth = 2;
    ctx.strokeRect(240, 88 + index * 34, 480, 26);
    ctx.fillStyle = "#ffe4b8";
    ctx.font = "14px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(message, BASE_WIDTH / 2, 106 + index * 34);
  });
  ctx.restore();
}

function drawDayScene(task, solved = false) {
  const day = task.day;
  ctx.save();
  drawPanel(
    DAY_SCENE_AREA.x,
    DAY_SCENE_AREA.y,
    DAY_SCENE_AREA.w,
    DAY_SCENE_AREA.h,
    "rgba(92, 64, 37, 0.18)",
    "rgba(237, 190, 91, 0.32)"
  );

  if (imageIsReady(`day${day}`)) {
    drawAmbientScanLines("day");
  } else if (day === 1) {
    drawDeskComputer(solved);
  } else if (day === 2) {
    drawDocumentScene(solved);
  } else if (day === 3) {
    drawRoomScene(solved);
  } else {
    drawPresentationScene(solved);
  }

  drawDayInteractiveLayer(task, solved);
  ctx.restore();
}

function drawDayInteractiveLayer(task, solved) {
  drawDayInteractiveObjects(task.day, solved);

  if (solved) {
    return;
  }

  const configs = DAY_HOTSPOTS[task.day] || [];
  configs.forEach((config) => {
    if (isHotspotDone(config)) {
      drawCollectedMarker(ctx, config);
      return;
    }

    const hotspot = new Hotspot({
      ...config,
      onClick: () => handleDayHotspot(config),
    });
    hotspots.push(hotspot);
    hotspot.draw(ctx);
  });

  drawMouseActionHint();
}

function drawDayInteractiveObjects(day, solved) {
  if (day === 1) {
    drawNetworkObjects(solved);
  } else if (day === 2) {
    drawDocumentObjects(solved);
  } else if (day === 3) {
    drawRoomObjects(solved);
  } else {
    drawPresentationObjects(solved);
  }
}

function drawDeskComputer(solved) {
  ctx.fillStyle = "#5f3921";
  ctx.fillRect(230, 220, 500, 12);
  drawScreen(360, 126, 240, 100, solved ? "#315f58" : "#332b33");
  ctx.fillStyle = "#c08b4b";
  ctx.fillRect(462, 226, 36, 28);
  ctx.fillRect(420, 254, 120, 10);
  ctx.strokeStyle = solved ? "#b4e06f" : "#f18b70";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(480, 176, 28, 0.8 * Math.PI, 2.2 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = solved ? "#d8f28b" : "#ffc08d";
  ctx.font = "15px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(solved ? "CONNECTED" : "NO SIGNAL", 480, 183);

  drawRouter(650, 168, solved);
}

function drawScreen(x, y, w, h, color) {
  roundRect(ctx, x, y, w, h, 3);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#1f1612";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawRouter(x, y, solved) {
  roundRect(ctx, x, y, 96, 42, 3);
  ctx.fillStyle = "#6f4a2c";
  ctx.fill();
  ctx.strokeStyle = "#2c1a10";
  ctx.stroke();
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = solved || i === 0 ? "#a6e45f" : "#3d3328";
    ctx.fillRect(x + 22 + i * 22, y + 18, 8, 8);
  }
}

function drawNetworkObjects(solved) {
  const checkedComputer = isHotspotDone({ id: "computer" });
  const restartedRouter = isHotspotDone({ id: "router" });
  const reconnected = solved || isHotspotDone({ id: "wifi" });

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "rgba(44, 25, 13, 0.84)";
  ctx.fillRect(220, 270, 560, 18);
  drawScreen(356, 132, 222, 112, reconnected ? "#2d6659" : "#26252f");
  ctx.fillStyle = reconnected ? "#bde66f" : checkedComputer ? "#ffd46b" : "#f18b70";
  ctx.font = "700 16px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(reconnected ? "CONNECTED" : checkedComputer ? "NETWORK FOUND" : "OFFLINE", 467, 190);
  ctx.fillStyle = "#b8793f";
  ctx.fillRect(452, 244, 36, 32);
  ctx.fillRect(404, 274, 136, 12);

  drawRouter(646, 188, restartedRouter || reconnected);
  ctx.strokeStyle = restartedRouter || reconnected ? "#9fd56f" : "#674637";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(646, 210);
  ctx.lineTo(578, 198);
  ctx.stroke();

  ctx.fillStyle = reconnected ? "#9fd56f" : "#ba4d55";
  ctx.fillRect(484, 162, 10, 10);
  ctx.fillRect(506, 162, 10, 10);
  ctx.fillRect(528, 162, 10, 10);

  ctx.fillStyle = "rgba(255, 214, 120, 0.42)";
  ctx.fillRect(220, 138, 70, 96);
  ctx.fillStyle = "#ffd36c";
  ctx.fillRect(244, 170, 22, 42);
  ctx.restore();
}

function drawDocumentObjects(solved) {
  const split = solved || isHotspotDone({ id: "paragraphs" });
  const ordered = solved || isHotspotDone({ id: "arrows" });
  const highlighted = solved || isHotspotDone({ id: "conclusion" });

  ctx.save();
  drawPaper(298, 126, 176, 150, split);
  drawPaper(492, 138, 160, 130, ordered);
  drawPaper(662, 154, 138, 104, highlighted);

  ctx.strokeStyle = ordered ? "#9fd56f" : "#d6a65b";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(506, 194);
  ctx.lineTo(632, 194);
  ctx.lineTo(616, 180);
  ctx.moveTo(632, 194);
  ctx.lineTo(616, 208);
  ctx.stroke();

  ctx.fillStyle = highlighted ? "#ffd36c" : "rgba(216, 156, 85, 0.68)";
  ctx.fillRect(684, 174, 92, 16);
  ctx.fillRect(684, 198, 72, 10);

  ctx.fillStyle = "#9b5a4d";
  ctx.fillRect(172, 164, 54, 46);
  ctx.fillStyle = "#f3c26f";
  ctx.fillRect(184, 176, 30, 8);
  ctx.restore();
}

function drawRoomObjects(solved) {
  const state = getDayState();
  const clicked = state.clicked || {};
  const clothingDone = solved || GameState.dayStep > 0;
  const trashDone = solved || GameState.dayStep > 1;

  ctx.save();
  ctx.fillStyle = "rgba(74, 43, 25, 0.5)";
  ctx.fillRect(196, 252, 640, 62);
  ctx.fillStyle = "#8c5a31";
  ctx.fillRect(218, 150, 182, 74);
  ctx.fillStyle = "#b0703c";
  ctx.fillRect(242, 128, 160, 42);
  ctx.fillStyle = "#5b3926";
  ctx.fillRect(662, 118, 128, 132);
  ctx.fillStyle = "#35251b";
  ctx.fillRect(684, 142, 84, 12);
  ctx.fillRect(684, 172, 84, 12);
  ctx.fillRect(684, 202, 84, 12);

  if (!clicked.shirt && !clothingDone) drawCloth(248, 164, "#d87973", "shirt");
  if (!clicked.socks && !clothingDone) drawSockPair(454, 242);
  if (!clicked.pants && !clothingDone) drawCloth(600, 198, "#5f7d9a", "pants");
  if (clothingDone && !solved) {
    drawBox(438, 238, "#c9964b");
    ctx.fillStyle = "#d87973";
    ctx.fillRect(448, 230, 38, 14);
  }

  if (!clicked.bottle && !trashDone) drawBottle(328, 254);
  if (!clicked.wrapper && !trashDone) drawWrapper(732, 250);
  if (trashDone && !solved) {
    ctx.fillStyle = "#9fd56f";
    ctx.fillRect(298, 278, 120, 10);
  }

  if (solved) {
    drawBox(452, 238, "#d8b35a");
    ctx.fillStyle = "#9fd56f";
    ctx.fillRect(278, 206, 90, 12);
  }

  ctx.fillStyle = "#263040";
  ctx.fillRect(552, 300, 58, 22);
  ctx.fillStyle = "#7ecbff";
  ctx.fillRect(562, 306, 34, 4);
  ctx.restore();
}

function drawPresentationObjects(solved) {
  const outlined = solved || isHotspotDone({ id: "outline" });
  const slidesReady = solved || isHotspotDone({ id: "slides" });

  ctx.save();
  ctx.fillStyle = "#6c4526";
  ctx.fillRect(224, 274, 600, 16);
  drawPaper(264, 142, 138, 120, outlined);
  drawScreen(438, 120, 202, 146, slidesReady ? "#344f35" : "#34412c");
  ctx.fillStyle = slidesReady ? "#d6f28b" : "#ffe1a0";
  ctx.font = "16px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(slidesReady ? "重点幻灯片" : "明天汇报", 539, 158);
  ctx.fillStyle = "#9fcf63";
  ctx.fillRect(476, 182, 126, 7);
  ctx.fillRect(476, 204, slidesReady ? 96 : 148, 7);
  ctx.fillRect(476, 226, slidesReady ? 74 : 54, 7);

  ctx.fillStyle = "#384050";
  ctx.fillRect(712, 170, 18, 86);
  ctx.fillStyle = solved ? "#9fd56f" : "#ffd36c";
  ctx.fillRect(692, 154, 58, 44);
  ctx.fillStyle = "#2c1a10";
  ctx.fillRect(684, 256, 72, 10);

  ctx.fillStyle = "#9b5a4d";
  ctx.fillRect(160, 164, 60, 88);
  ctx.fillStyle = "#ffd36c";
  ctx.fillRect(172, 178, 36, 10);
  ctx.restore();
}

function drawCloth(x, y, color, type) {
  ctx.fillStyle = color;
  if (type === "pants") {
    ctx.fillRect(x, y, 38, 18);
    ctx.fillRect(x + 8, y + 18, 14, 42);
    ctx.fillRect(x + 30, y + 18, 14, 42);
  } else {
    ctx.fillRect(x + 18, y, 62, 38);
    ctx.fillRect(x, y + 10, 24, 24);
    ctx.fillRect(x + 74, y + 10, 24, 24);
  }
  ctx.strokeStyle = "#3d2416";
  ctx.strokeRect(x + 8, y + 4, 86, 48);
}

function drawSockPair(x, y) {
  ctx.fillStyle = "#e6d6a6";
  ctx.fillRect(x, y, 42, 14);
  ctx.fillRect(x + 28, y + 16, 42, 14);
  ctx.fillStyle = "#d87973";
  ctx.fillRect(x + 26, y, 12, 14);
  ctx.fillRect(x + 54, y + 16, 12, 14);
}

function drawBottle(x, y) {
  ctx.fillStyle = "#78a8b8";
  ctx.fillRect(x + 14, y, 18, 12);
  ctx.fillRect(x + 8, y + 12, 30, 50);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(x + 14, y + 20, 8, 32);
}

function drawWrapper(x, y) {
  ctx.fillStyle = "#d6a65b";
  ctx.fillRect(x, y + 12, 74, 30);
  ctx.fillStyle = "#9b5a4d";
  ctx.fillRect(x + 10, y + 20, 50, 8);
  ctx.strokeStyle = "#3d2416";
  ctx.strokeRect(x, y + 12, 74, 30);
}

function drawDocumentScene(solved) {
  ctx.fillStyle = "#6c4526";
  ctx.fillRect(210, 232, 540, 14);
  drawPaper(334, 122, 110, 120, solved);
  drawPaper(456, 116, 130, 126, solved);
  drawPaper(602, 130, 82, 100, solved);
  ctx.strokeStyle = solved ? "#aee06b" : "#9a7f5b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(350, 158);
  ctx.lineTo(430, 158);
  ctx.moveTo(350, 184);
  ctx.lineTo(solved ? 420 : 440, 184);
  ctx.stroke();
}

function drawPaper(x, y, w, h, solved) {
  roundRect(ctx, x, y, w, h, 2);
  ctx.fillStyle = solved ? "#fff0bd" : "#dfc58f";
  ctx.fill();
  ctx.strokeStyle = "#7f5630";
  ctx.stroke();
  ctx.fillStyle = solved ? "#558b4f" : "#8a6a45";
  for (let i = 0; i < 5; i += 1) {
    ctx.fillRect(x + 14, y + 18 + i * 16, w - 28 - (i % 2) * 20, 3);
  }
}

function drawRoomScene(solved) {
  ctx.fillStyle = "#6c4526";
  ctx.fillRect(160, 230, 640, 16);
  ctx.fillStyle = "#8c5a31";
  ctx.fillRect(220, 160, 160, 78);
  ctx.fillStyle = "#b0703c";
  ctx.fillRect(240, 136, 150, 42);
  ctx.fillStyle = "#5b3926";
  ctx.fillRect(620, 120, 82, 124);

  if (solved) {
    drawBox(440, 196, "#c9964b");
    drawBox(504, 196, "#d8b35a");
    ctx.fillStyle = "#9fdc63";
    ctx.fillRect(274, 197, 78, 12);
  } else {
    drawBox(430, 204, "#9b5a4d");
    drawBox(515, 188, "#6c7d4a");
    ctx.fillStyle = "#d59c55";
    ctx.fillRect(280, 204, 86, 12);
    ctx.fillStyle = "#b7a27b";
    ctx.fillRect(558, 218, 116, 8);
  }
}

function drawBox(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 56, 38);
  ctx.strokeStyle = "#3d2416";
  ctx.strokeRect(x, y, 56, 38);
}

function drawPresentationScene(solved) {
  drawScreen(332, 114, 300, 136, "#34412c");
  ctx.fillStyle = "#6c4526";
  ctx.fillRect(318, 250, 328, 10);
  ctx.fillStyle = solved ? "#d6f28b" : "#ffe1a0";
  ctx.font = "18px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(solved ? "清晰提纲 / 重点幻灯片 / 练习完成" : "明天汇报", 482, 154);
  ctx.fillStyle = "#9fcf63";
  ctx.fillRect(378, 178, 208, 8);
  ctx.fillRect(378, 198, solved ? 170 : 238, 8);
  ctx.fillRect(378, 218, solved ? 124 : 84, 8);
}

function drawCharacterDialogueBox({ dialogue, heading, goal, playerText, otherText, note, portraitKey }) {
  const portrait = NIGHT_PORTRAITS[portraitKey] || NIGHT_PORTRAITS[4];

  drawPixelTextPanel(34, 292, 620, 204);
  drawPixelPortraitCard(678, 292, 238, 204, portrait);

  ctx.save();
  resetTextState(ctx);
  ctx.fillStyle = "#3f2113";
  ctx.font = "700 22px Microsoft YaHei, sans-serif";
  wrapText(ctx, heading, 64, 324, 520, 25);

  if (goal) {
    ctx.fillStyle = "#5f351d";
    ctx.font = "15px Microsoft YaHei, sans-serif";
    wrapText(ctx, goal, 64, 352, 540, 21);
  }

  let currentY = goal ? 386 : 360;
  currentY += drawDialogueLine("你", playerText, 64, currentY, "#477337", 500) + 8;
  currentY += drawGlitchLine(portrait.name, otherText, 64, currentY, 500) + 8;

  if (note) {
    ctx.fillStyle = "#56301b";
    ctx.font = "14px Microsoft YaHei, sans-serif";
    wrapText(ctx, note, 64, Math.min(currentY + 4, 438), 360, 18);
  }

  ctx.restore();
}

function drawPixelTextPanel(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = "#321c12";
  ctx.fillRect(x + 6, y + 8, w, h);
  ctx.fillStyle = "#c57a32";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#f2b45d";
  ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
  ctx.fillStyle = "#ffd082";
  ctx.fillRect(x + 10, y + 10, w - 20, h - 20);
  ctx.strokeStyle = "#6a3519";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = "#8b4a22";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
  ctx.restore();
}

function drawPixelPortraitCard(x, y, w, h, portrait) {
  ctx.save();
  ctx.fillStyle = "#29170f";
  ctx.fillRect(x + 7, y + 8, w, h);
  ctx.fillStyle = "#9d5425";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#c87832";
  ctx.fillRect(x + 8, y + 8, w - 16, h - 16);

  for (let i = 0; i < 7; i += 1) {
    const stripeX = x + 18 + i * 30;
    ctx.fillStyle = i % 2 === 0 ? "rgba(92, 46, 21, 0.36)" : "rgba(255, 194, 98, 0.22)";
    ctx.fillRect(stripeX, y + 10, 8, h - 20);
    ctx.fillStyle = "rgba(64, 32, 17, 0.34)";
    ctx.fillRect(stripeX + 12, y + 28 + (i % 3) * 18, 3, 44);
  }

  ctx.strokeStyle = "#4c2714";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = "#ffd184";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);

  drawPixelPortrait(x + 42, y + 24, 154, 124, portrait);
  drawNamePlate(x + 28, y + 156, w - 56, 32, portrait.name);
  ctx.restore();
}

function drawPixelPortrait(x, y, w, h, portrait) {
  ctx.save();
  ctx.fillStyle = "#5f6848";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = portrait.bg;
  ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
  ctx.fillStyle = "rgba(255, 238, 170, 0.28)";
  ctx.fillRect(x + 18, y + 18, w - 36, 24);

  if (portrait.style === "family") {
    drawFamilyPortrait(x, y, portrait);
  } else if (portrait.style === "friend") {
    drawFriendPortrait(x, y, portrait);
  } else if (portrait.style === "coworker") {
    drawCoworkerPortrait(x, y, portrait);
  } else {
    drawPartnerPortrait(x, y, portrait);
  }

  ctx.strokeStyle = "#4b2c18";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = "#ffe0a0";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
  ctx.restore();
}

function drawFamilyPortrait(x, y, portrait) {
  drawPortraitHead(x + 58, y + 38, 42, 48, portrait.skin);
  ctx.fillStyle = portrait.hair;
  ctx.fillRect(x + 48, y + 22, 62, 22);
  ctx.fillRect(x + 40, y + 40, 22, 34);
  ctx.fillRect(x + 98, y + 42, 18, 28);
  ctx.fillStyle = "#3d2415";
  ctx.fillRect(x + 50, y + 20, 52, 8);
  drawPortraitFace(x + 58, y + 38, "#7e3b32");

  ctx.fillStyle = portrait.shirt;
  ctx.fillRect(x + 38, y + 94, 82, 30);
  ctx.fillStyle = "#704021";
  ctx.fillRect(x + 48, y + 94, 20, 30);
  ctx.fillRect(x + 90, y + 94, 20, 30);
  ctx.fillStyle = portrait.accent;
  ctx.fillRect(x + 70, y + 98, 20, 8);
}

function drawFriendPortrait(x, y, portrait) {
  ctx.fillStyle = portrait.hair;
  ctx.fillRect(x + 42, y + 24, 76, 20);
  ctx.fillRect(x + 34, y + 38, 30, 48);
  ctx.fillRect(x + 98, y + 36, 28, 50);
  ctx.fillStyle = "#e08a45";
  ctx.fillRect(x + 38, y + 18, 48, 14);
  ctx.fillRect(x + 84, y + 28, 28, 14);

  drawPortraitHead(x + 56, y + 42, 48, 46, portrait.skin);
  drawPortraitFace(x + 56, y + 42, "#9a493f");

  ctx.fillStyle = portrait.shirt;
  ctx.fillRect(x + 36, y + 94, 88, 30);
  ctx.fillStyle = "#316a45";
  ctx.fillRect(x + 36, y + 94, 18, 30);
  ctx.fillRect(x + 106, y + 94, 18, 30);
  ctx.fillStyle = portrait.accent;
  ctx.fillRect(x + 60, y + 102, 40, 7);
  ctx.fillRect(x + 70, y + 112, 20, 6);
}

function drawCoworkerPortrait(x, y, portrait) {
  ctx.fillStyle = portrait.hair;
  ctx.fillRect(x + 48, y + 24, 64, 18);
  ctx.fillRect(x + 42, y + 36, 20, 34);
  ctx.fillRect(x + 100, y + 36, 16, 30);
  drawPortraitHead(x + 58, y + 40, 44, 48, portrait.skin);

  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(x + 62, y + 58, 14, 4);
  ctx.fillRect(x + 86, y + 58, 14, 4);
  ctx.fillRect(x + 76, y + 60, 10, 2);
  drawPortraitFace(x + 58, y + 40, "#8a4438");

  ctx.fillStyle = portrait.shirt;
  ctx.fillRect(x + 34, y + 94, 92, 30);
  ctx.fillStyle = "#f0e3c0";
  ctx.fillRect(x + 68, y + 94, 22, 22);
  ctx.fillStyle = portrait.accent;
  ctx.fillRect(x + 48, y + 104, 24, 16);
  ctx.fillStyle = "#6b4427";
  ctx.fillRect(x + 54, y + 108, 12, 3);
}

function drawPartnerPortrait(x, y, portrait) {
  ctx.fillStyle = portrait.hair;
  ctx.fillRect(x + 44, y + 20, 70, 24);
  ctx.fillRect(x + 34, y + 38, 28, 62);
  ctx.fillRect(x + 100, y + 36, 30, 64);
  ctx.fillStyle = "#b85f53";
  ctx.fillRect(x + 74, y + 18, 38, 10);
  ctx.fillRect(x + 38, y + 62, 16, 36);

  drawPortraitHead(x + 58, y + 42, 46, 46, portrait.skin);
  drawPortraitFace(x + 58, y + 42, "#9b3f4d");

  ctx.fillStyle = portrait.shirt;
  ctx.fillRect(x + 36, y + 94, 90, 30);
  ctx.fillStyle = portrait.accent;
  ctx.fillRect(x + 54, y + 94, 54, 10);
  ctx.fillRect(x + 62, y + 104, 38, 8);
  ctx.fillStyle = "#72405d";
  ctx.fillRect(x + 44, y + 112, 72, 12);
}

function drawPortraitHead(x, y, w, h, skin) {
  ctx.fillStyle = skin;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255, 228, 174, 0.42)";
  ctx.fillRect(x + 6, y + 6, w - 12, 8);
  ctx.fillStyle = "rgba(122, 64, 44, 0.18)";
  ctx.fillRect(x + 8, y + h - 12, w - 16, 8);
}

function drawPortraitFace(x, y, mouthColor) {
  ctx.fillStyle = "#33241d";
  ctx.fillRect(x + 10, y + 17, 6, 6);
  ctx.fillRect(x + 30, y + 17, 6, 6);
  ctx.fillStyle = mouthColor;
  ctx.fillRect(x + 18, y + 33, 14, 4);
  ctx.fillStyle = "#8cc678";
  ctx.fillRect(x - 2, y + 36, 10, 10);
  ctx.fillRect(x + 38, y + 36, 10, 10);
}

function drawNamePlate(x, y, w, h, name) {
  ctx.save();
  ctx.fillStyle = "#f7d68f";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#fff0bd";
  ctx.fillRect(x + 6, y + 5, w - 12, h - 10);
  ctx.strokeStyle = "#77441e";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = "#6a3519";
  ctx.font = "700 17px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, x + w / 2, y + 22);
  ctx.restore();
}

function drawNightScene(dialogue, result = false) {
  drawPanel(62, 110, 836, 142, "rgba(47, 32, 68, 0.42)", "rgba(211, 129, 172, 0.34)");

  ctx.save();
  ctx.fillStyle = "rgba(255, 215, 134, 0.18)";
  for (let i = 0; i < 8; i += 1) {
    const x = 150 + i * 82;
    const offset = Math.round(Math.sin((jitterTick + i * 10) * 0.06) * 3) * 2;
    ctx.fillRect(x, 150 + offset, 44, 4);
  }

  if (imageIsReady(`night${dialogue.day}`)) {
    ctx.restore();
    return;
  }

  if (dialogue.day === 2 || dialogue.day === 3) {
    drawPhoneWindow(result);
  } else {
    drawTwoFigures(result);
  }
  ctx.restore();
}

function drawAmbientScanLines(mode) {
  ctx.save();
  ctx.globalAlpha = mode === "day" ? 0.2 : 0.26;
  ctx.fillStyle = mode === "day" ? "#ffe29a" : "#d08cc2";
  for (let i = 0; i < 9; i += 1) {
    const y = 128 + i * 14;
    const offset = Math.round(Math.sin((jitterTick + i * 8) * 0.04) * 2) * 2;
    ctx.fillRect(130, y + offset, 700, 2);
  }
  ctx.restore();
}

function drawTwoFigures(result) {
  drawFigure(330, 190, "#7fb45a", result);
  drawFigure(620, 190, "#c96e78", false);
  ctx.fillStyle = "rgba(234, 142, 148, 0.42)";
  for (let i = 0; i < 7; i += 1) {
    ctx.fillRect(390 + i * 28, 158 + ((i % 2) * 18), 14, 4);
  }
}

function drawFigure(x, y, color, calm) {
  ctx.fillStyle = color;
  ctx.fillRect(x - 16, y - 58, 32, 32);
  ctx.fillStyle = "#f0c08c";
  ctx.fillRect(x - 12, y - 54, 24, 22);
  ctx.fillStyle = calm ? "#7fb45a" : color;
  ctx.fillRect(x - 28, y - 22, 56, 66);
  ctx.fillStyle = "rgba(255, 238, 174, 0.24)";
  ctx.fillRect(x - 18, y - 12, 36, 8);
}

function drawPhoneWindow(result) {
  roundRect(ctx, 382, 122, 200, 124, 4);
  ctx.fillStyle = "#2c2034";
  ctx.fill();
  ctx.strokeStyle = "#d6a65b";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = result ? "#9fdc63" : "#d6b35a";
  roundRect(ctx, 408, 154, 96, 18, 3);
  ctx.fill();
  ctx.fillStyle = "#c96e78";
  roundRect(ctx, 456, 190, 96, 18, 3);
  ctx.fill();
}

function drawDialogueLine(speaker, text, x, y, color, maxWidth = 500) {
  ctx.save();
  resetTextState(ctx);
  ctx.fillStyle = color;
  ctx.font = "700 16px Microsoft YaHei, sans-serif";
  ctx.fillText(`${speaker}：`, x, y);
  ctx.fillStyle = "#4a2a18";
  ctx.font = "600 16px Microsoft YaHei, sans-serif";
  const lineCount = wrapText(ctx, text, x + 52, y, maxWidth, 22);
  ctx.restore();
  return lineCount * 22;
}

function drawGlitchLine(speaker, text, x, y, maxWidth = 500) {
  ctx.save();
  resetTextState(ctx);
  const offset = Math.round(Math.sin(jitterTick * 0.2) * 2);
  ctx.fillStyle = "#8a3b2e";
  ctx.font = "700 16px Microsoft YaHei, sans-serif";
  ctx.fillText(`${speaker}：`, x + offset, y);
  ctx.fillStyle = "#5c2b22";
  ctx.font = "600 16px Microsoft YaHei, sans-serif";
  const lineCount = wrapText(ctx, text, x + 52 + offset, y, maxWidth, 22);
  ctx.restore();
  return lineCount * 22;
}

function drawConvergenceDiagram(x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(68, 40, 24, 0.55)";
  ctx.fillRect(x - 18, y - 6, 276, 112);
  ctx.strokeStyle = "#d6a65b";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 18, y - 6, 276, 112);
  ctx.fillStyle = "#5e3a22";
  ctx.fillRect(x, y + 40, 240, 4);

  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < 2 ? "#96cf56" : "#d87973";
    ctx.fillRect(x + i * 45, y + 8 + i * 7, 8, 8);
    ctx.fillRect(x + 228, y + 38 + Math.round(Math.sin(i) * 18), 8, 8);
  }

  ctx.fillStyle = "#ffe4a3";
  ctx.font = "13px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("可解决的问题会靠近答案；无法接收的关系会持续偏移。", x + 120, y + 88);
  ctx.restore();
}

function drawPanel(x, y, w, h, fill, stroke) {
  ctx.save();
  ctx.fillStyle = "rgba(37, 22, 13, 0.62)";
  ctx.fillRect(x + 6, y + 7, w, h);
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "#2f1b10";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
  ctx.restore();
}

function isHotspotDone(hotspot) {
  const state = getDayState();
  if (state.clicked && state.clicked[hotspot.id]) {
    return true;
  }
  if (Number.isInteger(hotspot.step) && GameState.dayStep > hotspot.step) {
    return true;
  }
  return false;
}

function drawCollectedMarker(context, hotspot) {
  context.save();
  context.fillStyle = "rgba(48, 112, 56, 0.82)";
  roundRect(context, hotspot.x + hotspot.w - 28, hotspot.y + 6, 22, 22, 4);
  context.fill();
  context.strokeStyle = "#d8f28b";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(hotspot.x + hotspot.w - 23, hotspot.y + 18);
  context.lineTo(hotspot.x + hotspot.w - 16, hotspot.y + 25);
  context.lineTo(hotspot.x + hotspot.w - 7, hotspot.y + 11);
  context.stroke();
  context.restore();
}

function drawHotspotTag(context, hotspot) {
  const label = hotspot.wrong ? hotspot.label : `${hotspot.label}`;
  context.save();
  context.font = "700 13px Microsoft YaHei, sans-serif";
  const width = Math.min(160, Math.max(58, context.measureText(label).width + 22));
  const x = Math.max(DAY_SCENE_AREA.x + 12, Math.min(hotspot.x + hotspot.w / 2 - width / 2, DAY_SCENE_AREA.x + DAY_SCENE_AREA.w - width - 12));
  const y = Math.max(DAY_SCENE_AREA.y + 10, hotspot.y - 30);
  context.fillStyle = hotspot.wrong ? "rgba(91, 49, 39, 0.9)" : "rgba(44, 32, 18, 0.92)";
  roundRect(context, x, y, width, 24, 4);
  context.fill();
  context.strokeStyle = hotspot.wrong ? "#d8897b" : "#ffd36c";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = hotspot.wrong ? "#ffc7a4" : "#fff1bd";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, x + width / 2, y + 13);
  context.restore();
}

function findHotspotAt(x, y) {
  const hits = hotspots.filter((hotspot) => hotspot.contains(x, y));
  if (hits.length === 0) {
    return null;
  }

  const currentHit = hits.find((hotspot) => hotspot.step === GameState.dayStep && !hotspot.wrong);
  return currentHit || hits[0];
}

function drawMouseActionHint() {
  const hotspot = findHotspotAt(mouse.x, mouse.y);
  if (!hotspot || hotspot.wrong) {
    return;
  }

  const label = hotspot.action || hotspot.label;
  ctx.save();
  ctx.font = "700 14px Microsoft YaHei, sans-serif";
  const width = Math.max(92, ctx.measureText(label).width + 28);
  const height = 30;
  const x = Math.min(mouse.x + 16, BASE_WIDTH - width - 18);
  const y = Math.max(mouse.y - 44, 86);
  ctx.fillStyle = "rgba(30, 22, 13, 0.94)";
  roundRect(ctx, x, y, width, height, 5);
  ctx.fill();
  ctx.strokeStyle = "#ffd36c";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff1bd";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + width / 2, y + height / 2 + 1);
  ctx.restore();
}

function drawDayProgressTrail(task) {
  ctx.save();
  const startX = 642;
  const y = 492;
  task.steps.forEach((step, index) => {
    const done = index < GameState.dayStep;
    const current = index === GameState.dayStep;
    const x = startX + index * 64;
    if (index > 0) {
      ctx.fillStyle = index <= GameState.dayStep ? "#9fd56f" : "#6d4a2d";
      ctx.fillRect(x - 44, y + 6, 38, 4);
    }
    ctx.fillStyle = done ? "#9fd56f" : current ? "#ffd36c" : "#6d4a2d";
    roundRect(ctx, x, y, 18, 18, 4);
    ctx.fill();
    ctx.fillStyle = done ? "#24441f" : current ? "#4c2b16" : "#d0ad74";
    ctx.font = "700 11px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(index + 1), x + 9, y + 13);
  });
  ctx.restore();
}

function resetTextState(context) {
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
}

function getDayOptions(task) {
  const expected = task.steps[GameState.dayStep];
  const pool = [...task.steps, ...task.wrong].filter((item) => {
    return item === expected || !task.steps.slice(0, GameState.dayStep).includes(item);
  });
  const fixed = [expected];
  for (const item of pool) {
    if (fixed.length >= 3) break;
    if (!fixed.includes(item) && !task.steps.slice(GameState.dayStep + 1).includes(item)) {
      fixed.push(item);
    }
  }
  for (const item of pool) {
    if (fixed.length >= 3) break;
    if (!fixed.includes(item)) fixed.push(item);
  }
  return rotateArray(fixed, GameState.day + GameState.dayStep);
}

function rotateArray(items, amount) {
  const copy = [...items];
  const count = amount % copy.length;
  return copy.slice(count).concat(copy.slice(0, count));
}

function roundRect(context, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.quadraticCurveTo(x + w, y, x + w, y + r);
  context.lineTo(x + w, y + h - r);
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  context.lineTo(x + r, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function wrapText(context, text, x, y, maxWidth, lineHeight, align = "left") {
  const words = Array.from(text);
  let line = "";
  let currentY = y;
  let lineCount = 1;

  context.textAlign = align;
  for (let i = 0; i < words.length; i += 1) {
    const testLine = line + words[i];
    const metrics = context.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      context.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
      lineCount += 1;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, currentY);
  return lineCount;
}

function drawButtonText(context, text, x, centerY, maxWidth, lineHeight, maxLines) {
  const chars = Array.from(text);
  const lines = [];
  let line = "";

  for (const char of chars) {
    const testLine = line + char;
    if (context.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
      if (lines.length === maxLines) {
        break;
      }
    } else {
      line = testLine;
    }
  }

  if (lines.length < maxLines && line) {
    lines.push(line);
  }

  if (lines.length === maxLines && lines.join("").length < chars.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && context.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((lineText, index) => {
    context.fillText(lineText, x, startY + index * lineHeight);
  });
}

resizeCanvasForDpr();
startRenderLoop();
