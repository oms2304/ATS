'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

type DocItem = {
  id: string
  type: string
  title: string
  content: string | null
  versionNumber: number
  updatedAt: string
  job: { id: string; title: string; company: string } | null
}

function typeLabel(type: string) {
  return type === 'cover_letter' ? 'Cover Letter' : 'Resume'
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/documents')
        if (res.success && Array.isArray(res.data)) setDocs(res.data)
      } catch {
        // leave the list empty so the page still renders
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-white mb-1">Documents</h1>
        <p className="text-sm text-[#8b949e]">
          Resumes and cover letters you&apos;ve saved from your job drafts.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[#8b949e]">Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-[#8b949e]">
          No saved documents yet. Open a job, generate a resume or cover letter, and click Save.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-[#161b22] border border-[#30363d] rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{doc.title}</p>
                  <p className="text-xs text-[#8b949e] mt-0.5">
                    {typeLabel(doc.type)} · v{doc.versionNumber}
                    {doc.job && (
                      <>
                        {' · '}
                        <Link
                          href={`/jobs/${doc.job.id}`}
                          className="text-[#58a6ff] hover:underline"
                        >
                          {doc.job.title} at {doc.job.company}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                  className="text-xs px-3 py-1.5 border border-[#30363d] text-[#8b949e] rounded hover:text-white hover:border-[#444c56] transition-colors shrink-0"
                >
                  {expandedId === doc.id ? 'Hide' : 'View'}
                </button>
              </div>
              {expandedId === doc.id && (
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-[#c9d1d9] bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 max-h-[28rem] overflow-y-auto">
                  {doc.content}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
