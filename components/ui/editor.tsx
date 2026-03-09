"use client";

import { EditorContent, EditorRoot, EditorInstance, EditorBubble } from "novel";
import { defaultExtensions } from "./extensions";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { NodeSelector } from "./selectors/node-selector";
import { LinkSelector } from "./selectors/link-selector";
import { ColorSelector } from "./selectors/color-selector";
import { TextButtons } from "./selectors/text-buttons";

interface EditorProps {
  initialValue?: any;
  onChange?: (value: any) => void;
  onReady?: (editor: EditorInstance) => void;
  className?: string;
  placeholder?: string;
  editable?: boolean;
}

export function Editor({ initialValue, onChange, onReady, className, placeholder, editable = true }: EditorProps) {
  const [content, setContent] = useState(initialValue || null);
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openLink, setOpenLink] = useState(false);

  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    const html = editor.getHTML();
    setContent(html);
    if (onChange) onChange(html);
  }, 500);

  return (
    <div className={className}>
      <EditorRoot>
        <EditorContent
          initialContent={content}
          extensions={defaultExtensions}
          onUpdate={({ editor }) => debouncedUpdates(editor)}
          onCreate={({ editor }) => {
            if (onReady) onReady(editor);
          }}
          editable={editable}
          editorProps={{
            attributes: {
              class: "prose dark:prose-invert prose-sm sm:prose-base focus:outline-none max-w-full",
            },
          }}
        >
          {editable && (
            <EditorBubble
              tippyOptions={{
                placement: "top",
              }}
              className='flex w-fit max-w-[90vw] overflow-hidden rounded border border-muted bg-background shadow-xl'>
              <NodeSelector open={openNode} onOpenChange={setOpenNode} />
              <LinkSelector open={openLink} onOpenChange={setOpenLink} />
              <TextButtons />
              <ColorSelector open={openColor} onOpenChange={setOpenColor} />
            </EditorBubble>
          )}
        </EditorContent>
      </EditorRoot>
    </div>
  );
}
