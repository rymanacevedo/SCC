import { Filter } from 'bad-words';
import { createContextKey, type Middleware } from 'remix/router';
import { z } from 'zod';
import type { GenerationRequest } from '../../shared/schemas/generation.ts';
import { readBoundedJson } from '../lib/body.ts';
import { apiError } from '../lib/response.ts';

export const sameOriginGuard: Middleware = ({ request }, next) => {
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return apiError(403, 'Access denied: cross-site request');
  }
  if (
    request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !==
    'application/json'
  ) {
    return apiError(415, 'Content-Type must be application/json');
  }
  return next();
};

export function createGeoRestrictionMiddleware({
  allowedCountries,
}: {
  allowedCountries: Iterable<string>;
}): Middleware {
  const allowed = new Set(
    [...allowedCountries].map((country) => country.trim().toUpperCase()),
  );
  return ({ request }, next) => {
    const country = request.cf?.country;
    const normalizedCountry =
      typeof country === 'string' ? country.trim().toUpperCase() : undefined;
    if (
      !normalizedCountry ||
      normalizedCountry === 'XX' ||
      !allowed.has(normalizedCountry)
    ) {
      // oxlint-disable-next-line no-console -- Guard refusals belong in Workers Logs.
      console.log({
        event: 'geo_blocked',
        category: 'geo_blocked',
        country: normalizedCountry,
        path: new URL(request.url).pathname,
        method: request.method,
        timestamp: new Date().toISOString(),
      });
      return apiError(403, 'Access denied: region not supported');
    }
    return next();
  };
}

export function bodyValidation<T>(schema: z.core.$ZodType<T>) {
  const key = createContextKey<T>();
  const middleware: Middleware = async (context, next) => {
    let body: Awaited<ReturnType<typeof readBoundedJson>>;
    try {
      body = await readBoundedJson(context.request);
    } catch {
      return apiError(400, 'Invalid JSON body', {
        formErrors: ['Invalid JSON body'],
        fieldErrors: {},
      });
    }
    if (!body.ok) return apiError(413, 'Request body too large');
    const parsed = z.safeParse(schema, body.value);
    if (!parsed.success)
      return apiError(
        400,
        'Invalid request body',
        z.flattenError(parsed.error),
      );
    context.set(key, parsed.data);
    return next();
  };
  return { key, middleware };
}

const filter = new Filter();
filter.addWords(
  'Sex Worker',
  'Porn Star',
  'Adult Film',
  'Escort',
  'Cam Model',
  'Stripper',
  'Exotic Dancer',
  'Erotic Dancer',
  'Pornographic Content Creator',
  'Explicit Performer',
  'Performer of Explicit Content',
  'Shit Talker',
  'OnlyFans',
  'Fansly',
  'Porn Addict',
  'Terrorist',
  'Extremist',
  'Jihadist',
  'Bomber',
  'Assassin',
  'Violent Extremist',
  'Hate Crime Inciter',
  'Radicalizer',
  'Domestic Terrorist',
);
// Compile the existing bad-words list once. Matching the full prompt also covers
// multi-word roles and terms inside the serialized XML, unlike splitting on spaces.
const escapeTerm = (term: string) => term.replace(/\W/g, '\\$&');
const terms = [...new Set(filter.list)]
  .sort((a, b) => b.length - a.length)
  .map((term) => ({
    term,
    pattern: new RegExp(`\\b${escapeTerm(term)}\\b`, 'i'),
  }));
// One alternation matches iff some per-term pattern matches, in a single scan of
// the prompt instead of one per term. Clean prompts, the common case, stop here;
// a hit falls back to the per-term scan so the named term stays the longest match.
const anyTerm = new RegExp(
  `\\b(?:${terms.map(({ term }) => escapeTerm(term)).join('|')})\\b`,
  'i',
);
export function createProfanityFilter(
  key: ReturnType<typeof bodyValidation<GenerationRequest>>['key'],
): Middleware {
  return (context, next) => {
    const prompt = context.get(key)?.prompt;
    if (prompt === undefined)
      throw new Error(
        'Profanity filter requires a validated Generation request',
      );
    const match = anyTerm.test(prompt)
      ? terms.find(({ pattern }) => pattern.test(prompt))
      : undefined;
    if (match) {
      // oxlint-disable-next-line no-console -- Guard refusals belong in Workers Logs.
      console.log({
        category: 'filtered',
        term: match.term,
        path: new URL(context.request.url).pathname,
      });
      return apiError(400, `Inappropriate term: ${match.term}`);
    }
    return next();
  };
}
