import { Paragraph, HeadingLevel, AlignmentType, TextRun } from 'docx';
import fileSaver from 'file-saver';
import type { User } from '../../user';
import { formatEducationString } from '../formatters/education';
import { formatInfoString } from '../formatters/info';

/**
 * Generates the header section with the user's name and contact information.
 */
export function generateHeaderElements(userData: User) {
  const elements = [];
  if (userData.info) {
    // Header with name
    elements.push(
      new Paragraph({
        text: `${userData.info.firstName} ${userData.info.lastName}`,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
    );

    // Contact information
    elements.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun(formatInfoString(userData.info))],
      }),
    );

    // Separator
    elements.push(new Paragraph({ text: '' }));
  }
  return elements;
}

/**
 * Generates the summary section.
 */
function generateSummaryElements(userData: User) {
  const elements = [];
  if (userData?.summary?.summary) {
    elements.push(
      new Paragraph({
        text: 'SUMMARY',
        heading: HeadingLevel.HEADING_2,
        thematicBreak: true,
      }),
    );

    elements.push(
      new Paragraph({
        text: userData.summary.summary,
      }),
    );

    elements.push(new Paragraph({ text: '' }));
  }
  return elements;
}

/**
 * Generates the skills section.
 */
function generateSkillsElements(userData: User) {
  const elements = [];
  if (userData.skills) {
    elements.push(
      new Paragraph({
        text: 'SKILLS',
        heading: HeadingLevel.HEADING_2,
        thematicBreak: true,
      }),
    );

    const allSkills = [
      ...(userData.skills.expertRecommended || []),
      ...(userData.skills.other || []),
    ];

    if (allSkills.length > 0) {
      elements.push(
        new Paragraph({
          text: allSkills.join(', '),
        }),
      );
    }

    // Separator
    elements.push(new Paragraph({ text: '' }));
  }
  return elements;
}

/**
 * Generates the experience section.
 */
function generateExperienceElements(userData: User) {
  const elements = [];
  if (userData.experience && userData.experience.length > 0) {
    elements.push(
      new Paragraph({
        text: 'EXPERIENCE',
        heading: HeadingLevel.HEADING_2,
        thematicBreak: true,
      }),
    );

    for (const job of userData.experience) {
      elements.push(
        new Paragraph({
          text: `${job.jobTitle} | ${job.employer} | ${job.location}`,
          heading: HeadingLevel.HEADING_3,
        }),
      );

      const startDate = job.startDate?.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      const endDate = job.currentlyEmployed
        ? 'Present'
        : job.endDate?.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          });

      elements.push(
        new Paragraph({
          text: `${startDate} - ${endDate}`,
          italics: true,
        }),
      );

      if (job.details && job.details.length > 0) {
        for (const detail of job.details) {
          elements.push(
            new Paragraph({
              text: detail,
              bullet: { level: 0 },
            }),
          );
        }
      }

      // Separator between jobs
      elements.push(new Paragraph({ text: '' }));
    }
  }
  return elements;
}

/**
 * Generates the education section.
 */
export function generateEducationElements(userData: User) {
  const elements = [];
  if (userData.education) {
    elements.push(
      new Paragraph({
        text: 'EDUCATION',
        heading: HeadingLevel.HEADING_2,
        thematicBreak: true,
      }),
    );

    elements.push(
      new Paragraph({
        text: formatEducationString(userData.education),
        heading: HeadingLevel.HEADING_3,
      }),
    );

    const gradDate = userData.education.currentlyEnrolled
      ? 'Currently Enrolled'
      : userData.education.graduationDate?.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });

    elements.push(
      new Paragraph({
        text: `Graduation: ${gradDate}`,
        italics: true,
      }),
    );

    elements.push(new Paragraph({ text: '' }));
  }
  return elements;
}

/**
 * Combines all the individual docx elements into one array.
 */
export function generateDocxElements(userData: User) {
  return [
    ...generateHeaderElements(userData),
    ...generateSummaryElements(userData),
    ...generateSkillsElements(userData),
    ...generateExperienceElements(userData),
    ...generateEducationElements(userData),
  ];
}
