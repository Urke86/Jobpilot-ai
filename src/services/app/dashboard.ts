import { listActivities } from '@/services/app/activities';
import { listApplications } from '@/services/app/applications';
import { listJobs } from '@/services/app/jobs';
import type { ActivityRecord, ApplicationRecord, JobRecord } from '@/services/contracts';

export interface DashboardStats {
  totalJobs: number;
  shortlisted: number;
  activeApplications: number;
  interviews: number;
  responseRate: number;
}

export interface DashboardData {
  stats: DashboardStats;
  jobsBySource: { name: string; count: number }[];
  applicationsByStatus: { name: string; count: number }[];
  recentJobs: JobRecord[];
  activities: ActivityRecord[];
  applications: ApplicationRecord[];
}

const ACTIVE_APP_STAGES = new Set([
  'preparing',
  'applied',
  'questionnaire',
  'interview',
  'assignment',
  'offer',
]);

export async function getDashboardData(): Promise<DashboardData> {
  const [jobs, applications, activities] = await Promise.all([
    listJobs(),
    listApplications(),
    listActivities(12),
  ]);

  const shortlisted = jobs.filter((job) => job.status === 'shortlisted').length;
  const activeApplications = applications.filter((app) =>
    ACTIVE_APP_STAGES.has(app.stage),
  ).length;
  const interviews = applications.filter(
    (app) => app.stage === 'interview',
  ).length;

  const progressed = applications.filter((app) =>
    ['questionnaire', 'interview', 'assignment', 'offer', 'rejected'].includes(
      app.stage,
    ),
  ).length;
  const submitted = applications.filter((app) => app.stage !== 'preparing')
    .length;
  const responseRate =
    submitted === 0 ? 0 : Math.round((progressed / submitted) * 100);

  const sourceMap = new Map<string, number>();
  for (const job of jobs) {
    const source = job.source?.trim() || 'Unknown';
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
  }
  const jobsBySource = [...sourceMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const stageOrder = [
    'preparing',
    'applied',
    'questionnaire',
    'interview',
    'assignment',
    'offer',
    'rejected',
    'withdrawn',
  ] as const;
  const stageCounts = new Map<string, number>();
  for (const stage of stageOrder) stageCounts.set(stage, 0);
  for (const app of applications) {
    stageCounts.set(app.stage, (stageCounts.get(app.stage) ?? 0) + 1);
  }
  const applicationsByStatus = stageOrder.map((name) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: stageCounts.get(name) ?? 0,
  }));

  const recentJobs = [...jobs]
    .sort(
      (a, b) =>
        new Date(b.date_discovered).getTime() -
        new Date(a.date_discovered).getTime(),
    )
    .slice(0, 8);

  return {
    stats: {
      totalJobs: jobs.length,
      shortlisted,
      activeApplications,
      interviews,
      responseRate,
    },
    jobsBySource,
    applicationsByStatus,
    recentJobs,
    activities,
    applications,
  };
}
