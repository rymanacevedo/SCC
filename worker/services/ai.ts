import { generateText, type LanguageModel, Output } from 'ai';
import { z } from 'zod';
import {
  ExperienceSchema,
  SkillsSchema,
  SummarySchema,
} from '../../shared/schemas/generation.ts';

const Blacklist =
  'Blacklist these role and give general experience advice: Sex Worker, Porn Star, Adult Film Actor/Actress, Escort, Cam Model, Stripper, Exotic Dancer, Erotic Dancer, Pornographic Content Creator, Explicit Performer, Performer of Explicit Content, Shit Talker, OnlyFans Model, Fansly Model, Porn Addict, Terrorist, Extremist, Jihadist, Bomber, Assassin, Violent Extremist, Hate Crime Inciter, Radicalizer, or Domestic Terrorist.' as const;

export const createSummaries = async (prompt: string, model: LanguageModel) => {
  const { output } = await generateText({
    model,
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

  return output.summaries;
};

export const createSkills = async (prompt: string, model: LanguageModel) => {
  const { output } = await generateText({
    model,
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

  return output;
};

export const createExperience = async (
  prompt: string,
  model: LanguageModel,
) => {
  const { output } = await generateText({
    model,
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
  return output;
};
