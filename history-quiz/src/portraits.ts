import type { Character } from './quiz';
import { assetUrl } from './assets';

const portraits = new Map<string, Promise<HTMLImageElement>>();
const readyPortraits = new Map<string, HTMLImageElement>();
const portraitAssetUrl = (person: Pick<Character, 'id'>) => assetUrl(`art/portraits/${person.id}.webp`);

// Reuse the decoded local resource in reports and posters without another network request.
export const portraitUrl = (person: Pick<Character, 'id'>) => {
  const url = portraitAssetUrl(person);
  return readyPortraits.get(url)?.src ?? url;
};

export function loadPortrait(person: Character): Promise<HTMLImageElement> {
  const url = portraitAssetUrl(person);
  const cached = portraits.get(url);
  if (cached) return cached;
  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const controller = new AbortController();
    let localUrl = '';
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      controller.abort();
      if (localUrl) URL.revokeObjectURL(localUrl);
      reject(new Error(`${person.name}的人物画像暂时未能加载，请重试。`));
    };
    const timeout = setTimeout(fail, 12000);
    image.onload = async () => {
      try { await image.decode(); } catch { fail(); return; }
      if (settled) return;
      settled = true;
      cleanup();
      readyPortraits.set(url, image);
      resolve(image);
    };
    image.onerror = fail;
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error('Portrait request failed');
        const blob = await response.blob();
        if (settled) return;
        localUrl = URL.createObjectURL(blob);
        image.src = localUrl;
      } catch { fail(); }
    })();
  });
  portraits.set(url, loading);
  void loading.catch(() => { portraits.delete(url); });
  return loading;
}
