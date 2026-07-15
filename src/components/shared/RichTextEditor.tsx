//@ts-nocheck
import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3,
  Link as LinkIcon, Quote, Undo, Redo, AlignLeft, AlignCenter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
}

export function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[400px] p-4 focus:outline-none dark:prose-invert',
      },
    },
  })

  if (!editor) return null

  const toolbarBtn = (onClick: () => void, isActive: boolean, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-2 rounded-lg transition',
        isActive ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
      title={label}
    >
      {icon}
    </button>
  )

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl">
      {/* Toolbar — sticky so formatting buttons (Bold, Italic, etc.) stay
          visible while scrolling through long content.
          top-[200px] clears: navbar (80px) + content header (~60px) +
          section title (~60px). z-10 keeps it above the editor content. */}
      <div className="sticky top-[200px] z-10 flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-wrap rounded-t-2xl">
        {toolbarBtn(() => editor.chain().focus().toggleBold().run(), editor.isActive('bold'), <Bold className="w-4 h-4" />, 'Bold')}
        {toolbarBtn(() => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'), <Italic className="w-4 h-4" />, 'Italic')}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        {toolbarBtn(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }), <Heading2 className="w-4 h-4" />, 'Heading 2')}
        {toolbarBtn(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }), <Heading3 className="w-4 h-4" />, 'Heading 3')}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        {toolbarBtn(() => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), <List className="w-4 h-4" />, 'Bullet List')}
        {toolbarBtn(() => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), <ListOrdered className="w-4 h-4" />, 'Numbered List')}
        {toolbarBtn(() => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'), <Quote className="w-4 h-4" />, 'Quote')}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        {toolbarBtn(setLink, editor.isActive('link'), <LinkIcon className="w-4 h-4" />, 'Link')}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        {toolbarBtn(() => editor.chain().focus().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }), <AlignLeft className="w-4 h-4" />, 'Align Left')}
        {toolbarBtn(() => editor.chain().focus().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }), <AlignCenter className="w-4 h-4" />, 'Align Center')}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
        {toolbarBtn(() => editor.chain().focus().undo().run(), false, <Undo className="w-4 h-4" />, 'Undo')}
        {toolbarBtn(() => editor.chain().focus().redo().run(), false, <Redo className="w-4 h-4" />, 'Redo')}
      </div>
      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  )
}
