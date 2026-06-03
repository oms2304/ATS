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
    stage: string
    createdAt: string
    updatedAt: string
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