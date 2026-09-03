import { useCallback, useEffect, useRef } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';
import Typography from '@tiptap/extension-typography';

export interface EditorHandle {
  json: unknown;
  text: string;
}

const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer' } },
    codeBlock: { HTMLAttributes: { spellcheck: 'false' } },
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: true } }),
  Image.configure({ inline: false, HTMLAttributes: { class: 'doc-image' } }),
  Typography,
  Placeholder.configure({ placeholder: 'დაიწყე წერა… „/" კომანდები არაა საჭირო — უბრალოდ წერე.' }),
  CharacterCount,
];

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`etb__btn${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export function DocumentEditor({
  initialContent,
  onChange,
  onStats,
}: {
  initialContent: unknown;
  onChange: (json: unknown, text: string) => void;
  onStats?: (words: number, chars: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  const editor = useEditor({
    extensions,
    content: (initialContent as object) ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'ProseMirror doc-editor__content', spellcheck: 'true' },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON(), ed.getText());
      onStatsRef.current?.(ed.storage.characterCount.words(), ed.storage.characterCount.characters());
    },
  });

  useEffect(() => {
    if (editor) {
      onStatsRef.current?.(
        editor.storage.characterCount.words(),
        editor.storage.characterCount.characters(),
      );
    }
  }, [editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null;
      return {
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        underline: ed.isActive('underline'),
        strike: ed.isActive('strike'),
        code: ed.isActive('code'),
        h1: ed.isActive('heading', { level: 1 }),
        h2: ed.isActive('heading', { level: 2 }),
        h3: ed.isActive('heading', { level: 3 }),
        para: ed.isActive('paragraph'),
        bullet: ed.isActive('bulletList'),
        ordered: ed.isActive('orderedList'),
        task: ed.isActive('taskList'),
        quote: ed.isActive('blockquote'),
        codeBlock: ed.isActive('codeBlock'),
        link: ed.isActive('link'),
        alignLeft: ed.isActive({ textAlign: 'left' }),
        alignCenter: ed.isActive({ textAlign: 'center' }),
        alignRight: ed.isActive({ textAlign: 'right' }),
        alignJustify: ed.isActive({ textAlign: 'justify' }),
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
      };
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = (editor.getAttributes('link').href as string) ?? '';
    const url = window.prompt('ბმულის URL', prev);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const onPickImage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !editor) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') editor.chain().focus().setImage({ src: reader.result }).run();
      };
      reader.readAsDataURL(file);
    },
    [editor],
  );

  if (!editor || !state) {
    return <div className="doc-editor doc-editor--loading">…</div>;
  }

  const headingValue = state.h1 ? 'h1' : state.h2 ? 'h2' : state.h3 ? 'h3' : 'p';

  return (
    <div className="doc-editor">
      <div className="etb" role="toolbar" aria-label="ფორმატირება">
        <div className="etb__group">
          <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!state.canUndo} title="დაბრუნება">
            ↺
          </Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!state.canRedo} title="გამეორება">
            ↻
          </Btn>
        </div>

        <div className="etb__group">
          <select
            className="etb__select"
            value={headingValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'p') editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
            }}
          >
            <option value="p">ტექსტი</option>
            <option value="h1">სათაური 1</option>
            <option value="h2">სათაური 2</option>
            <option value="h3">სათაური 3</option>
          </select>
        </div>

        <div className="etb__group">
          <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={state.bold} title="მუქი (Ctrl+B)">
            <b>B</b>
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={state.italic} title="დახრილი (Ctrl+I)">
            <i>I</i>
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={state.underline}
            title="ხაზგასმული (Ctrl+U)"
          >
            <u>U</u>
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={state.strike} title="გადახაზული">
            <s>S</s>
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={state.code} title="კოდი">
            {'</>'}
          </Btn>
        </div>

        <div className="etb__group">
          <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={state.bullet} title="სია">
            •
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={state.ordered}
            title="დანომრილი სია"
          >
            1.
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleTaskList().run()} active={state.task} title="დავალებების სია">
            ☑
          </Btn>
        </div>

        <div className="etb__group">
          <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={state.quote} title="ციტატა">
            ❝
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={state.codeBlock}
            title="კოდის ბლოკი"
          >
            {'{ }'}
          </Btn>
          <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="გამყოფი ხაზი">
            ―
          </Btn>
        </div>

        <div className="etb__group">
          <Btn onClick={setLink} active={state.link} title="ბმული">
            🔗
          </Btn>
          <Btn onClick={() => fileRef.current?.click()} title="სურათი">
            🖼
          </Btn>
          <Btn
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
            title="ცხრილი"
          >
            ▦
          </Btn>
        </div>

        <div className="etb__group">
          <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={state.alignLeft} title="მარცხნივ">
            ⇤
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={state.alignCenter}
            title="ცენტრში"
          >
            ⇔
          </Btn>
          <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={state.alignRight} title="მარჯვნივ">
            ⇥
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            active={state.alignJustify}
            title="სწორება"
          >
            ☰
          </Btn>
        </div>

        <div className="etb__group">
          <Btn
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            title="ფორმატის მოხსნა"
          >
            ⌫
          </Btn>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />

      <BubbleMenu editor={editor} className="bubble">
        <button className={`bubble__b${state.bold ? ' is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()}>
          <b>B</b>
        </button>
        <button className={`bubble__b${state.italic ? ' is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <i>I</i>
        </button>
        <button className={`bubble__b${state.underline ? ' is-active' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <u>U</u>
        </button>
        <button className={`bubble__b${state.link ? ' is-active' : ''}`} onClick={setLink}>
          🔗
        </button>
        <button className={`bubble__b${state.code ? ' is-active' : ''}`} onClick={() => editor.chain().focus().toggleCode().run()}>
          {'</>'}
        </button>
      </BubbleMenu>

      <EditorContent editor={editor} className="doc-editor__surface" />
    </div>
  );
}
