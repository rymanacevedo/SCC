import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HeadingNode } from '@lexical/rich-text';
import { $getRoot, type LexicalEditor } from 'lexical';
import { type RefObject, memo, useEffect, useRef } from 'react';
import { CustomParagraphNode } from '../utils/editor/custom/CustomParagraphNode';
import {
  exportToPDF,
  exportToWord,
  populateEditorWithUserData,
} from '../utils/editor/functions';
import theme from '../utils/editor/theme';
import type { User } from '../utils/user';
import Button from './Button';
import Main from './Main';

function onError(error: unknown) {
  console.error(error);
}

interface EditorProps {
  user: User;
}

function Editor({ user }: EditorProps) {
  const editorRef = useRef<LexicalEditor | null>(null);
  const initialConfig = {
    namespace: 'MyEditor',
    theme,
    onError,
    nodes: [HeadingNode, CustomParagraphNode],
  };

  // Plugin to store editor reference
  function EditorRefPlugin({
    editorRef,
  }: {
    editorRef: RefObject<LexicalEditor | null>;
  }) {
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
              placeholder={<div />}
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
