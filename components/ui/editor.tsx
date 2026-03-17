"use client";

import { EditorContent, EditorRoot, EditorInstance, EditorBubble } from "novel";
import { defaultExtensions } from "./extensions";
import { useState, useEffect, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { NodeSelector } from "./selectors/node-selector";
import { LinkSelector } from "./selectors/link-selector";
import { ColorSelector } from "./selectors/color-selector";
import { TextButtons } from "./selectors/text-buttons";

interface EditorProps {
  initialValue?: any;
  onChange?: (value: any, id: string) => void;
  onReady?: (editor: EditorInstance) => void;
  className?: string;
  placeholder?: string;
  editable?: boolean;
  id: string;
}

export function Editor({ initialValue, onChange, onReady, className, placeholder, editable = true, id }: EditorProps) {
  const [editor, setEditor] = useState<EditorInstance | null>(null);
  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openLink, setOpenLink] = useState(false);

  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncedValue = useRef<any>(initialValue || null);
  const prevId = useRef<string>(id);

  // Synchronize internal state with initialValue prop changes (e.g. lesson switch or AI generation)
  useEffect(() => {
    const isIdSwitch = id !== prevId.current;

    // ONLY sync if:
    // 1. The ID has changed (lesson switch) - ALWAYS sync on switch.
    // 2. The prop value is actually different from our last synced state (e.g. AI generation).
    if (isIdSwitch || (initialValue !== undefined && initialValue !== lastSyncedValue.current)) {
      console.log("[UI Editor] syncing trigger. ID change:", isIdSwitch, "New length:", (initialValue || "").length);

      // No more debounce to cancel here

      setIsSyncing(true);
      lastSyncedValue.current = initialValue;
      prevId.current = id;
      if (editor) {
        console.log("[UI Editor] resetting editor content for ID:", id);
        editor.commands.setContent(initialValue, false);
      }

      // Reset syncing flag after a window to catch immediate transition pings
      const timer = setTimeout(() => {
        setIsSyncing(false);
        console.log("[UI Editor] sync guard released for ID:", id);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [initialValue, editor, id]);


  return (
    <div className={className}>
      <EditorRoot>
        <EditorContent
          initialContent={initialValue}
          extensions={defaultExtensions}
          onUpdate={({ editor }) => {
            if (isSyncing) {
              console.log("[UI Editor] isSyncing is true, suppressing onChange");
              return;
            }
            const html = editor.getHTML();
            console.log("[UI Editor] Instant onChange for ID:", id, "(length):", html.length);

            // Mark this value as synced so the prop-sync useEffect doesn't try to "re-sync" it back to us
            lastSyncedValue.current = html;
            if (onChange) onChange(html, id);
          }}
          onCreate={({ editor }) => {
            setEditor(editor);
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
