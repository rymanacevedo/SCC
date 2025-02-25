import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProvider,
} from '@ai-sdk/google';
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
const openai: OpenAIProvider = createOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  compatibility: 'strict',
});

const gemini: GoogleGenerativeAIProvider = createGoogleGenerativeAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

const OpenAIModel = openai('gpt-3.5-turbo');

const GeminiModel = gemini('gemini-2.0-flash-exp');

const Blacklist =
  'Blacklist these role and give general experience advice: Sex Worker, Porn Star, Adult Film Actor/Actress, Escort, Cam Model, Stripper, Exotic Dancer, Erotic Dancer, Pornographic Content Creator, Explicit Performer, Performer of Explicit Content, Shit Talker, OnlyFans Model, Fansly Model, Porn Addict, Terrorist, Extremist, Jihadist, Bomber, Assassin, Violent Extremist, Hate Crime Inciter, Radicalizer, or Domestic Terrorist.' as const;

const SkillsSchema = z.object({
  expertRecommended: z
    .array(z.string())
    .describe('The top 5 skills necessary for the job.'),
  other: z.array(
    z.string().describe('The other skills necessary for the job.'),
  ),
});

const ExperienceSchema = z.object({
  expertRecommended: z
    .array(z.string())
    .describe('The top 5 experience necessary for the job.'),
  other: z.array(
    z.string().describe('The other experience necessary for the job.'),
  ),
});

const SummarySchema = z
  .object({
    title: z.string().describe('The job description title.'),
    text: z
      .string()
      .describe(
        'A summary of the profession. This is roughly 3-4 sentences. No more then 5 sentences.',
      ),
  })
  .array();

export const createSummaries = async (prompt: string) => {
  const result = await generateObject({
    model: GeminiModel,
    schema: SummarySchema,
    schemaName: 'Summaries',
    prompt,
    system: `
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

      You are helping me write professional summaries for a user who submitted their job title, employer, and job details.

      I've give you a string that formatted like such:
      <job>
        <jobTitle></jobTitle>
        <employer></employer>
        <details></details>
      </job>

      When I give you the jobs, return the summaries as an array.
      Be as specific as possible.
      ${Blacklist}
      Use your best judgement if given a term that doesn't look like a job, just send back general professional summary.
    `,
  });

  return result.object;
};

export const createSkills = async (prompt: string) => {
  const result = await generateObject({
    model: GeminiModel,
    schema: SkillsSchema,
    schemaName: 'Skills',
    prompt,
    system: `
        You are helping gather soft skills for a user who submitted their job title, employer, and job details.
        I've give you a string that formatted like such:
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

  return result.object;
};

export const createExperience = async (prompt: string) => {
  const result = await generateObject({
    model: GeminiModel,
    schema: ExperienceSchema,
    prompt,
    system: `
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

  return result.object;
};
