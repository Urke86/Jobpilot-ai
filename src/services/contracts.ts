import type {
  Enums,
  Tables,
  TablesInsert,
  TablesUpdate,
} from '@/types/database';

export type Profile = Tables<'profiles'>;
export type ProfileInsert = TablesInsert<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

export type CompanyRecord = Tables<'companies'>;
export type CompanyInsert = TablesInsert<'companies'>;
export type CompanyUpdate = TablesUpdate<'companies'>;

export type Contact = Tables<'contacts'>;
export type ContactInsert = TablesInsert<'contacts'>;
export type ContactUpdate = TablesUpdate<'contacts'>;

export type JobRecord = Tables<'jobs'>;
export type JobInsert = TablesInsert<'jobs'>;
export type JobUpdate = TablesUpdate<'jobs'>;

export type JobAnalysis = Tables<'job_analysis'>;
export type JobAnalysisInsert = TablesInsert<'job_analysis'>;
export type JobAnalysisUpdate = TablesUpdate<'job_analysis'>;

export type ApplicationRecord = Tables<'applications'>;
export type ApplicationInsert = TablesInsert<'applications'>;
export type ApplicationUpdate = TablesUpdate<'applications'>;

export type ApplicationArtifact = Tables<'application_artifacts'>;
export type ApplicationArtifactInsert = TablesInsert<'application_artifacts'>;
export type ApplicationArtifactUpdate = TablesUpdate<'application_artifacts'>;

export type ActivityRecord = Tables<'activities'>;
export type ActivityInsert = TablesInsert<'activities'>;

export type JobStatusDb = Enums<'job_status'>;
export type ApplicationStageDb = Enums<'application_stage'>;
export type RemoteScope = Enums<'remote_scope'>;
export type ArtifactType = Enums<'artifact_type'>;

/**
 * Repository contracts for Phase 3+ Supabase wiring.
 * Pages currently use the mock UI adapters in `services/mock`.
 */
export interface ProfilesRepository {
  getByUserId(userId: string): Promise<Profile | null>;
  upsert(input: ProfileInsert): Promise<Profile>;
  update(id: string, input: ProfileUpdate): Promise<Profile>;
}

export interface CompaniesRepository {
  list(): Promise<CompanyRecord[]>;
  getById(id: string): Promise<CompanyRecord | null>;
  create(input: CompanyInsert): Promise<CompanyRecord>;
  update(id: string, input: CompanyUpdate): Promise<CompanyRecord>;
  remove(id: string): Promise<void>;
}

export interface ContactsRepository {
  listByCompany(companyId: string): Promise<Contact[]>;
  create(input: ContactInsert): Promise<Contact>;
  update(id: string, input: ContactUpdate): Promise<Contact>;
  remove(id: string): Promise<void>;
}

export interface JobsRepository {
  list(): Promise<JobRecord[]>;
  getById(id: string): Promise<JobRecord | null>;
  listByCompany(companyId: string): Promise<JobRecord[]>;
  create(input: JobInsert): Promise<JobRecord>;
  update(id: string, input: JobUpdate): Promise<JobRecord>;
  remove(id: string): Promise<void>;
}

export interface JobAnalysisRepository {
  listByJob(jobId: string): Promise<JobAnalysis[]>;
  getLatestForJob(jobId: string): Promise<JobAnalysis | null>;
  create(input: JobAnalysisInsert): Promise<JobAnalysis>;
}

export interface ApplicationsRepository {
  list(): Promise<ApplicationRecord[]>;
  getById(id: string): Promise<ApplicationRecord | null>;
  getByJobId(jobId: string): Promise<ApplicationRecord | null>;
  create(input: ApplicationInsert): Promise<ApplicationRecord>;
  update(id: string, input: ApplicationUpdate): Promise<ApplicationRecord>;
  remove(id: string): Promise<void>;
}

export interface ApplicationArtifactsRepository {
  listByApplication(applicationId: string): Promise<ApplicationArtifact[]>;
  create(input: ApplicationArtifactInsert): Promise<ApplicationArtifact>;
  update(
    id: string,
    input: ApplicationArtifactUpdate,
  ): Promise<ApplicationArtifact>;
  remove(id: string): Promise<void>;
}

export interface ActivitiesRepository {
  list(limit?: number): Promise<ActivityRecord[]>;
  create(input: ActivityInsert): Promise<ActivityRecord>;
}
