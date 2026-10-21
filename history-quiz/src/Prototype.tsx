import { createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRightIcon, BarChartIcon, CheckIcon, ChevronLeftIcon, Cross2Icon, DownloadIcon, ExclamationTriangleIcon, GlobeIcon, Link2Icon, QuoteIcon, ReloadIcon, PersonIcon } from '@radix-ui/react-icons';
import { BottomSheet, FlowStack, MobileScroll, useFlow, type FlowControls, type FlowScreen } from './mobile';
import { dimensions, findCharacter, PRODUCT_NAME, questions, type Answer, type Character, type DimensionId, type PublicResult, type QuizResult } from './quiz';
import { clearShareHash, DRAFT_KEY, freshDraft, loadSession, makeShareUrl, readSharedResult, RESULT_KEY, type Draft } from './session';
import { createPoster } from './poster';
import { buildReport } from './report';
import { portraitUrl } from './portraits';
import { createAnonymousSession, QuotaApiError, submitTest, type QuotaSnapshot } from './quota';
import { assetUrl } from './assets';
import { grantAccess, hasAccessGrant, isAccessCode } from './access';

type QuizState = {
  draft: Draft; updateDraft: (draft: Draft) => void; result: QuizResult | null;
  saveResult: (result: QuizResult) => void; startNew: () => void;
  notice: string; shared: PublicResult | null;
  quota: QuotaSnapshot | null; quotaLoading: boolean; quotaError: string;
  refreshQuota: () => Promise<QuotaSnapshot | null>;
  showToast: (message: string) => void;
  pending: boolean; quizError: string;
  chooseAnswer: (answer: Answer, flow: FlowControls, autoAdvance?: boolean) => void;
  advance: (draft: Draft, flow: FlowControls) => Promise<void>;
  cancelAdvance: () => void;
};
const QuizContext = createContext<QuizState>(null!);
const useQuiz = () => useContext(QuizContext);
const homeScreen: FlowScreen = { id: 'home', render: flow => <Home flow={flow} /> };
const quizScreen: FlowScreen = { id: 'quiz', header: () => <QuizHeader />, headerHeight: 72, footer: flow => <QuizFooter flow={flow} />, footerHeight: 136, render: () => <Quiz /> };
const resultScreen: FlowScreen = { id: 'result', header: () => <InnerHeader />, headerHeight: 64, render: () => <Result /> };
const shareScreen: FlowScreen = { id: 'share', header: flow => <InnerHeader onBack={flow.pop} backLabel="返回结果" />, headerHeight: 64, render: flow => <Share flow={flow} /> };
const sharedScreen: FlowScreen = { id: 'shared', header: () => <InnerHeader />, headerHeight: 64, footer: flow => <VisitorFooter flow={flow} />, footerHeight: 132, render: () => <SharedResult /> };
const unavailableScreen: FlowScreen = { id: 'unavailable', header: () => <InnerHeader />, headerHeight: 64, render: flow => <Unavailable flow={flow} /> };
const accessScreen = (next: FlowScreen): FlowScreen => ({ id: 'access', render: flow => <AccessGate flow={flow} next={next} /> });

