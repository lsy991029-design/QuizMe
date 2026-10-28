import { findCharacter, type PublicResult } from './quiz';
import { loadPortrait } from './portraits';

type PosterJob = {
  key: string;
  best: Blob | null;
  initial: Promise<Blob>;
  upgraded: Promise<Blob | null>;
};

// Cache blobs rather than object URLs: each mounted view owns and releases its
// own URLs, while returning to the same result reuses the generated PNG.
let currentJob: PosterJob | null = null;
const GENERATION_TIMEOUT = 15_000;

export function posterCacheKey(result: PublicResult, shareUrl: string): string {
  return JSON.stringify([result, shareUrl]);
}

function withDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('人物卡生成超时，请点击“重新生成”重试。')), GENERATION_TIMEOUT);
    }),
  ]).finally(() => clearTimeout(timer));
}

export function getSharePoster(result: PublicResult, shareUrl: string): PosterJob {
  const key = posterCacheKey(result, shareUrl);
  if (currentJob?.key === key) return currentJob;
  const person = findCharacter(result.personId);
  if (!person) throw new Error('没有找到对应人物，请返回结果页重试。');

  const renderer = import('./poster');
  const initial = withDeadline(Promise.all([renderer, loadPortrait(person)])
    .then(([{ createPoster }, portrait]) => createPoster(result, shareUrl, portrait)));
  const job: PosterJob = {
    key, best: null,
    initial,
    upgraded: Promise.resolve(null),
  };
  currentJob = job;
  // This calls the existing decoded-image cache; it does not redownload the
  // report portrait already displayed on the result screen.
  job.initial = initial.then(blob => {
    job.best = blob;
    return blob;
  });
  job.upgraded = job.initial.then(() => withDeadline(Promise.all([renderer, loadPortrait(person, 'poster')])
    .then(([{ createPoster }, portrait]) => createPoster(result, shareUrl, portrait))))
    .then(blob => {
      job.best = blob;
      return blob;
    })
    .catch(() => {
      // A failed initial generation can be retried. A failed HD upgrade keeps
      // the complete standard card and its cache available.
      if (!job.best && currentJob === job) currentJob = null;
      return null;
    });
  return job;
}
