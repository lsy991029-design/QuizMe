import { useEffect, useRef, useState } from 'react';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { useKeyboard } from './mobile/Keyboard';
import { grantAccess, isAccessCode } from './access';

export default function AccessGate({ onUnlock, onTyping }: { onUnlock: () => void; onTyping: () => void }) {
  const keyboard = useKeyboard();
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
    keyboard.hide();
    onUnlock();
  };
  return <div className="history-app"><div className="document-scroll history-scroll"><main className="history-page access-page">
    <section className="access-card" aria-labelledby="access-title">
      <div className="access-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></svg></div>
      <p className="access-kicker">QUIZME · PRIVATE ACCESS</p>
      <h1 id="access-title">访问验证</h1>
      <p className="access-description">这是一次私密的人格测试，请输入 6 位访问令牌后继续。</p>
      <label className="sr-only" htmlFor="access-code">6 位访问令牌</label>
      <input ref={inputRef} id="access-code" className="access-code" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); onTyping(); }} onKeyDown={event => { if (event.key === 'Enter') unlock(); }} aria-invalid={Boolean(error)} aria-describedby={error ? 'access-error' : 'access-help'} placeholder="请输入 6 位数字" />
      {error ? <p id="access-error" className="access-error" role="alert">{error}</p> : <p id="access-help" className="access-help">令牌仅用于开启测试，不会提交个人信息。</p>}
      <button type="button" className="primary" onClick={unlock} disabled={code.length !== 6}>立即解锁<ArrowRightIcon /></button>
    </section>
  </main></div></div>;
}
