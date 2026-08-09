/**
 * Application data layer.
 * Pages import from here — never call supabase.from() directly.
 */
export {
  listJobs,
  getJobById,
  listJobsByCompany,
  createJob,
  updateJob,
  setJobStatus,
  deleteJob,
  formatSalary,
  type CreateJobInput,
} from './app/jobs';

export {
  listCompanies,
  getCompanyById,
  findCompanyByName,
  createCompany,
  updateCompany,
  deleteCompany,
} from './app/companies';

export {
  listContactsByCompany,
  createContact,
  updateContact,
  deleteContact,
} from './app/contacts';

export {
  listApplications,
  getApplicationById,
  getApplicationByJobId,
  createApplication,
  updateApplication,
  setApplicationStage,
  deleteApplication,
  type CreateApplicationInput,
} from './app/applications';

export {
  listActivities,
  logActivity,
} from './app/activities';

export {
  getCurrentProfile,
  updateCurrentProfile,
} from './app/profiles';

export {
  getLatestJobAnalysis,
  listJobAnalyses,
  requestJobAnalysis,
  parseAnalysisStrengths,
  parseAnalysisGaps,
  parseAnalysisRisks,
  getAnalysisMetadata,
  type AnalyzeJobResponse,
} from './app/job-analysis';

export {
  listArtifactsByApplication,
  listArtifactsByType,
  getLatestArtifactByType,
  createArtifact,
  updateArtifactContent,
  requestArtifactGeneration,
  getArtifactMetadata,
  type GenerateArtifactInput,
  type GenerateArtifactResponse,
} from './app/artifacts';

export {
  ingestJobs,
  ingestSingleJob,
  listRecentlyIngestedJobs,
  getIngestionMeta,
  type IngestJobPayload,
  type IngestResult,
  type IngestResponse,
} from './app/ingestion';

export {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  listMessages,
  streamAssistantMessage,
  type AiConversation,
  type AiMessage,
  type AssistantContextType,
  type CreateConversationInput,
  type StreamChatHandlers,
} from './app/assistant';

export {
  getGoogleIntegrationStatus,
  startGoogleOAuth,
  disconnectGoogle,
  syncGmail,
  listJobEmails,
  getJobEmailById,
  linkEmailToApplication,
  acceptStageFromEmail,
  markEmailProcessed,
  createInterviewCalendarEvent,
  getExtractedData,
  type GoogleIntegrationStatus,
  type JobEmailRecord,
  type CalendarEventPreview,
} from './app/google-integration';

export {
  listAiGenerations,
  listPromptVersions,
  listAiEvaluations,
  listAiAlerts,
  acknowledgeAiAlert,
  submitAiEvaluation,
  recordManualAiFailure,
  getAiAnalyticsSummary,
  computeAnalyticsSummary,
  refreshSoftAlerts,
  type AiGenerationRow,
  type AiEvaluationRow,
  type AiAlertRow,
  type PromptVersionRow,
  type AiAnalyticsSummary,
} from './app/ai-observability';

export {
  getDashboardData,
  type DashboardData,
  type DashboardStats,
} from './app/dashboard';

export type * from './contracts';
export * as auth from './auth';
