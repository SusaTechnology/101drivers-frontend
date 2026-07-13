//@ts-nocheck
import React, { useState, useEffect, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  FileText, HelpCircle, Save, Loader2, ArrowLeft, Plus, Trash2,
  Shield, BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Navbar } from '../shared/layout/testNavbar'
import { navItems } from '@/lib/items/navItems'
import { Brand } from '@/lib/items/brand'
import { useAdminActions } from '@/hooks/useAdminActions'
import { RichTextEditor } from '@/components/shared/RichTextEditor'
import { getAccessToken } from '@/lib/tanstack/dataQuery'

const API_BASE = import.meta.env.VITE_API_URL

const CONTENT_SECTIONS = [
  { key: 'privacy', label: 'Privacy Policy & Agreement', icon: Shield, type: 'richtext' },
  { key: 'terms', label: 'Terms of Service', icon: FileText, type: 'richtext' },
  { key: 'help-driver', label: 'Driver Help FAQs', icon: HelpCircle, type: 'faq' },
  { key: 'help-customer', label: 'Customer Help FAQs', icon: HelpCircle, type: 'faq' },
]

export default function AdminContentPage() {
  const { actionItems, signOut } = useAdminActions()
  const [activeKey, setActiveKey] = useState('privacy')
  const [content, setContent] = useState<string>('')
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const activeSection = CONTENT_SECTIONS.find(s => s.key === activeKey)!

  const fetchContent = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = getAccessToken()
      const res = await fetch(`${API_BASE}/api/content/${activeKey}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (activeSection.type === 'richtext') {
        setContent(data.content || '')
      } else {
        setFaqs(Array.isArray(data.content) ? data.content : [])
      }
    } catch {
      toast.error('Failed to load content')
      if (activeSection.type === 'richtext') setContent('')
      else setFaqs([])
    } finally {
      setIsLoading(false)
    }
  }, [activeKey, activeSection])

  useEffect(() => { fetchContent() }, [fetchContent])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const token = getAccessToken()
      const body = activeSection.type === 'richtext'
        ? { content }
        : { content: faqs }

      const res = await fetch(`${API_BASE}/api/content/${activeKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Content saved successfully')
    } catch {
      toast.error('Failed to save content')
    } finally {
      setIsSaving(false)
    }
  }

  const addFaq = () => {
    setFaqs([...faqs, { question: '', answer: '' }])
  }

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setFaqs(faqs.map((f, i) => i === index ? { ...f, [field]: value } : f))
  }

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Navbar brand={<Brand />} items={navItems} actions={actionItems} onSignOut={signOut} title="Admin" />

      <main className="max-w-[1200px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/admin-config" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <h1 className="text-2xl font-black">Content Editor</h1>
          </div>
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="lime-btn rounded-xl font-extrabold gap-2">
            {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Changes</>}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-2">
            {CONTENT_SECTIONS.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveKey(section.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition text-left',
                  activeKey === section.key
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                )}
              >
                <section.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{section.label}</span>
              </button>
            ))}
          </div>

          {/* Editor area */}
          <div>
            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
            ) : activeSection.type === 'richtext' ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="mb-3">
                    <h2 className="text-lg font-black">{activeSection.label}</h2>
                    <p className="text-xs text-slate-500 mt-1">Edit the content below. Changes go live immediately after saving.</p>
                  </div>
                  <RichTextEditor content={content} onChange={setContent} />
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-black">{activeSection.label}</h2>
                      <p className="text-xs text-slate-500 mt-1">Add, edit, or remove FAQ items.</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={addFaq}>
                      <Plus className="w-3.5 h-3.5" /> Add FAQ
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {faqs.length === 0 && (
                      <div className="text-center py-8 text-slate-500 text-sm">No FAQs yet. Click "Add FAQ" to create one.</div>
                    )}
                    {faqs.map((faq, index) => (
                      <div key={index} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-400">FAQ #{index + 1}</span>
                          <button onClick={() => removeFaq(index)} className="text-red-400 hover:text-red-600 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Question</Label>
                          <Input
                            value={faq.question}
                            onChange={(e) => updateFaq(index, 'question', e.target.value)}
                            placeholder="Enter the question..."
                            className="h-9 text-sm rounded-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Answer</Label>
                          <textarea
                            value={faq.answer}
                            onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                            placeholder="Enter the answer..."
                            rows={3}
                            className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
