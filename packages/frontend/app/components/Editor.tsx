import { memo, useEffect } from 'react';
import {
  $getRoot,
  $getSelection,
  $createParagraphNode,
  $createTextNode,
} from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import type { User } from '../utils/user';
import useEffectOnce from '../hooks/useEffectOnce';

const theme = {};

function onError(error: unknown) {
  console.error(error);
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

// Helper function to populate the editor with user data
function populateEditorWithUserData(root: any, userData: User) {
  // Clear any existing content
  root.clear();

  // Add user info
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

  // Add summary
  if (userData?.summary?.summary) {
    const summaryTitleNode = $createParagraphNode();
    summaryTitleNode.append($createTextNode('SUMMARY'));
    root.append(summaryTitleNode);

    const summaryNode = $createParagraphNode();
    summaryNode.append($createTextNode(userData.summary.summary));
    root.append(summaryNode);
  }

  // Add experience
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
      const startDate = new Date(job.startDate).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      const endDate = job.currentlyEmployed
        ? 'Present'
        : new Date(job.endDate).toLocaleDateString('en-US', {
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

  // Add education
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
      : new Date(userData.education.graduationDate).toLocaleDateString(
          'en-US',
          {
            month: 'long',
            year: 'numeric',
          },
        );
    gradDateNode.append($createTextNode(`Graduation: ${gradDate}`));
    root.append(gradDateNode);
  }

  // Add skills
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

interface EditorProps {
  user: User;
}

function Editor({ user }: EditorProps) {
  const initialConfig = {
    namespace: 'MyEditor',
    theme,
    onError,
  };

  return (
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
    </LexicalComposer>
  );
}

export default Editor;
