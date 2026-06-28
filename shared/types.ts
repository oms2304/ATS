export const STAGES = [
    'Interested',
    'Applied',
    'Interview',
    'Offer',
    'Rejected',
    'Archived',
  ] as const

  export type Stage = (typeof STAGES)[number]

  export type User = {
    id: string
    name: string
    email: string
    createdAt: string
  }
  
  export type Job = {
    id: string
    userId: string
    title: string
    company: string
    jobPostingBody: string
    stage: Stage
    createdAt: string
    updatedAt: string
    archivedAt: string | null;
  }
  
  export type Profile = {
    id: string
    userId: string
    firstName: string
    lastName: string
    phone: string
    location: string
    linkedIn: string
    summary: string
    completionScore: number
  }
  
  export type Document = {
    id: string
    userId: string
    type: string
    title: string
    fileUrl: string
    createdAt: string
  }