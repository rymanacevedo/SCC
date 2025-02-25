import { memo, useEffect, useRef } from 'react';
import { $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import type { User } from '../utils/user';
import Button from './Button';

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

// Fix the file-saver import
import fileSaver from 'file-saver';
const { saveAs } = fileSaver;

const theme = {};

function onError(error: unknown) {
  console.error(error);
}

// Plugin to store editor reference
function EditorRefPlugin({ editorRef }: { editorRef: React.RefObject<any> }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);

  return null;
}

function UserDataPlugin({ user }: { user: User }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Only run once on initial load
    editor.update(() => {
      const root = $getRoot();

      if (user && Object.keys(user).length > 0) {
        populateEditorWithUserData(root, user);
      } else {
        // Create a default paragraph if no data is available
        const paragraph = $createParagraphNode();
        paragraph.append(
          $createTextNode('Enter your resume information here...'),
        );
        root.append(paragraph);
      }
    });
  }, [editor, user]);

  return null;
}

function populateEditorWithUserData(root: any, userData: User) {
  root.clear();

  if (userData.info) {
    const nameNode = $createParagraphNode();
    nameNode.append(
      $createTextNode(`${userData.info.firstName} ${userData.info.lastName}`),
    );
    root.append(nameNode);

    const contactNode = $createParagraphNode();
    contactNode.append(
      $createTextNode(
        `${userData.info.email} | ${userData.info.phone} | ${userData.info.city}, ${userData.info.state} ${userData.info.zipCode}`,
      ),
    );
    root.append(contactNode);
  }

  if (userData?.summary?.summary) {
    const summaryTitleNode = $createParagraphNode();
    summaryTitleNode.append($createTextNode('SUMMARY'));
    root.append(summaryTitleNode);

    const summaryNode = $createParagraphNode();
    summaryNode.append($createTextNode(userData.summary.summary));
    root.append(summaryNode);
  }

  if (userData.experience && userData.experience.length > 0) {
    const experienceTitleNode = $createParagraphNode();
    experienceTitleNode.append($createTextNode('EXPERIENCE'));
    root.append(experienceTitleNode);

    for (const job of userData.experience) {
      const jobTitleNode = $createParagraphNode();
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
    const educationTitleNode = $createParagraphNode();
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
    const skillsTitleNode = $createParagraphNode();
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

async function exportToWord(editor: any, userData: User) {
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
          new TextRun(`${userData.info.email} | ${userData.info.phone}`),
          new TextRun({ text: '\n', break: 1 }),
          new TextRun(
            `${userData.info.city}, ${userData.info.state} ${userData.info.zipCode}`,
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
              text: `• ${detail}`,
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

interface EditorProps {
  user: User;
}

function Editor({ user }: EditorProps) {
  const editorRef = useRef<any>(null);
  const initialConfig = {
    namespace: 'MyEditor',
    theme,
    onError,
  };

  const handleExportClick = () => {
    if (editorRef.current) {
      exportToWord(editorRef.current, user);
    }
  };

  return (
    <>
      <LexicalComposer initialConfig={initialConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              aria-placeholder={'Enter some text...'}
              placeholder={<div>Enter some text...</div>}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <AutoFocusPlugin />
        <UserDataPlugin user={user} />
        <EditorRefPlugin editorRef={editorRef} />
      </LexicalComposer>
      <Button
        type="primary"
        action="button"
        text="Generate Resume"
        callback={handleExportClick}
      />
    </>
  );
}

export default memo(Editor);
