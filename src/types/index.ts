export type JobStatus = 'new' | 'shortlisted' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'archived';
export type RemoteType = 'fully-remote' | 'hybrid' | 'on-site';
export type ApplicationStage = 'preparing' | 'applied' | 'questionnaire' | 'interview' | 'assignment' | 'offer' | 'rejected';

export interface Job {
  id: string;
  company: string;
  companyLogo?: string;
  position: string;
  location: string;
  remoteType: RemoteType;
  salary: string;
  source: string;
  matchScore: number;
  recommendation: 'strong' | 'good' | 'moderate' | 'weak';
  status: JobStatus;
  postedAt: string;
  description: string;
  requirements: string[];
  benefits: string[];
  tags: string[];
}

export interface Application {
  id: string;
  jobId: string;
  company: string;
  position: string;
  stage: ApplicationStage;
  appliedAt: string;
  updatedAt: string;
  nextStep?: string;
  notes?: string;
  salary: string;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  industry: string;
  size: string;
  aiFocus: string;
  careersUrl: string;
  website: string;
  description: string;
  openPositions: number;
  contacts: { name: string; role: string; email: string }[];
  rating: number;
}

export interface Activity {
  id: string;
  type: 'job_discovered' | 'application_sent' | 'interview_scheduled' | 'status_changed' | 'ai_analysis';
  title: string;
  description: string;
  timestamp: string;
  relatedId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
