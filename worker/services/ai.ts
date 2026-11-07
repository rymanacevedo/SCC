import {
  generateText,
  type LanguageModelUsage,
  type LanguageModel,
  NoObjectGeneratedError,
  Output,
  type OutputInterface,
} from 'ai';
import { z } from 'zod';
import {
  BoundedExperienceSchema,
  BoundedSkillsSchema,
  BoundedSummarySchema,
  ExperienceSchema,
  SkillsSchema,
  SummarySchema,
} from '../../shared/schemas/generation.ts';
import { withDeadline } from '../lib/deadline.ts';

/**
 * Longest a section generator may run, retries and backoff included. A
 * reasoning model answers a section in well under this; past it the user is
 * better served by a 504 they can retry than by an open request.
 */
export const SECTION_GENERATION_DEADLINE_MS = 45_000;

/**
 * One retry absorbs a transient 429 or 5xx. More would spend the deadline on
 * backoff and multiply the cost of a struggling provider.
 */
export const SECTION_GENERATION_MAX_RETRIES = 1;

/**
 * Output-token limits per section. The default model reasons, and reasoning
 * tokens count against the limit, so each sits well above its visible JSON:
 * summaries are 3-5 sentences per job, possibly several jobs; skills and
 * experience are two short string lists, experience bullets being longer.
 */
export const SECTION_MAX_OUTPUT_TOKENS = {
  summaries: 6000,
  skills: 3000,
  experience: 4000,
} as const;

/**
 * A section generator's model stopped at its output-token limit, so it gave
 * no usable output: JSON cut short, or no text at all when a reasoning model
 * spent the whole budget thinking.
 */
// Listed in KNOWN_ERROR_NAMES (shared/telemetryRedaction.ts); an unlisted name is reported as `Error`.
export class SectionTokenLimitError extends Error {
  readonly maxOutputTokens: number;
  readonly outputTokens: number | undefined;

  constructor(
    maxOutputTokens: number,
    outputTokens: number | undefined,
    cause: unknown,
  ) {
    super(
      `Section generation stopped at its ${maxOutputTokens}-token output limit.`,
      { cause },
    );
    this.name = 'SectionTokenLimitError';
    this.maxOutputTokens = maxOutputTokens;
    this.outputTokens = outputTokens;
  }
}

/** The one bounded model call every section generator makes. */
async function generateSection<OUTPUT>({
  prompt,
  model,
  abortSignal,
  output,
  instructions,
  maxOutputTokens,
}: {
  prompt: string;
  model: LanguageModel;
  abortSignal?: AbortSignal;
  output: OutputInterface<OUTPUT>;
  instructions: string;
  maxOutputTokens: number;
}): Promise<OUTPUT> {
  return withDeadline(
    {
      upstream: 'provider',
      timeoutMs: SECTION_GENERATION_DEADLINE_MS,
      signal: abortSignal,
    },
    async (signal) => {
      const tokenLimit = (
        usage: LanguageModelUsage | undefined,
        cause: unknown,
      ) =>
        new SectionTokenLimitError(maxOutputTokens, usage?.outputTokens, cause);
      let result;
      try {
        result = await generateText({
          model,
          abortSignal: signal,
          maxRetries: SECTION_GENERATION_MAX_RETRIES,
          maxOutputTokens,
          output,
          prompt,
          instructions,
        });
      } catch (error) {
        // Text cut short at the limit fails to parse inside generateText.
        if (
          NoObjectGeneratedError.isInstance(error) &&
          error.finishReason === 'length'
        ) {
          throw tokenLimit(error.usage, error);
        }
        throw error;
      }
      // Stopping at the limit with no text at all skips parsing, and reading
      // `output` throws. Output that parsed and validated is complete: use it.
      if (result.finishReason === 'length') {
        try {
          return result.output;
        } catch (error) {
          throw tokenLimit(result.usage, error);
        }
      }
      return result.output;
    },
  );
}

/** A section generator's result has an array or string over its limit. */
// Listed in KNOWN_ERROR_NAMES (shared/telemetryRedaction.ts); an unlisted name is reported as `Error`.
export class GeneratedOutputLimitError extends Error {
  constructor() {
    super('Generated output exceeds its limits.');
    this.name = 'GeneratedOutputLimitError';
  }
}

/**
 * Returns a section generator's result, or throws if it fails the bounded
 * schema for that generator (the Generated output limits). Each generator
 * applies its own, so a result never leaves unbounded.
 */
function boundGeneratedOutput<T>(schema: z.core.$ZodType, output: T): T {
  if (!z.safeParse(schema, output).success)
    throw new GeneratedOutputLimitError();
  return output;
}

