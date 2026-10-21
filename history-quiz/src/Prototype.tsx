import { useEffect, useState, type ComponentType } from 'react';
import AccessGate from './AccessGate';
import { clearSharedEntry, hasAccessGrant, isSharedEntry } from './access';

let experienceModule: Promise<typeof import('./QuizExperience')> | null = null;
function loadExperience() {
  if (!experienceModule) {
    experienceModule = import('./QuizExperience').catch(error => {
      experienceModule = null;
      throw error;
    });
  }
  return experienceModule;
}

export default function Prototype() {
  const [unlocked, setUnlocked] = useState(() => !isSharedEntry() && hasAccessGrant());
  const [Experience, setExperience] = useState<ComponentType | null>(null);
  const [entryVersion, setEntryVersion] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onNavigation = () => {
      setUnlocked(!isSharedEntry() && hasAccessGrant());
      setEntryVersion(version => version + 1);
    };
    window.addEventListener('hashchange', onNavigation);
    window.addEventListener('popstate', onNavigation);
    return () => {
      window.removeEventListener('hashchange', onNavigation);
      window.removeEventListener('popstate', onNavigation);
    };
  }, []);

  useEffect(() => {
    if (!unlocked || Experience) return;
    let active = true;
    setError(false);
    loadExperience().then(module => {
      if (active) setExperience(() => module.default);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [unlocked, Experience]);

  if (!unlocked) return <AccessGate key={entryVersion} onTyping={() => { void loadExperience().catch(() => {}); }} onUnlock={() => {
    clearSharedEntry();
    setUnlocked(true);
  }} />;
  if (Experience) return <Experience key={entryVersion} />;
  return <div className="history-app"><div className="result-preparing" role={error ? 'alert' : 'status'}>
    {error ? <><h1>页面暂时未能加载</h1><p>请检查网络连接后重试</p><button type="button" className="secondary entry-retry" onClick={() => window.location.reload()}>重新加载</button></> : <><span className="loading-ring" aria-hidden="true" /><h1>正在准备测试</h1><p>请稍候</p></>}
  </div></div>;
}
