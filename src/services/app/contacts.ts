import type {
  Contact,
  ContactInsert,
  ContactUpdate,
} from '@/services/contracts';
import { logActivity } from '@/services/app/activities';
import {
  requireSupabaseClient,
  requireUserId,
} from '@/services/supabase/client';

export async function listContactsByCompany(
  companyId: string,
): Promise<Contact[]> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('company_id', companyId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createContact(
  input: Omit<ContactInsert, 'user_id'>,
): Promise<Contact> {
  const userId = await requireUserId();
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...input, user_id: userId, name: input.name.trim() })
    .select('*')
    .single();
  if (error) throw error;

  await logActivity({
    activityType: 'contact_added',
    entityType: 'contact',
    entityId: data.id,
    title: 'Contact added',
    description: `Added ${data.name}${data.role ? ` (${data.role})` : ''}.`,
  });

  return data;
}

export async function updateContact(
  id: string,
  input: Omit<ContactUpdate, 'user_id' | 'id'>,
): Promise<Contact> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase
    .from('contacts')
    .update(input)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) throw error;
}
