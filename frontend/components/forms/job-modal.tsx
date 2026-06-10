'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { JobForm } from './job-form'

type JobModalProps = {
  open: boolean
  onClose: () => void
  jobId?: string
  initialData?: {
    title: string
    company: string
    jobPostingBody: string
    stage: string
  }
  onSuccess: (job: unknown) => void
}

export function JobModal({ open, onClose, jobId, initialData, onSuccess }: JobModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="bg-[#161b22] border border-[#444c56] text-white sm:max-w-[600px] rounded-lg">
        <DialogHeader className="-mx-4 -mt-4 px-4 pt-4 pb-3 border-b border-[#30363d]">
          <DialogTitle className="text-white">{jobId ? 'Edit Job' : 'Add New Job'}</DialogTitle>
          <DialogDescription className="sr-only">
            {jobId ? 'Edit the details of this job.' : 'Create a new job record.'}
          </DialogDescription>
        </DialogHeader>
        <JobForm
          jobId={jobId}
          initialData={initialData}
          onSuccess={(job) => {
            onSuccess(job)
            onClose()
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
