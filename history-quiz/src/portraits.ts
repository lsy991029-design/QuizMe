import type { Character } from './quiz';
import { assetUrl } from './assets';

export const portraitUrl = (person: Pick<Character, 'id'>) => assetUrl(`art/portraits/${person.id}.webp`);

export function loadPortrait(person: Character): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => fail(), 12000);
    const fail = () => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      reject(new Error(`${person.name}的人物画像暂时未能加载，请重新生成人物卡。`));
    };
    image.onload = () => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(image);
    };
    image.onerror = fail;
    image.src = portraitUrl(person);
  });
}
