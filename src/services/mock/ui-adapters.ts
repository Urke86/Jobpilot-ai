import {
  dashboardStats,
  jobsBySource,
  applicationsByStatus,
  mockActivities,
  mockApplications,
  mockCompanies,
  mockJobs,
} from '@/data/mock';
import type { Activity, Application, Company, Job } from '@/types';

/**
 * UI-facing mock adapters.
 * Pages continue to call these until Phase 3 wires authenticated Supabase CRUD.
 * Domain shapes here intentionally differ from DB tables (see types/database.ts).
 */

export async function listJobs(): Promise<Job[]> {
  return [...mockJobs];
}

export async function getJobById(id: string): Promise<Job | null> {
  return mockJobs.find((job) => job.id === id) ?? null;
}

export async function listApplications(): Promise<Application[]> {
  return [...mockApplications];
}

export async function getApplicationById(
  id: string,
): Promise<Application | null> {
  return mockApplications.find((app) => app.id === id) ?? null;
}

export async function listCompanies(): Promise<Company[]> {
  return [...mockCompanies];
}

export async function getCompanyById(id: string): Promise<Company | null> {
  return mockCompanies.find((company) => company.id === id) ?? null;
}

export async function getJobsByCompanyName(name: string): Promise<Job[]> {
  return mockJobs.filter(
    (job) => job.company.toLowerCase() === name.toLowerCase(),
  );
}

export async function listActivities(): Promise<Activity[]> {
  return [...mockActivities];
}

export async function getDashboardStats() {
  return { ...dashboardStats };
}

export async function getJobsBySourceChart() {
  return [...jobsBySource];
}

export async function getApplicationsByStatusChart() {
  return [...applicationsByStatus];
}
