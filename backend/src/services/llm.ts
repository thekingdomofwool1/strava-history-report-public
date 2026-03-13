import OpenAI from 'openai';
import type { ResponseOutputItem, ResponseOutputMessage, ResponseOutputText } from 'openai/resources/responses/responses';
import { config } from '../config';
import { SelectedPlace } from './places';

const client = new OpenAI({ apiKey: config.openai.apiKey });

const MONUMENT_TERMS = ['statue', 'monument', 'memorial', 'obelisk', 'sculpture'];

const isMonumentOrStatue = (place: SelectedPlace): boolean => {
  const name = place.name.toLowerCase();
  const types = place.types?.join(' ').toLowerCase() ?? '';
  return MONUMENT_TERMS.some((t) => name.includes(t) || types.includes(t));
};

export const craftHistoricalBlurb = async (place: SelectedPlace, activityName: string) => {
  const focusHint = isMonumentOrStatue(place)
    ? 'This is a statue, monument, or memorial — focus on who or what it depicts, when it was erected, and by whom if known.'
    : 'Focus on the site\'s founding, designer, opening date, or a notable historical event associated with it.';

  const prompt = `Write one concise factual sentence (<= 35 words) about a place passed during an activity.
Use only the provided data, avoid embellishment. ${focusHint}
Format similar to "On today's activity I passed ${place.name}, ...".

Place JSON:
${JSON.stringify({
    name: place.name,
    vicinity: place.vicinity,
    types: place.types,
    notes: place.notes
  })}

Activity name: ${activityName}`;

  const completion = await client.responses.create({
    model: config.openai.model,
    input: prompt,
    max_output_tokens: 60
  });

  const text = completion.output?.find(isResponseOutputMessage)?.content.find(isResponseOutputText);
  if (text) {
    return text.text.trim();
  }

  const fallback = completion.output_text?.[0];
  if (typeof fallback === 'string') {
    return fallback.trim();
  }

  return `You ran past ${place.name}, a historic spot worth revisiting soon.`;
};

const isResponseOutputMessage = (item: ResponseOutputItem): item is ResponseOutputMessage => item.type === 'message';

const isResponseOutputText = (part: ResponseOutputMessage['content'][number]): part is ResponseOutputText =>
  part.type === 'output_text';
