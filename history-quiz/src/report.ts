import { bandLabel, dimensions, findCharacter, matchPercentFor, scoreBand, type Band, type DimensionId, type PublicResult, type QuizResult } from './quiz.ts';

type Reading = { label: string; voice: string; daily: string; blind: string; risk: string; advice: string; message: string };
const readings: Record<DimensionId, Record<Band, Reading>> = {
  decision: {
    low: { label: '审慎', voice: '想清楚，再迈出笃定的一步', daily: '面对重要选择，你习惯先核对信息、比较方案，再决定下一步', blind: '可能为寻找更完整的信息而延后决定', risk: '当准备取代行动，原本可尝试的机会也可能被错过', advice: '给信息收集设一个期限，先做一次成本可控的小尝试', message: '想得周全，也给行动留一个开始' },
    high: { label: '决断', voice: '看准方向，就把想法变成行动', daily: '当基本条件已明确，你更愿意先推进，再用反馈调整细节', blind: '推进较快时，可能忽略尚未说出的顾虑', risk: '时间压力下，容易把第一种可行方案当成唯一答案', advice: '行动前确认一项关键风险，也听取一个不同的意见', message: '果断之后，多留一次确认' },
    balanced: { label: '权衡', voice: '该想的时候想，该走的时候走', daily: '你会根据事情的重要程度，在收集信息与及时行动之间调整节奏', blind: '不同场景下的决策标准可能不够清晰', risk: '外界意见较多时，可能反复切换判断依据', advice: '先写下这次决定最重要的两个条件，再作选择', message: '不急于选择，也不把选择无限延后' },
  },
  social: {
    low: { label: '自主', voice: '保留自己的节奏，也认真回应世界', daily: '你更习惯先独立整理思路，在确有需要时寻求协助', blind: '容易把可以分担的事情留给自己', risk: '长期独自承担，可能让伙伴难以及时理解你的需要', advice: '在任务开始时说明边界，并主动提出一项具体协助', message: '独立是底气，求助也是一种能力' },
    high: { label: '联结', voice: '让不同的人，在一件事上找到共同方向', daily: '讨论和协作能帮助你形成判断，你也愿意协调不同的想法', blind: '可能过多照顾大家的意见', risk: '关系压力下，自己的需求与责任边界容易被忽略', advice: '先说清自己的判断，再邀请伙伴补充', message: '珍惜联结，也保留自己的声音' },
    balanced: { label: '协同', voice: '一个人想清楚，也和伙伴走得更远', daily: '你既能独立处理事情，也愿意在需要时进入协作', blind: '他人可能不清楚你何时需要空间、何时希望讨论', risk: '协作预期不一致时，容易产生不必要的误会', advice: '提前约定独立处理与共同讨论的节点', message: '把独处和协作，都放在合适的位置' },
  },
  change: {
    low: { label: '深耕', voice: '把已有的路，一步步走得更好', daily: '你倾向于保留有效的方法，通过持续修补来提升体验', blind: '可能较晚察觉环境已经发生变化', risk: '熟悉的方法失效时，仍可能投入过多精力修补', advice: '定期试用一个新方法，与现有做法作实际比较', message: '守住有效的，也给新的可能留一扇门' },
    high: { label: '开创', voice: '旧答案之外，总还有另一种可能', daily: '当现有方式不够合适，你愿意尝试新的工具、路径和组合', blind: '新鲜感可能快于验证和收尾', risk: '不断更换方案，可能让已有积累难以沉淀', advice: '为新尝试设一个验证周期，再决定是否全面替换', message: '探索新的路，也把走过的路留下来' },
    balanced: { label: '更新', voice: '留住好用的，也试试更合适的', daily: '你不会仅为变化而变化，会根据实际收益决定保留还是尝试', blind: '可能在维持与改变之间犹豫', risk: '缺少评估标准时，尝试容易停留在浅层比较', advice: '为新旧方案设定同一个可观察的目标', message: '让变化有理由，让坚持有依据' },
  },
  expression: {
    low: { label: '内敛', voice: '话可以慢一点，想法仍然有分量', daily: '你倾向于先整理感受，再用合适的时机与方式表达', blind: '真实想法可能未被他人及时理解', risk: '沉默可能被误读为默认，重要需求因此被搁置', advice: '先用一句简短的话表明态度，再补充理由', message: '温和地表达，也能清楚地被听见' },
    high: { label: '表达', voice: '把在意的事，说得清楚而具体', daily: '你更愿意直接表达观点，让沟通尽快进入实质问题', blind: '可能低估语气对对方的影响', risk: '意见不同的时候，讨论可能过早变成立场对抗', advice: '表达判断前，先确认对方最关心的是什么', message: '把话说清，也给回应留出空间' },
    balanced: { label: '分寸', voice: '既让人听见，也愿意认真倾听', daily: '你会根据对象和情境，在直接表达与留有余地之间调整', blind: '沟通风格的变化可能让人难以判断你的态度', risk: '顾虑较多时，明确的结论可能藏在委婉表达里', advice: '用一句结论收尾，让对方知道你真正的想法', message: '有分寸，也要有清楚的意思' },
  },
  focus: {
    low: { label: '细察', voice: '真正的改变，常从一个具体细节开始', daily: '你习惯从实际情况、可核对的信息和具体问题入手', blind: '可能在局部细节上投入过多', risk: '忙于逐项完善时，容易忽略目标与优先顺序', advice: '处理细节前，先确认这件事服务于哪个整体目标', message: '看见细节，也记得抬头看看方向' },
    high: { label: '远见', voice: '先看见方向，再把零散的线索连起来', daily: '你习惯先理解整体关系，再寻找能串联不同问题的思路', blind: '可能低估具体执行所需的条件', risk: '宏观设想过多时，下一步行动容易变得模糊', advice: '把每个构想落到一个负责人、时间和交付物上', message: '让远处的方向，落在眼前的一步' },
    balanced: { label: '通观', voice: '眼里有方向，手边也有具体的一步', daily: '你会在全局与细节之间切换，尝试把想法与实际情况连接起来', blind: '可能在不同层级的问题间频繁切换', risk: '同时照顾太多信息时，注意力容易被分散', advice: '先定本次讨论的层级，再决定哪些细节现在处理', message: '既看全貌，也知道此刻要看哪里' },
  },
  organization: {
    low: { label: '规划', voice: '把重要的事，放进能够完成的节奏', daily: '你倾向于提前安排关键节点，用清晰的步骤保持推进', blind: '可能把计划本身看得过重', risk: '环境变化时，调整安排可能带来额外压力', advice: '给计划保留缓冲，并提前设定可调整的部分', message: '安排好节奏，也容得下变化' },
    high: { label: '应变', voice: '情况会变，办法也可以跟着变', daily: '你愿意根据当下情况调整路径，在行动中寻找合适的节奏', blind: '可能较晚处理依赖和收尾事项', risk: '任务较多时，临时调整可能相互挤占时间', advice: '保持路径灵活，同时锁定截止时间与交付标准', message: '灵活地走，也守住重要的约定' },
    balanced: { label: '节奏', voice: '先定重要的节点，其余留给实际情况', daily: '你会为关键事项作安排，也为临时变化保留一定空间', blind: '固定与灵活的边界可能不够明确', risk: '事情积压时，重要节点也可能跟着被推迟', advice: '区分不可变的承诺与可以调整的过程', message: '有计划地开始，有余地地推进' },
  },
};