function Brand() { return <span className="brand">{PRODUCT_NAME}<span className="brand-dot" aria-hidden="true" /></span>; }
function Primary({ children, onClick, disabled = false, busy = false, className = '' }: { children: ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; className?: string }) {
  return <button type="button" className={`primary ${className}`} onClick={onClick} disabled={disabled || busy} aria-busy={busy}>{children}</button>;
}
function Page({ children, id, className = '', pageKey }: { children: ReactNode; id: string; className?: string; pageKey?: string }) {
  const flow = useFlow();
  const active = flow.current.id === id;
  return <MobileScroll key={pageKey} className="history-scroll"><main className={`history-page ${className}`} aria-hidden={!active} inert={!active}>{children}</main></MobileScroll>;
}
const withoutFullStops = (text: string) => text.replaceAll('。', '');
function StorageNotice({ omitFullStops = false }: { omitFullStops?: boolean }) { const { notice } = useQuiz(); return notice ? <p className="storage-notice" role="status">{omitFullStops ? withoutFullStops(notice) : notice}</p> : null; }
function Toast({ message }: { message: string }) { return message ? <div className="toast" role="status">{message}</div> : null; }
function InnerHeader({ onBack, backLabel = '返回' }: { onBack?: () => void; backLabel?: string }) {
  return <div className="inner-header">{onBack ? <button type="button" className="back" onClick={onBack}><ChevronLeftIcon />{backLabel}</button> : <span />}<Brand /><span /></div>;
}
function AccessGate({ flow, next }: { flow: FlowControls; next: FlowScreen }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const unlock = () => {
    if (code.length !== 6) {
      setError('请输入 6 位数字令牌。');
      inputRef.current?.focus();
      return;
    }
    if (!isAccessCode(code)) {
      setError('令牌无效，请检查后重试。');
      setCode('');
      inputRef.current?.focus();
      return;
    }
    grantAccess();
    flow.replace(next);
  };
  return <Page id="access" className="access-page">
    <section className="access-card" aria-labelledby="access-title">
      <div className="access-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg></div>
      <p className="access-kicker">QUIZME · PRIVATE ACCESS</p>
      <h1 id="access-title">访问验证</h1>
      <p className="access-description">这是一次私密的人格测试，请输入 6 位访问令牌后继续。</p>
      <label className="sr-only" htmlFor="access-code">6 位访问令牌</label>
      <input ref={inputRef} id="access-code" className="access-code" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} onKeyDown={event => { if (event.key === 'Enter') unlock(); }} aria-invalid={Boolean(error)} aria-describedby={error ? 'access-error' : 'access-help'} placeholder="请输入 6 位数字" />
      {error ? <p id="access-error" className="access-error" role="alert">{error}</p> : <p id="access-help" className="access-help">令牌仅用于开启测试，不会提交个人信息。</p>}
      <Primary onClick={unlock} disabled={code.length !== 6}>立即解锁<ArrowRightIcon /></Primary>
    </section>
  </Page>;
}
function InfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <BottomSheet open={open} onOpenChange={value => { if (!value) onClose(); }} title="关于这场相遇" description="24 道选择，100 位中国历史人物" snap={0.69}><div className="info-body">
    <ul className="info-list" role="list">
    <li>这是一场以中国历史人物为灵感的趣味性格探索，不考历史知识，每道题也没有正确答案</li>
    <li>请选择更接近日常习惯的选项，点击选项后将自动进入下一题，你也可以在答题过程中返回修改，首页的“开始测试”始终从第 1 题开始</li>
    <li>完成后，会根据六个行为倾向维度匹配一位历史人物，人物形象属于产品诠释，不代表真实人物完整的性格，也不构成专业心理评估</li>
    <li>无需提供姓名、手机号或生日，原始答案保留在当前浏览器；分享链接只包含人物结果与倾向摘要，持有链接的人可以查看</li>
    </ul>
    <Primary onClick={onClose}>开始了解自己<ArrowRightIcon /></Primary>
  </div></BottomSheet>;
}
function HomeHeader({ onInfo }: { onInfo: () => void }) {
  return <header className="home-header reference-home-header"><Brand /><button type="button" className="quiet-link" onClick={onInfo}>测试说明</button></header>;
}
function HomeCanvas({ children }: { children: ReactNode }) {
  const flow = useFlow();
  return <div className="home-static"><main className="history-page home-page" aria-hidden={flow.current.id !== 'home'} inert={flow.current.id !== 'home'}>{children}</main></div>;
}
function Home({ flow }: { flow: FlowControls }) {
  const [info, setInfo] = useState(false);
  const features = [
    { icon: 'scroll', title: '古代群像', text: '历代风云人物' },
    { icon: 'people', title: '男女皆有', text: '多元人物角色' },
    { icon: 'analysis', title: '多维分析', text: '解读性格倾向' },
    { icon: 'speed', title: '快速完成', text: '即刻查看结果' },
  ];
  return <><HomeCanvas><HomeHeader onInfo={() => setInfo(true)} /><StorageNotice />
    <section className="home-hero"><div className="home-heading"><h1>如果生在古代<br />你会<span>是谁</span></h1><p lang="en">Historical Personality Quiz</p><img className="home-seal" src={assetUrl('art/home-reference/seal.webp')} alt="" aria-hidden="true" /></div><img className="home-ensemble" src={assetUrl('art/home-reference/historical-ensemble-v2.webp')} alt="中国古代文士、女性与将领群像，背景为山水楼阁" draggable={false} /></section>
    <p className="home-description">通过多组情境选择，探索你的决断、洞察、表达与担当</p>
    <section className="home-features" aria-label="测试特点">{features.map(feature => <div className="home-feature" key={feature.icon}><img src={assetUrl(`art/home-reference/${feature.icon}.webp`)} alt="" aria-hidden="true" draggable={false} /><div><h2>{feature.title}</h2><p>{feature.text}</p></div></div>)}</section>
    <aside className="home-instructions"><h2>测试说明</h2><p>没有标准答案，请选择最接近真实自己的反应。</p></aside>
    <HomeFooter flow={flow} />
  </HomeCanvas><InfoSheet open={info} onClose={() => setInfo(false)} /></>;
}
function HomeFooter({ flow }: { flow: FlowControls }) {
  const quiz = useQuiz();
  const start = async () => {
    const quota = quiz.quota ?? await quiz.refreshQuota();
    if (!quota) return;
    quiz.startNew(); clearShareHash(); flow.replace(quizScreen);
  };
  return <div className="home-footer reference-home-footer">
    <Primary onClick={() => { void start(); }} disabled={quiz.quotaLoading} busy={quiz.quotaLoading}>开始测试<ArrowRightIcon /></Primary>
  </div>;
}
function DimensionIcon({ dimension }: { dimension: DimensionId }) {
  const shapes: Record<DimensionId, ReactNode> = {
    decision: <><path d="M12 5.5C12 2.5 7.5 2.1 6.5 5.2C3.2 5.1 2.2 8.6 4.1 10.5C1.8 12.5 3.2 16.3 5.7 16.7C5.2 20 9.9 22 12 19.2C14.1 22 18.8 20 18.3 16.7C20.8 16.3 22.2 12.5 19.9 10.5C21.8 8.6 20.8 5.1 17.5 5.2C16.5 2.1 12 2.5 12 5.5Z" /><path d="M12 5.5V19.2M6.5 5.2V8M4.1 10.5L7 11.5M5.7 16.7L8 15M17.5 5.2V8M19.9 10.5L17 11.5M18.3 16.7L16 15" /></>,
    social: <><circle cx="8" cy="7" r="3.5" /><circle cx="18" cy="8" r="2.5" /><path d="M2 21V19A6 6 0 0 1 14 19V21M17 15A5 5 0 0 1 22 20" /></>,
    change: <><path d="M3 5H5C10 5 14 19 19 19H21M17 15L21 19L17 23M3 19H5C7.5 19 9.5 15.5 12 12M15 7C16.3 5.7 17.6 5 19 5H21M17 1L21 5L17 9" /></>,
    expression: <path d="M21 11.5A9 9 0 0 1 7.2 19.2L3 20.5L4.3 16.3A9 9 0 1 1 21 11.5Z" />,
    focus: <><path d="M2 12S5.6 4 12 4S22 12 22 12S18.4 20 12 20S2 12 2 12Z" /><circle cx="12" cy="12" r="3.5" /></>,
    organization: <><circle cx="12" cy="4" r="3" /><circle cx="5" cy="20" r="3" /><circle cx="19" cy="20" r="3" /><path d="M12 7V11M5 17V14A3 3 0 0 1 8 11H16A3 3 0 0 1 19 14V17" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-dimension={dimension}>{shapes[dimension]}</svg>;
}
function QuizHeader() {
  const quiz = useQuiz();
  const current = quiz.draft.index + 1;
  const percent = Math.round(current / questions.length * 100);
  const question = questions[quiz.draft.index];
  const dimension = dimensions.find(axis => axis.id === question.dimension)!;
  return <div className="quiz-header">
    <div className="quiz-dimension-row"><span className="quiz-dimension"><span className="quiz-dimension-icon" aria-hidden="true"><DimensionIcon dimension={dimension.id} /></span>{dimension.name}</span><div className="question-counter"><strong>{current}/{questions.length}</strong><span className="quiz-percentage">{percent}%</span></div></div>
    <progress value={current} max={questions.length} aria-label={`当前第 ${current} 题，共 ${questions.length} 题，进度 ${percent}%`} />
  </div>;
}
function Quiz() {
  const quiz = useQuiz();
  const flow = useFlow();
  const { draft } = quiz;
  const q = questions[draft.index];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [draft.index]);
  useEffect(() => quiz.cancelAdvance, [quiz.cancelAdvance]);
  const onArrow = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) + 4) % 4;
    quiz.chooseAnswer(q.options[next].id, flow, false);
    const buttons = event.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next].focus();
  };
  const selected = draft.answers[draft.index];
  return <Page id="quiz" className="quiz-page" pageKey={q.id}><StorageNotice omitFullStops /><section className="question"><h1 ref={heading} tabIndex={-1} id="question-title">{withoutFullStops(q.title)}</h1><p className="question-hint">选择更接近日常习惯的一项</p></section><div className="answers" role="radiogroup" aria-labelledby="question-title">{q.options.map((option, i) => <button key={option.id} type="button" className={`answer ${selected === option.id ? 'is-selected' : ''}`} role="radio" aria-checked={selected === option.id} disabled={quiz.pending} tabIndex={selected === option.id || (!selected && i === 0) ? 0 : -1} onKeyDown={event => onArrow(event, i)} onClick={() => quiz.chooseAnswer(option.id, flow)}><span className="answer-letter" aria-hidden="true">{option.id}</span><span className="answer-text">{withoutFullStops(option.text)}</span><span className="answer-check" aria-hidden="true">{selected === option.id ? <CheckIcon /> : null}</span></button>)}</div></Page>;
}
function QuizFooter({ flow }: { flow: FlowControls }) {
  const quiz = useQuiz();
  const { draft } = quiz;
  const selected = draft.answers[draft.index] !== null;
  return <div className="app-footer quiz-footer"><div className="question-nav">{draft.index > 0 ? <button type="button" className="previous" disabled={quiz.pending} onClick={() => { quiz.cancelAdvance(); quiz.updateDraft({ ...draft, index: draft.index - 1, updatedAt: Date.now() }); }}><ChevronLeftIcon />上一题</button> : null}<Primary className={quiz.pending ? 'is-advancing' : ''} onClick={() => quiz.advance(draft, flow)} disabled={!selected} busy={quiz.pending}>{draft.index === questions.length - 1 ? '查看结果' : '下一题'}<ArrowRightIcon /></Primary></div>{quiz.quizError ? <p className="footer-hint error" role="alert">{withoutFullStops(quiz.quizError)}</p> : null}</div>;
}
function Traits({ person }: { person: Character }) { return <div className="traits">{person.tags.map(tag => <span key={tag}>{tag}</span>)}</div>; }
function ReportSection({ number, title, icon, children }: { number: string; title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="report-card report-section"><h2><span className="report-section-icon" aria-hidden="true">{icon}</span><span><span className="report-section-number">{number} · </span>{title}</span></h2>{children}</section>;
}
function ReportNote({ title, children }: { title: string; children: ReactNode }) {
  return <div className="report-note"><h3>{title}</h3><p>{children}</p></div>;
}
function ResultBody({ result, shared = false }: { result: PublicResult; shared?: boolean }) {
  const report = buildReport(result);
  const { person, main } = report;
  return <div className="report-body">
    <section className="report-card report-hero"><p className="report-kicker">{shared ? '朋友的历史人物匹配结果' : '你的历史人物匹配结果'}</p>
      <img className="report-portrait" src={portraitUrl(person)} alt={`${person.name}水墨人物画像`} width={1024} height={768} draggable={false} />
      <div className="report-identity"><h1>{person.name}</h1>{report.match !== undefined ? <div className="report-match"><strong>{report.match}<span>%</span></strong><span>同频指数</span></div> : null}</div>
      <p className="report-person-meta">{person.era} · {person.field} · {person.typeTitle}</p><Traits person={person} />
      <span className="report-main-trait">主导倾向：{main.reading.label}</span><div className="report-heart"><h2>人物心声</h2><p>“{main.reading.voice}”</p></div>
    </section>
    <ReportSection number="01" title="人物画像" icon={<PersonIcon />}><p className="report-copy">你与{person.name}相似的，是面对事情的方式。{report.portrait}</p><p className="report-copy">{person.strength}</p>{result.tied ? <p className="report-caption">本次有多位人物同样接近，当前展示其中一位</p> : null}</ReportSection>
    <ReportSection number="02" title="六维倾向结构" icon={<BarChartIcon />}><div className="report-axes">{report.bars.map(item => <div className="report-axis" key={item.axis.id}><div className="report-axis-heading"><span>{item.axis.name}</span><strong>{item.label}</strong></div><progress value={item.position} max={100} aria-label={`${item.axis.name}：${item.axis.low}到${item.axis.high}，${item.value === null ? item.label : `倾向位置 ${item.value}%`}`} /><div className="report-axis-ends"><span>{item.axis.low}</span><span>{item.value === null ? '' : item.value}</span><span>{item.axis.high}</span></div></div>)}</div><p className="report-caption">刻度表示倾向位置，两端没有优劣之分</p></ReportSection>
    <ReportSection number="03" title="你与 TA 的共同底色" icon={<Link2Icon />}>{report.common.map((item, i) => <ReportNote key={item.axis.id} title={`${['第一底色', '内在倾向', '行动节奏'][i]} · ${item.reading.label}`}>{item.reading.daily}{item.shared ? `，这与你匹配到的${person.name}人物画像方向相近` : `，这是你在${item.axis.name}上的本次选择倾向`}</ReportNote>)}</ReportSection>
    <ReportSection number="04" title="现实中的你" icon={<GlobeIcon />}><ReportNote title="现实互动方式">{main.reading.daily}</ReportNote><ReportNote title="你的优势场景">{person.strength}当任务需要{main.reading.label}时，你可以有意识地发挥这种倾向</ReportNote></ReportSection>
    <ReportSection number="05" title="性格盲点与风险提醒" icon={<ExclamationTriangleIcon />}><ReportNote title="可能的盲点">{main.reading.blind}</ReportNote><ReportNote title="风险提醒">{main.reading.risk}</ReportNote><ReportNote title="给你的建议">{person.caution}{main.reading.advice}</ReportNote></ReportSection>
    <ReportSection number="06" title="你的三句人物寄语" icon={<QuoteIcon />}><p className="report-caption">从这份人物画像中，带走三句给自己的话</p><div className="report-messages">{report.messages.map(message => <blockquote key={message}>“{message}”</blockquote>)}</div></ReportSection>
  </div>;
}
function Result() {
  const { result } = useQuiz();
  const flow = useFlow();
  return <Page id="result" className="result-page">{result ? <><ResultBody result={result} /><ResultFooter flow={flow} /></> : <div className="empty-state"><h1>还没有可用的结果</h1><p>请从首页完成测试，再来查看你的同频人物。</p></div>}</Page>;
}
function ResultFooter({ flow }: { flow: FlowControls }) {
  const quiz = useQuiz();
  return <div className="app-footer result-footer"><Primary onClick={() => flow.push(shareScreen)} disabled={!quiz.result}>分享我的测试结果<ArrowRightIcon /></Primary><button type="button" className="text-button report-retest" onClick={() => { quiz.startNew(); clearShareHash(); flow.replace(homeScreen); }}>重新测试</button></div>;
}
function SharedResult() {
  const { shared } = useQuiz();
  return <Page id="shared" className="result-page shared-page">{shared ? <><p className="visitor-label">这是一份分享结果</p><ResultBody result={shared} shared /></> : null}</Page>;
}
function VisitorFooter({ flow }: { flow: FlowControls }) {
  const quiz = useQuiz();
  return <div className="app-footer visitor-footer"><Primary onClick={() => { quiz.startNew(); clearShareHash(); flow.replace(accessScreen(quizScreen)); }}>开始测试<ArrowRightIcon /></Primary><p className="footer-hint">24 道情境选择，遇见你的同频人物</p></div>;
}
function Unavailable({ flow }: { flow: FlowControls }) {
  return <Page id="unavailable" className="unavailable-page"><p className="eyebrow">这次相遇，暂未抵达</p><h1>这份结果<br />暂时无法查看</h1><p>链接可能不完整，或对应的内容版本已不可用。你仍可以开启自己的测试。</p><Primary onClick={() => { clearShareHash(); flow.replace(hasAccessGrant() ? homeScreen : accessScreen(homeScreen)); }}>开始我的测试<ArrowRightIcon /></Primary></Page>;
}
function Share({ flow }: { flow: FlowControls }) {
  const { result } = useQuiz();
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fallback, setFallback] = useState(false);
  const [retry, setRetry] = useState(0);
  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef('');
  const person = result ? findCharacter(result.personId)! : null;
  const shareUrl = result ? makeShareUrl(result) : '';
  useEffect(() => {
    if (!result) return;
    let alive = true;
    blobRef.current = null; setImageUrl(''); setError('');
    createPoster(result, shareUrl).then(blob => {
      if (!alive) return;
      blobRef.current = blob;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob); setImageUrl(urlRef.current);
    }).catch(reason => { if (alive) setError(reason instanceof Error ? reason.message : '人物卡生成失败，请重试。'); });
    return () => { alive = false; if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = ''; } };
  }, [result?.id, shareUrl, retry]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 3200); return () => clearTimeout(timer); }, [message]);
  if (!person || !result) return <Page id="share"><div className="empty-state"><h1>请先完成测试</h1><Primary onClick={() => flow.replace(homeScreen)}>返回开始页<ArrowRightIcon /></Primary></div></Page>;
  const save = async () => {
    if (!blobRef.current || busy) return;
    setBusy(true);
    try {
      const file = new File([blobRef.current], `${PRODUCT_NAME}-${person.name}.png`, { type: 'image/png' });
      if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `我的历史人物匹配结果是${person.name}` });
        setMessage('已完成系统分享操作');
      } else {
        const link = document.createElement('a'); link.href = imageUrl; link.download = file.name;
        document.body.appendChild(link); link.click(); link.remove(); setMessage('已发起图片下载，可在下载记录中查看。');
      }
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) setFallback(true);
    } finally { setBusy(false); }
  };
  const copy = async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await Promise.race([
        navigator.clipboard.writeText(shareUrl),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('clipboard timeout')), 1800); }),
      ]);
      setMessage('结果链接已复制');
    } catch { setFallback(true); }
    finally { clearTimeout(timeout); }
  };
  return <><Page id="share" className="share-page"><div className="share-intro"><h1>我的人物卡</h1><p>一张卡片，记录这次跨越时代的相遇。</p></div><figure className="poster-figure">{imageUrl ? <img className="poster-image" src={imageUrl} alt={`我的历史人物匹配结果：${person.name}，${person.typeTitle}。关键词：${person.tags.join('、')}。`} /> : <div className="poster-loading" role="status">{error ? <><span>{error}</span><button type="button" className="text-button" onClick={() => setRetry(value => value + 1)}>重新生成<ReloadIcon /></button></> : <><span className="loading-ring" /><span>正在生成人物卡</span></>}</div>}</figure><div className="share-actions"><Primary onClick={save} busy={busy} disabled={!imageUrl}>{busy ? '正在准备图片' : '保存图片'}<DownloadIcon /></Primary><button type="button" className="secondary" onClick={copy}>复制结果链接<Link2Icon /></button></div></Page><Toast message={message} /><BottomSheet open={fallback} onOpenChange={setFallback} title="保存图片与复制链接" description="可长按下方图片保存，或选中完整链接手动复制。" snap={0.82}><div className="save-fallback">{imageUrl ? <img src={imageUrl} alt={`${person.name}人物卡，支持长按保存`} /> : <p>图片尚未生成，请返回页面重试。</p>}<a href={shareUrl} target="_blank" rel="noopener noreferrer">{shareUrl}</a><button type="button" className="secondary" onClick={() => setFallback(false)}>返回人物卡<Cross2Icon /></button></div></BottomSheet></>;
}

