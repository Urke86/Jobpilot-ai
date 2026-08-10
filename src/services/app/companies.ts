import type {
  CompanyInsert,
  CompanyRecord,
  CompanyUpdate,
} from '@/services/contracts';
import { logActivity } from '@/services/app/activities';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';

export async function listCompanies(): Promise<CompanyRecord[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('companies')
    .select(
      'id, user_id, name, website, industry, company_size, notes, ai_focus, careers_url, created_at, updated_at',
    )
    .order('name', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data ?? [];
}

export async function getCompanyById(id: string): Promise<CompanyRecord | null> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findCompanyByName(
  name: string,
): Promise<CompanyRecord | null> {
  const supabase = requireSupabaseClient();
  const trimmed = name.trim();
  if (!trimmed) return null;
  // Prefer indexed name match; fall back to case-insensitive scan of candidates.
  const { data, error } = await supabase
    .from('companies')
    .select('id, user_id, name, website, industry, company_size, notes, ai_focus, careers_url, created_at, updated_at')
    .ilike('name', trimmed)
    .limit(25);
  if (error) throw error;
  const normalized = trimmed.toLowerCase();
  return (
    data?.find((company) => company.name.trim().toLowerCase() === normalized) ??
    null
  );
}

export async function createCompany(
  input: Omit<CompanyInsert, 'user_id'>,
): Promise<CompanyRecord> {
  const userId = await requireUserId();
  const existing = await findCompanyByName(input.name);
  if (existing) return existing;

  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('companies')
    .insert({ ...input, user_id: userId, name: input.name.trim() })
    .select('*')
    .single();
  if (error) throw error;

  await logActivity({
    activityType: 'company_added',
    entityType: 'company',
    entityId: data.id,
    title: 'Company added',
    description: `Added ${data.name} to your company list.`,
  });

  return data;
}

export async function updateCompany(
  id: string,
  input: Omit<CompanyUpdate, 'user_id' | 'id'>,
): Promise<CompanyRecord> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('companies')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCompany(id: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { count, error: jobsError } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', id);
  if (jobsError) throw jobsError;
  if ((count ?? 0) > 0) {
    throw new Error(
      'This company has linked jobs. Reassign or delete those jobs first.',
    );
  }
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
}
