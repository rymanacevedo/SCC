import {
  Packer,
  Paragraph,
  HeadingLevel,
  AlignmentType,
  TextRun,
  Document,
} from 'docx';
import jsPDF from 'jspdf';
import { $createParagraphNode, $createTextNode } from 'lexical';
import { $createHeadingNode } from '@lexical/rich-text';
import type { User } from '../user';

import fileSaver from 'file-saver';
import { $createCustomParagraphNode } from './custom/CustomParagraphNode';
const { saveAs } = fileSaver;

// For building the editor
export function populateEditorWithUserData(root: any, userData: User) {
  root.clear();

  if (userData.info) {
    const nameNode = $createHeadingNode('h1');
    nameNode.append(
      $createTextNode(`${userData.info.firstName} ${userData.info.lastName}`),
    );
    root.append(nameNode);

    const contactNode = $createCustomParagraphNode('text-center');
    contactNode.append(
      $createTextNode(
        `${userData.info.email} | ${userData.info.phone} | ${userData.info.city}, ${userData.info.state} ${userData.info.zipCode}`,
      ),
    );
    root.append(contactNode);
  }

  if (userData?.summary?.summary) {
    const summaryTitleNode = $createHeadingNode('h2');
    summaryTitleNode.append($createTextNode('SUMMARY'));
    root.append(summaryTitleNode);

    const summaryNode = $createParagraphNode();
    summaryNode.append($createTextNode(userData.summary.summary));
    root.append(summaryNode);
  }

  if (userData.experience && userData.experience.length > 0) {
    const experienceTitleNode = $createHeadingNode('h2');
    experienceTitleNode.append($createTextNode('EXPERIENCE'));
    root.append(experienceTitleNode);

    for (const job of userData.experience) {
      const jobTitleNode = $createHeadingNode('h3');
      jobTitleNode.append(
        $createTextNode(`${job.jobTitle} | ${job.employer} | ${job.location}`),
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
      dateNode.append($createTextNode(`${startDate} - ${endDate}`));
      root.append(dateNode);

      if (job.details && job.details.length > 0) {
        for (const detail of job.details) {
          const detailNode = $createParagraphNode();
          detailNode.append($createTextNode(`• ${detail}`));
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
      $createTextNode(
        `${userData.education.degree}, ${userData.education.educationLevel} | ${userData.education.schoolName} | ${userData.education.location}`,
      ),
    );
    root.append(educationNode);

    const gradDateNode = $createParagraphNode();
    const gradDate = userData.education.currentlyEnrolled
      ? 'Currently Enrolled'
      : userData.education.graduationDate?.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
    gradDateNode.append($createTextNode(`Graduation: ${gradDate}`));
    root.append(gradDateNode);
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
      skillsNode.append($createTextNode(allSkills.join(', ')));
      root.append(skillsNode);
    }
  }
}

// Generate docx elements directly from user data
function generateDocxElements(userData: User) {
  const elements = [];

  // Header with name
  if (userData.info) {
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
        children: [
          new TextRun(
            `${userData.info.email} | ${userData.info.phone} | ${userData.info.city}, ${userData.info.state} ${userData.info.zipCode}`,
          ),
        ],
      }),
    );

    // Separator
    elements.push(new Paragraph({ text: '' }));
  }

  // Summary section
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

  // Experience section
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
              text: `${detail}`,
              bullet: {
                level: 0,
              },
            }),
          );
        }
      }

      elements.push(new Paragraph({ text: '' }));
    }
  }

  // Education section
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
        text: `${userData.education.degree}, ${userData.education.educationLevel} | ${userData.education.schoolName} | ${userData.education.location}`,
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

  // Skills section
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
  }

  return elements;
}

export async function exportToWord(editor: any, userData: User) {
  // Create document sections directly from user data
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

  // Generate and save the document
  Packer.toBlob(doc).then((blob) => {
    saveAs(
      blob,
      `${userData.info?.firstName || 'resume'}_${userData.info?.lastName || ''}_resume.docx`,
    );
  });
}