export function buildReport(result: PublicResult) {
  const person = findCharacter(result.personId)!;
  const local = 'vector' in result ? (result as QuizResult).vector : null;
  const axes = dimensions.map((axis, index) => ({ axis, index, band: result.bands[index], reading: readings[axis.id][result.bands[index]], shared: result.bands[index] !== 'balanced' && result.bands[index] === scoreBand(person.profile[index]) }));
  const ordered = [...axes].sort((a, b) => Number(b.shared) - Number(a.shared) || Math.abs(person.profile[a.index] - 6) - Math.abs(person.profile[b.index] - 6) || a.index - b.index);
  const main = ordered[0];
  return {
    person, axes, main,
    match: local ? matchPercentFor(local, person.profile) : result.matchPercent,
    portrait: person.summary.replace('在本产品的设定中，', '').replace(`${person.name}代表这样的倾向：`, ''),
    common: ordered.slice(0, 3),
    messages: ordered.slice(0, 3).map(item => item.reading.message),
    bars: axes.map(({ axis, band, index }) => ({ axis, label: bandLabel(axis, band), value: local ? Math.round(local[index] / 12 * 100) : null, position: local ? local[index] / 12 * 100 : band === 'low' ? 19 : band === 'high' ? 81 : 50 })),
  };
}
