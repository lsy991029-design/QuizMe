import peopleData from './data/people.json' with { type: 'json' };
import questionData from './data/questions.json' with { type: 'json' };

export type Band = 'low' | 'balanced' | 'high';
export type Answer = 'A' | 'B' | 'C' | 'D';
export type DimensionId = 'decision' | 'social' | 'change' | 'expression' | 'focus' | 'organization';
export type Dimension = { id: DimensionId; name: string; low: string; high: string };
export type Choice = { id: Answer; text: string; score: number };
export type Question = { id: string; dimension: DimensionId; title: string; options: Choice[] };
export type Character = {
  id: string; name: string; era: string; field: string; typeTitle: string;
  profile: number[]; tags: string[]; summary: string; strength: string;
  caution: string; historicalContext: string; shareText: string;
};
export type PublicResult = {
  version: string; id: string; personId: string; bands: Band[]; createdAt: number; tied: boolean; matchPercent?: number;
};
export type QuizResult = PublicResult & { vector: number[] };
export const PRODUCT_NAME = '古代人格测试';
export const CONTENT_VERSION = peopleData.version;
export const dimensions = peopleData.dimensions as Dimension[];
export const characters: Character[] = peopleData.people.map(({ id, name, era, field, typeTitle, profile, tags, summary, strength, caution, historicalContext, shareText }) => ({ id, name, era, field, typeTitle, profile, tags, summary, strength, caution, historicalContext, shareText }));
export const questions = dimensions.flatMap(dimension => (questionData.questions as Question[]).filter(question => question.dimension === dimension.id));
export const findCharacter = (id: string) => characters.find(person => person.id === id);
const axisIndex = new Map(dimensions.map((dimension, index) => [dimension.id, index]));
export const scoreBand = (score: number): Band => score <= 4 ? 'low' : score >= 8 ? 'high' : 'balanced';

export function scoreAnswers(answers: unknown): number[] {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error('请完成全部 24 道题。');
  const vector = dimensions.map(() => 0);
  questions.forEach((question, index) => {
    const option = question.options.find(choice => choice.id === answers[index]);
    if (typeof answers[index] !== 'string' || !option) throw new Error(`请完成第 ${index + 1} 题后再查看结果。`);
    vector[axisIndex.get(question.dimension)!] += option.score;
  });
  return vector;
}

export function rankCharacters(vector: number[]) {
  if (vector.length !== 6 || vector.some(value => !Number.isInteger(value) || value < 0 || value > 12)) throw new Error('本次答案暂时无法计算，请重新检查。');
  return characters.map(person => ({ person, distance: vector.reduce((sum, value, axis) => sum + (value - person.profile[axis]) ** 2, 0) }))
    .sort((a, b) => a.distance - b.distance || a.person.id.localeCompare(b.person.id));
}

export const matchPercentFor = (vector: number[], profile: number[]) => Math.round((1 - Math.sqrt(vector.reduce((sum, value, i) => sum + (value - profile[i]) ** 2, 0)) / Math.sqrt(6 * 12 ** 2)) * 100);

export function calculateResult(answers: unknown): QuizResult {
  const vector = scoreAnswers(answers);
  const ranked = rankCharacters(vector);
  return { version: CONTENT_VERSION, id: crypto.randomUUID(), personId: ranked[0].person.id,
    bands: vector.map(scoreBand), vector, matchPercent: matchPercentFor(vector, ranked[0].person.profile), createdAt: Date.now(), tied: ranked[0].distance === ranked[1].distance };
}

export function isPublicResult(value: unknown): value is PublicResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<PublicResult>;
  return result.version === CONTENT_VERSION && typeof result.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result.id)
    && typeof result.personId === 'string' && !!findCharacter(result.personId)
    && Array.isArray(result.bands) && result.bands.length === dimensions.length
    && result.bands.every(b => ['low', 'balanced', 'high'].includes(b))
    && typeof result.createdAt === 'number' && Number.isFinite(result.createdAt) && result.createdAt > 0
    && typeof result.tied === 'boolean'
    && (result.matchPercent === undefined || (Number.isInteger(result.matchPercent) && result.matchPercent! >= 0 && result.matchPercent! <= 100));
}

export function toPublicResult(result: PublicResult): PublicResult {
  return { version: result.version, id: result.id, personId: result.personId, bands: [...result.bands], createdAt: result.createdAt, tied: result.tied, ...(result.matchPercent === undefined ? {} : { matchPercent: result.matchPercent }) };
}

export function bandLabel(axis: Dimension, band: Band): string {
  return band === 'balanced' ? '两端倾向接近' : axis[band];
}

export function describeBand(axis: Dimension, band: Band): string {
  return band === 'balanced'
    ? `在${axis.name}上，两端倾向较为接近，尚未呈现明确偏向。`
    : `在${axis.name}上，本次选择更靠近「${axis[band]}」一端。`;
}

export function sharedAxes(result: PublicResult): string[] {
  const person = findCharacter(result.personId)!;
  return dimensions.filter((_, index) => result.bands[index] !== 'balanced' && result.bands[index] === scoreBand(person.profile[index]))
    .map(dimension => dimension.name);
}

if (questionData.version !== CONTENT_VERSION || characters.length !== 100 || questions.length !== 24) throw new Error('测试内容版本不完整，请重新加载。');
