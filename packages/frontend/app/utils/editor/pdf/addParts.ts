import type jsPDF from 'jspdf';
import type { User } from '../../user';
import { formatEducationString } from '../formatters/education';
import { formatInfoString } from '../formatters/info';

const DEFAULT_LEFT_MARGIN = 14;
const DEFAULT_RIGHT_MARGIN = 14;

/**
 * Adds the user info (name and contact details) to the PDF.
 * Returns the updated vertical position.
 */
export function addUserInfo(
  doc: jsPDF,
  userData: User,
  defaultFont: string,
  defaultFontSize: number,
): number {
  let yPosition = 20;
  if (userData.info) {
    // Name as header
    doc.setFont(defaultFont, 'bold');
    const name = `${userData.info.firstName} ${userData.info.lastName}`;
    const nameWidth =
      (doc.getStringUnitWidth(name) * doc.getFontSize()) /
      doc.internal.scaleFactor;
    const nameX = (doc.internal.pageSize.width - nameWidth) / 2;
    doc.text(name, nameX, yPosition);

    // Contact info
    doc.setFontSize(defaultFontSize);
    doc.setFont(defaultFont, 'normal');
    const contactInfo = formatInfoString(userData.info);
    const contactWidth =
      (doc.getStringUnitWidth(contactInfo) * doc.getFontSize()) /
      doc.internal.scaleFactor;
    const contactX = (doc.internal.pageSize.width - contactWidth) / 2;
    doc.text(contactInfo, contactX, yPosition + 8);

    yPosition += 20;
  }
  return yPosition;
}

/**
 * Adds the summary section to the PDF.
 */
export function addSummary(
  doc: jsPDF,
  userData: User,
  yPosition: number,
  defaultFont: string,
  defaultFontSize: number,
): number {
  if (userData?.summary?.summary) {
    doc.setFontSize(14);
    doc.setFont(defaultFont, 'bold');
    doc.text('SUMMARY', 14, yPosition);
    yPosition += 7;

    doc.setFontSize(defaultFontSize);
    doc.setFont(defaultFont, 'normal');

    // Wrap the summary text to a maximum width of 180 units.
    const splitSummary = doc.splitTextToSize(userData.summary.summary, 180);
    doc.text(splitSummary, 14, yPosition);
    yPosition += splitSummary.length * 5 + 10;
  }
  return yPosition;
}

/**
 * Adds the skills section to the PDF.
 */
export function addSkills(
  doc: jsPDF,
  userData: User,
  yPosition: number,
  defaultFont: string,
  defaultFontSize: number,
): number {
  if (userData.skills) {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont(defaultFont, 'bold');
    doc.text('SKILLS', 14, yPosition);
    yPosition += 7;

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
      yPosition += splitSkills.length * 5 + 10;
    }
  }
  return yPosition;
}

/**
 * Adds the experience section to the PDF.
 */
export function addExperience(
  doc: jsPDF,
  userData: User,
  yPosition: number,
  defaultFont: string,
  defaultFontSize: number,
): number {
  if (userData.experience && userData.experience.length > 0) {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont(defaultFont, 'bold');
    doc.text('EXPERIENCE', 14, yPosition);
    yPosition += 7;

    for (const job of userData.experience) {
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

          // Add bullet point and handle text wrapping for details.
          doc.text('\u2022', 14, yPosition);
          const splitDetail = doc.splitTextToSize(detail, 180);
          doc.text(splitDetail, 20, yPosition);
          yPosition += splitDetail.length * 5 + 2;
        }
      }
      yPosition += 8;
    }
  }
  return yPosition;
}

/**
 * Adds the education section to the PDF.
 */
export function addEducation(
  doc: jsPDF,
  userData: User,
  yPosition: number,
  defaultFont: string,
  defaultFontSize: number,
): number {
  if (userData.education) {
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(14);
    doc.setFont(defaultFont, 'bold');
    doc.text('EDUCATION', DEFAULT_LEFT_MARGIN, yPosition);
    yPosition += 7;

    doc.setFont(defaultFont, 'normal');
    doc.setFontSize(defaultFontSize);
    const { degreeSection, location, graduationInfo } = formatEducationString(
      userData.education,
    );

    const rightTextWidth = doc.getTextWidth(graduationInfo);
    doc.text(degreeSection, DEFAULT_LEFT_MARGIN, yPosition);

    const rightTextX =
      doc.internal.pageSize.getWidth() - DEFAULT_RIGHT_MARGIN - rightTextWidth;

    doc.setFont(defaultFont, 'normal');
    doc.text(graduationInfo, rightTextX, yPosition);
    yPosition += 6;

    doc.setFont(defaultFont, 'italic');
    doc.setFontSize(10);
    doc.text(location, DEFAULT_LEFT_MARGIN, yPosition);
    if (yPosition > 280) {
      doc.addPage();
      yPosition = 20;
    }
  }
  return yPosition;
}
