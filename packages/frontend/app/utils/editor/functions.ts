import { Packer, Document } from 'docx';
import { $createParagraphNode, $createTextNode } from 'lexical';
import { $createHeadingNode } from '@lexical/rich-text';
import type { User } from '../user';

import fileSaver from 'file-saver';
import { $createCustomParagraphNode } from './custom/CustomParagraphNode';
const { saveAs } = fileSaver;
import DOMPurify from 'dompurify';
import jsPDF from 'jspdf';
import {
  addUserInfo,
  addSummary,
  addSkills,
  addExperience,
  addEducation,
} from './pdf/addParts';
import { generateDocxElements } from './word/addParts';
import { formatEducationString } from './formatters/education';
import { formatInfoString } from './formatters/info';

/**
 * Use DOMPurify to sanitize the input text.
 * We disallow all HTML elements by setting ALLOWED_TAGS to [].
 */
function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

/**
 * Populates the Lexical editor with user data using sanitized text.
 */
export function populateEditorWithUserData(root: any, userData: User) {
  root.clear();

  if (userData.info) {
    const nameNode = $createHeadingNode('h1');
    nameNode.append(
      $createTextNode(
        sanitizeText(`${userData.info.firstName} ${userData.info.lastName}`),
      ),
    );
    root.append(nameNode);

    const contactNode = $createCustomParagraphNode('text-center');
    contactNode.append(
      $createTextNode(sanitizeText(formatInfoString(userData.info))),
    );
    root.append(contactNode);
  }

  if (userData?.summary?.summary) {
    const summaryTitleNode = $createHeadingNode('h2');
    summaryTitleNode.append($createTextNode('SUMMARY'));
    root.append(summaryTitleNode);

    const summaryNode = $createParagraphNode();
    summaryNode.append($createTextNode(sanitizeText(userData.summary.summary)));
    root.append(summaryNode);
  }

  if (userData.skills) {
    const skillsTitleNode = $createHeadingNode('h2');
    skillsTitleNode.append($createTextNode('SKILLS'));
    root.append(skillsTitleNode);

    const allSkills = [
      ...(userData.skills.expertRecommended || []),
      ...(userData.skills.other || []),
    ];

    if (allSkills.length > 0) {
      const skillsNode = $createParagraphNode();
      skillsNode.append($createTextNode(sanitizeText(allSkills.join(', '))));
      root.append(skillsNode);
    }
  }

  if (userData.experience && userData.experience.length > 0) {
    const experienceTitleNode = $createHeadingNode('h2');
    experienceTitleNode.append($createTextNode('EXPERIENCE'));
    root.append(experienceTitleNode);

    for (const job of userData.experience) {
      const jobTitleNode = $createHeadingNode('h3');
      jobTitleNode.append(
        $createTextNode(
          sanitizeText(`${job.jobTitle} | ${job.employer} | ${job.location}`),
        ),
      );
      root.append(jobTitleNode);

      const dateNode = $createParagraphNode();
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
      dateNode.append(
        $createTextNode(sanitizeText(`${startDate} - ${endDate}`)),
      );
      root.append(dateNode);

      if (job.details && job.details.length > 0) {
        for (const detail of job.details) {
          const detailNode = $createParagraphNode();
          // Prefix with a bullet and then sanitize the detail content.
          detailNode.append($createTextNode(sanitizeText(`• ${detail}`)));
          root.append(detailNode);
        }
      }

      // Add a spacer between jobs
      root.append($createParagraphNode());
    }
  }

  if (userData.education) {
    const educationTitleNode = $createHeadingNode('h2');
    educationTitleNode.append($createTextNode('EDUCATION'));
    root.append(educationTitleNode);

    const educationNode = $createParagraphNode();
    educationNode.append(
      $createTextNode(sanitizeText(formatEducationString(userData.education))),
    );
    root.append(educationNode);

    const gradDateNode = $createParagraphNode();
    const gradDate = userData.education.currentlyEnrolled
      ? 'Currently Enrolled'
      : userData.education.graduationDate
    gradDateNode.append(
      $createTextNode(sanitizeText(`Graduation: ${gradDate}`)),
    );
    root.append(gradDateNode);
  }
}

/**
 * Creates and exports the Word document using the generated docx elements.
 */
export async function exportToWord(editor: any, userData: User) {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: generateDocxElements(userData),
      },
    ],
  });

  Packer.toBlob(doc).then((blob: Blob) => {
    saveAs(
      blob,
      `${userData.info?.firstName || 'resume'}_${userData.info?.lastName || ''
      }_resume.docx`
    );
  });
}

/**
 * The main function that generates the PDF by orchestrating the individual
 * sections defined above.
 */
export function exportToPDF(
  editor: any,
  userData: User,
  defaultFontSize = 12,
  defaultFont = 'helvetica',
) {
  const doc = new jsPDF();

  // Set the main header font size
  doc.setFontSize(22);

  // Build the PDF sections and track the vertical position (yPosition)
  let yPosition = addUserInfo(doc, userData, defaultFont, defaultFontSize);
  yPosition = addSummary(
    doc,
    userData,
    yPosition,
    defaultFont,
    defaultFontSize,
  );
  yPosition = addSkills(doc, userData, yPosition, defaultFont, defaultFontSize);
  yPosition = addExperience(
    doc,
    userData,
    yPosition,
    defaultFont,
    defaultFontSize,
  );
  yPosition = addEducation(
    doc,
    userData,
    yPosition,
    defaultFont,
    defaultFontSize,
  );

  // Save the PDF with a filename based on the user's name
  doc.save(
    `${userData.info?.firstName || 'resume'}_${userData.info?.lastName || ''
    }_resume.pdf`,
  );
}