export default function Prototype() {
  const [initial] = useState(loadSession);
  const [draft, setDraft] = useState(initial.draft);
  const [result, setResult] = useState(initial.result);
  const [notice, setNotice] = useState(initial.notice);
  const [pending, setPending] = useState(false);
  const [quizError, setQuizError] = useState('');
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [quotaError, setQuotaError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitKeyRef = useRef('');
  const submitSignatureRef = useRef('');
  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setPending(false);
  }, []);
  useEffect(() => () => { if (advanceTimer.current !== null) clearTimeout(advanceTimer.current); }, []);
  const showToast = useCallback((message: string) => {
    if (toastTimer.current !== null) clearTimeout(toastTimer.current);
    setToastMessage(message);
    toastTimer.current = setTimeout(() => {
      toastTimer.current = null;
      setToastMessage('');
    }, 2200);
  }, []);
  useEffect(() => () => { if (toastTimer.current !== null) clearTimeout(toastTimer.current); }, []);
  const [externalHash, setExternalHash] = useState(window.location.hash);
  const sharedRoute = readSharedResult(externalHash);
  const appRef = useRef<HTMLDivElement>(null);
  const updateDraft = (next: Draft) => {
    setDraft(next);
    setQuizError('');
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); }
    catch { setNotice('当前设备未能保存进度，关闭页面后可能需要重新作答。'); }
  };
  const saveResult = (next: QuizResult) => {
    setResult(next);
    try { localStorage.setItem(RESULT_KEY, JSON.stringify(next)); }
    catch { setNotice('当前结果未能保存到设备，请保持页面开启并及时保存人物卡。'); }
  };
  const refreshQuota = useCallback(async () => {
    setQuotaLoading(true);
    setQuotaError('');
    try {
      const next = await createAnonymousSession();
      setQuota(next);
      return next;
    } catch (reason) {
      setQuota(null);
      setQuotaError(reason instanceof QuotaApiError ? reason.message : '暂时无法读取测试次数，请重试。');
      return null;
    } finally {
      setQuotaLoading(false);
    }
  }, []);
  useEffect(() => { void refreshQuota(); }, [refreshQuota]);
  const advance = async (next: Draft, flow: FlowControls) => {
    cancelAdvance();
    if (!next.answers[next.index]) return;
    setQuizError('');
    if (next.index < questions.length - 1) {
      updateDraft({ ...next, index: next.index + 1, updatedAt: Date.now() });
      return;
    }
    const missing = next.answers.findIndex(answer => answer === null);
    if (missing >= 0) {
      updateDraft({ ...next, index: missing, updatedAt: Date.now() });
      setQuizError('请先完成这道题。');
      return;
    }
    const answers = next.answers as Answer[];
    const signature = JSON.stringify(answers);
    if (submitSignatureRef.current !== signature) {
      submitSignatureRef.current = signature;
      submitKeyRef.current = crypto.randomUUID();
    }
    setPending(true);
    try {
      const response = await submitTest({ idempotencyKey: submitKeyRef.current, answers });
      saveResult(response.result);
      setQuota(response.quota);
      updateDraft({ ...next, completed: true, updatedAt: Date.now() });
      flow.replace(resultScreen);
    } catch (reason) {
      if (reason instanceof QuotaApiError) {
        setQuizError(reason.message);
        if (reason.code === 'INVALID_ANONYMOUS_SESSION') void refreshQuota();
      } else {
        setQuizError('结果暂时无法生成，答案已保留，请重试。');
      }
    } finally {
      setPending(false);
    }
  };
  const chooseAnswer = (answer: Answer, flow: FlowControls, autoAdvance = true) => {
    if (advanceTimer.current !== null) return;
    const answers = [...draft.answers];
    answers[draft.index] = answer;
    const next = { ...draft, answers, updatedAt: Date.now() };
    updateDraft(next);
    if (!autoAdvance) return;
    setPending(true);
    advanceTimer.current = setTimeout(() => { void advance(next, flow); }, 260);
  };
  useEffect(() => {
    const onExternalNavigation = () => { cancelAdvance(); setExternalHash(window.location.hash); };
    window.addEventListener('hashchange', onExternalNavigation);
    window.addEventListener('popstate', onExternalNavigation);
    const screen = appRef.current?.closest<HTMLElement>('[data-phone-screen]');
    const keepViewport = () => { if (screen && (screen.scrollTop || screen.scrollLeft)) screen.scrollTo(0, 0); };
    screen?.addEventListener('scroll', keepViewport, { passive: true });
    return () => { window.removeEventListener('hashchange', onExternalNavigation); window.removeEventListener('popstate', onExternalNavigation); screen?.removeEventListener('scroll', keepViewport); };
  }, [cancelAdvance]);
  const initialScreen = sharedRoute.present
    ? sharedRoute.result ? sharedScreen : unavailableScreen
    : hasAccessGrant() ? homeScreen : accessScreen(homeScreen);
  return <QuizContext.Provider value={{ draft, updateDraft, result, saveResult, startNew: () => { cancelAdvance(); submitKeyRef.current = ''; submitSignatureRef.current = ''; updateDraft(freshDraft()); }, notice, shared: sharedRoute.result, quota, quotaLoading, quotaError, refreshQuota, showToast, pending, quizError, chooseAnswer, advance, cancelAdvance }}><div ref={appRef} className="history-app"><FlowStack key={externalHash} initial={initialScreen} /><Toast message={toastMessage} /></div></QuizContext.Provider>;
}
