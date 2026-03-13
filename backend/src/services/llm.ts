import OpenAI from 'openai';
import type { ResponseOutputItem, ResponseOutputMessage, ResponseOutputText } from 'openai/resources/responses/responses';
import { config } from '../config';
import { SelectedPlace } from './places';

const client = new OpenAI({ apiKey: config.openai.apiKey });

export const craftHistoricalBlurb = async (place: SelectedPlace, activityName: string) => {
  const prompt = `Write one concise factual sentence (<= 35 words) describing a historical site, park, or trail passed during a run.
Use only the provided data, avoid embellishment, and prefer concrete facts like founders, designers, openings, or notable events.
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
    max_output_tokens: 120
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