const Blacklist =
  'Blacklist these role and give general experience advice: Sex Worker, Porn Star, Adult Film Actor/Actress, Escort, Cam Model, Stripper, Exotic Dancer, Erotic Dancer, Pornographic Content Creator, Explicit Performer, Performer of Explicit Content, Shit Talker, OnlyFans Model, Fansly Model, Porn Addict, Terrorist, Extremist, Jihadist, Bomber, Assassin, Violent Extremist, Hate Crime Inciter, Radicalizer, or Domestic Terrorist.' as const;

export const createSummaries = async (
  prompt: string,
  model: LanguageModel,
  abortSignal?: AbortSignal,
) => {
  const output = await generateSection({
    model,
    abortSignal,
    maxOutputTokens: SECTION_MAX_OUTPUT_TOKENS.summaries,
    output: Output.object({
      schema: z.object({
        summaries: SummarySchema,
      }),
    }),
    prompt,
    instructions: `
        <example1>
        <title>Software Developer</title>
        <text>Results-driven software developer with 5 years of experience building web applications. Proficient in JavaScript, React, and Node.js. Strong problem-solving abilities and experience working in agile environments.
        </text>
        </example1>
        <example2>
        <title>Project Manager</title>
        <text>
        Certified project manager with proven track record of delivering complex projects on time and within budget. Skilled in stakeholder management and agile methodologies.
        </text>
        </example2>
        <example3>
        <title>Marketing Specialist</title>
        <text>
        Creative marketing professional with expertise in digital marketing campaigns and social media strategy. Track record of increasing engagement and driving conversion rates.
        </text>
        </example3>
        <example4>
        <title>Strategic Account Manager</title>
        <text>
        Exceeded annual account growth quota by 457% (#1 in my department), responsible for 80% of department-wide upselling in Q4 of 2014
        </text>
        </example4>
  
        You are helping me write professional summaries for a user who submitted their job title, employer, and job details.
  
        I've give you a string that formatted like such for each job:
        <job>
          <jobTitle></jobTitle>
          <employer></employer>
          <details></details>
        </job>
  
        When I give you the jobs, return the summaries as an array wrapped in a 'summaries' object.
        Be as specific as possible.
        ${Blacklist}
        Use your best judgement if given a term that doesn't look like a job, just send back general professional summary.
      `,
  });

  return boundGeneratedOutput(BoundedSummarySchema, output.summaries);
};

export const createSkills = async (
  prompt: string,
  model: LanguageModel,
  abortSignal?: AbortSignal,
) => {
  const output = await generateSection({
    model,
    abortSignal,
    maxOutputTokens: SECTION_MAX_OUTPUT_TOKENS.skills,
    output: Output.object({
      schema: SkillsSchema,
    }),
    prompt,
    instructions: `
          You are helping gather soft skills for a user who submitted their job title, employer, and job details.
          I've give you a string that formatted jobs like such:
          <job>
            <jobTitle></jobTitle>
            <employer></employer>
            <details></details>
          </job>
          When I give you the jobs, return the skills as a json object.
          Be as specific as possible.
          ${Blacklist}
          Use your best judgement if given a term that doesn't look like a job, just send back general skills.
          `,
  });

  return boundGeneratedOutput(BoundedSkillsSchema, output);
};

export const createExperience = async (
  prompt: string,
  model: LanguageModel,
  abortSignal?: AbortSignal,
) => {
  const output = await generateSection({
    model,
    abortSignal,
    maxOutputTokens: SECTION_MAX_OUTPUT_TOKENS.experience,
    output: Output.object({
      schema: ExperienceSchema,
    }),
    prompt,
    instructions: `
    <example1>
    Drove $15M of new partnership business in 12 months for marketing-focused SaaS software.
    </example1> 
    <example2> 
    Spearheaded new training protocols to reduce new hire onboarding by 15%.
    </example2>
    <anatomy>
    Hard and soft skills Target 35%
    Action Words Target Target 15%
    Measurable Results Target 15%
    Common Words Target 35%
    </anatomy>
    You are helping gather example experience for a specific job.
    Above are some good examples of how a good bullet for a job might look like.
    There's also an anatomy of how to a bullet for experience might be phrased.
    When I give you the title, return the experiences in a json object. 
    Be as specific as possible.
    ${Blacklist}
    Use your best judgement if someone gives a term that doesn't look like a job, just send back general experience like soft skills.
    `,
  });
  return boundGeneratedOutput(BoundedExperienceSchema, output);
};
