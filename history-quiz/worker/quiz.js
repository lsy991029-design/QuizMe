import { peopleData, questionData } from "./quiz-data.js";

export const CONTENT_VERSION = peopleData.version;
export const dimensions = peopleData.dimensions;
export const characters = peopleData.people.map(({ id, name, era, field, typeTitle, profile, tags, summary, strength, caution, historicalContext, shareText }) => ({ id, name, era, field, typeTitle, profile, tags, summary, strength, caution, historicalContext, shareText }));
export const questions = dimensions.flatMap((dimension) => questionData.questions.filter((question) => question.dimension === dimension.id));
const axisIndex = new Map(dimensions.map((dimension, index) => [dimension.id, index]));

export function scoreBand(score) {
  return score <= 4 ? "low" : score >= 8 ? "high" : "balanced";
}

export function scoreAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== questions.length) throw new Error("INVALID_TEST_PAYLOAD");
  const vector = dimensions.map(() => 0);
  questions.forEach((question, index) => {
    const answer = answers[index];
    const option = question.options.find((choice) => choice.id === answer);
    if (typeof answer !== "string" || !option) throw new Error("INVALID_TEST_PAYLOAD");
    vector[axisIndex.get(question.dimension)] += option.score;
  });
  return vector;
}

export function rankCharacters(vector) {
  if (vector.length !== 6 || vector.some((value) => !Number.isInteger(value) || value < 0 || value > 12)) throw new Error("INVALID_TEST_PAYLOAD");
  return characters.map((person) => ({ person, distance: vector.reduce((sum, value, axis) => sum + (value - person.profile[axis]) ** 2, 0) }))
    .sort((a, b) => a.distance - b.distance || a.person.id.localeCompare(b.person.id));
}

export function matchPercentFor(vector, profile) {
  return Math.round((1 - Math.sqrt(vector.reduce((sum, value, index) => sum + (value - profile[index]) ** 2, 0)) / Math.sqrt(6 * 12 ** 2)) * 100);
}

export function calculateResult(answers) {
  const vector = scoreAnswers(answers);
  const ranked = rankCharacters(vector);
  return {
    version: CONTENT_VERSION,
    id: crypto.randomUUID(),
    personId: ranked[0].person.id,
    bands: vector.map(scoreBand),
    vector,
    matchPercent: matchPercentFor(vector, ranked[0].person.profile),
    createdAt: Date.now(),
    tied: ranked[0].distance === ranked[1].distance,
  };
}

if (questionData.version !== CONTENT_VERSION || characters.length !== 100 || questions.length !== 24) throw new Error("TEST_CONTENT_VERSION_INVALID");