export function exportToPDF(
  editor: any,
  userData: User,
  defaultFontSize = 12,
  defaultFont = 'helvetica',
) {
  const doc = new jsPDF();
  // Set font size and type
  doc.setFontSize(22);
  // Add user info
  if (userData.info) {
    // Name as header
    doc.setFont(defaultFont, 'bold');
    const name = `${userData.info.firstName} ${userData.info.lastName}`;
    const nameWidth =
      (doc.getStringUnitWidth(name) * doc.getFontSize()) /
      doc.internal.scaleFactor;
    const nameX = (doc.internal.pageSize.width - nameWidth) / 2;
    doc.text(name, nameX, 20);

    // Contact info
    doc.setFontSize(defaultFontSize);
    doc.setFont(defaultFont, 'normal');
    const contactInfo = `${userData.info.email} | ${userData.info.phone} | ${userData.info.city}, ${userData.info.state} ${userData.info.zipCode}`;
    const contactWidth =
      (doc.getStringUnitWidth(contactInfo) * doc.getFontSize()) /
      doc.internal.scaleFactor;
    const contactX = (doc.internal.pageSize.width - contactWidth) / 2;
    doc.text(contactInfo, contactX, 28);
  }

  let yPosition = 40;

  // Add summary
  if (userData?.summary?.summary) {
    doc.setFontSize(14);
    doc.setFont(defaultFont, 'bold');
    doc.text('SUMMARY', 14, yPosition);
    yPosition += 7;

    // Add line under section header
    // doc.setDrawColor(0);
    // doc.line(14, yPosition - 2, 196, yPosition - 2);

    doc.setFontSize(defaultFontSize);
    doc.setFont(defaultFont, 'normal');

    // Handle text wrapping for summary
    const splitSummary = doc.splitTextToSize(userData.summary.summary, 180);
    doc.text(splitSummary, 14, yPosition);
    yPosition += splitSummary.length * 5 + 10;
  }

  // Add experience
  if (userData.experience && userData.experience.length > 0) {
    doc.setFontSize(14);
    doc.setFont(defaultFont, 'bold');
    doc.text('EXPERIENCE', 14, yPosition);
    yPosition += 7;

    // Add line under section header
    // doc.setDrawColor(0);
    // doc.line(14, yPosition - 2, 196, yPosition - 2);

    for (const job of userData.experience) {
      // Check if we need a new page
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(12);
      doc.setFont(defaultFont, 'bold');
      doc.text(
        `${job.jobTitle} | ${job.employer} | ${job.location}`,
        14,
        yPosition,
      );
      yPosition += 6;

      doc.setFontSize(defaultFontSize);
      doc.setFont(defaultFont, 'italic');
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
      doc.text(`${startDate} - ${endDate}`, 14, yPosition);
      yPosition += 6;

      if (job.details && job.details.length > 0) {
        doc.setFont(defaultFont, 'normal');
        for (const detail of job.details) {
          // Check if we need a new page
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }

          // Add bullet point
          doc.text('\u2022', 14, yPosition);
          // Handle text wrapping for details
          const splitDetail = doc.splitTextToSize(detail, 180);
          doc.text(splitDetail, 20, yPosition);
          yPosition += splitDetail.length * 5 + 2;
        }
      }

      yPosition += 8;
    }
  }

  // Add education
  if (userData.education) {
    // Check if we need a new page
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont(defaultFont, 'bold');
    doc.text('EDUCATION', 14, yPosition);
    yPosition += 7;

    // Add line under section header
    // doc.setDrawColor(0);
    // doc.line(14, yPosition - 2, 196, yPosition - 2);

    doc.setFontSize(defaultFontSize);
    doc.text(
      `${userData.education.degree}, ${userData.education.educationLevel} | ${userData.education.schoolName} | ${userData.education.location}`,
      14,
      yPosition,
    );
    yPosition += 6;

    doc.setFontSize(defaultFontSize);
    doc.setFont(defaultFont, 'italic');
    const gradDate = userData.education.currentlyEnrolled
      ? 'Currently Enrolled'
      : userData.education.graduationDate?.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        });
    doc.text(`Graduation: ${gradDate}`, 14, yPosition);
    yPosition += 10;
  }

  // Add skills
  if (userData.skills) {
    // Check if we need a new page
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont(defaultFont, 'bold');
    doc.text('SKILLS', 14, yPosition);
    yPosition += 7;

    // Add line under section header
    // doc.setDrawColor(0);
    // doc.line(14, yPosition - 2, 196, yPosition - 2);

    const allSkills = [
      ...(userData.skills.expertRecommended || []),
      ...(userData.skills.other || []),
    ];

    if (allSkills.length > 0) {
      doc.setFontSize(defaultFontSize);
      doc.setFont(defaultFont, 'normal');

      // Handle text wrapping for skills
      const skillsText = allSkills.join(', ');
      const splitSkills = doc.splitTextToSize(skillsText, 180);
      doc.text(splitSkills, 14, yPosition);
    }
  }

  // Save the PDF
  doc.save(
    `${userData.info?.firstName || 'resume'}_${userData.info?.lastName || ''}_resume.pdf`,
  );
}
