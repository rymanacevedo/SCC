import { memo, useEffect, useRef } from 'react';
import { $getRoot } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import type { User } from '../utils/user';
import Button from './Button';
import Main from './Main';
import theme from '../utils/editor/theme';
import {
  exportToPDF,
  exportToWord,
  populateEditorWithUserData,
} from '../utils/editor/functions';
import { HeadingNode } from '@lexical/rich-text';
import { CustomParagraphNode } from '../utils/editor/custom/CustomParagraphNode';

function onError(error: unknown) {
  console.error(error);
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
    nodes: [HeadingNode, CustomParagraphNode],
  };

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
        populateEditorWithUserData(root, user);
      });
    }, [editor, user]);

    return null;
  }

  const handleExportWordClick = () => {
    if (editorRef.current) {
      exportToWord(editorRef.current, user);
    }
  };
  const handleExportClick = () => {
    if (editorRef.current) {
      exportToPDF(editorRef.current, user);
    }
  };

  return (
    <Main>
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
      <div className="flex justify-around mt-4">
        <Button
          type="primary"
          action="button"
          text="Generate Word Resume"
          callback={handleExportWordClick}
        />
        <Button
          type="primary"
          action="button"
          text="Generate PDF Resume"
          callback={handleExportClick}
        />
      </div>
    </Main>
  );
}

export default memo(Editor);
