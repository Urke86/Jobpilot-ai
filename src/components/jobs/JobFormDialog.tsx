import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  EMPLOYMENT_TYPE_LABELS,
  REMOTE_SCOPE_LABELS,
} from '@/constants/status';
import type { CompanyRecord, CreateJobInput, JobRecord } from '@/services';
import type { Enums } from '@/types/database';

type JobFormState = {
  jobTitle: string;
  companyId: string;
  companyName: string;
  jobUrl: string;
  source: string;
  location: string;
  remoteScope: Enums<'remote_scope'>;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  employmentType: Enums<'employment_type'>;
  jobDescription: string;
  deadline: string;
};

const emptyForm: JobFormState = {
  jobTitle: '',
  companyId: '',
  companyName: '',
  jobUrl: '',
  source: '',
  location: '',
  remoteScope: 'unknown',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'EUR',
  employmentType: 'unknown',
  jobDescription: '',
  deadline: '',
};

function jobToForm(job: JobRecord): JobFormState {
  return {
    jobTitle: job.job_title,
    companyId: job.company_id ?? '',
    companyName: job.company_name_snapshot,
    jobUrl: job.job_url ?? '',
    source: job.source ?? '',
    location: job.location ?? '',
    remoteScope: job.remote_scope,
    salaryMin: job.salary_min != null ? String(job.salary_min) : '',
    salaryMax: job.salary_max != null ? String(job.salary_max) : '',
    salaryCurrency: job.salary_currency || 'EUR',
    employmentType: job.employment_type,
    jobDescription: job.job_description ?? '',
    deadline: job.deadline ?? '',
  };
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: JobRecord | null;
  companies?: CompanyRecord[];
  onSubmit: (input: CreateJobInput) => Promise<void>;
}

export function JobFormDialog({
  open,
  onOpenChange,
  initial,
  companies = [],
  onSubmit,
}: JobFormDialogProps) {
  const [form, setForm] = useState<JobFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ? jobToForm(initial) : emptyForm);
  }, [open, initial]);

  const update = <K extends keyof JobFormState>(key: K, value: JobFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleCompanySelect = (value: string) => {
    if (value === '__manual__') {
      update('companyId', '');
      return;
    }
    const company = companies.find((c) => c.id === value);
    if (company) {
      setForm((prev) => ({
        ...prev,
        companyId: company.id,
        companyName: company.name,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jobTitle.trim() || !form.companyName.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        jobTitle: form.jobTitle.trim(),
        companyId: form.companyId || null,
        companyName: form.companyName.trim(),
        jobUrl: form.jobUrl.trim() || null,
        source: form.source.trim() || null,
        location: form.location.trim() || null,
        remoteScope: form.remoteScope,
        salaryMin: parseOptionalNumber(form.salaryMin),
        salaryMax: parseOptionalNumber(form.salaryMax),
        salaryCurrency: form.salaryCurrency.trim() || 'EUR',
        employmentType: form.employmentType,
        jobDescription: form.jobDescription.trim() || null,
        deadline: form.deadline || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(initial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Job' : 'Add Job'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the job details below.'
              : 'Save a new opportunity to track.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input
              id="jobTitle"
              value={form.jobTitle}
              onChange={(e) => update('jobTitle', e.target.value)}
              required
            />
          </div>

          {companies.length > 0 ? (
            <div className="space-y-2">
              <Label>Company</Label>
              <Select
                value={form.companyId || '__manual__'}
                onValueChange={handleCompanySelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Enter name manually</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) => update('companyName', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jobUrl">Job URL</Label>
              <Input
                id="jobUrl"
                type="url"
                value={form.jobUrl}
                onChange={(e) => update('jobUrl', e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                value={form.source}
                onChange={(e) => update('source', e.target.value)}
                placeholder="LinkedIn, Indeed…"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Remote scope</Label>
              <Select
                value={form.remoteScope}
                onValueChange={(v) =>
                  update('remoteScope', v as Enums<'remote_scope'>)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(REMOTE_SCOPE_LABELS) as Enums<'remote_scope'>[]
                  ).map((key) => (
                    <SelectItem key={key} value={key}>
                      {REMOTE_SCOPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="salaryMin">Salary min</Label>
              <Input
                id="salaryMin"
                type="number"
                value={form.salaryMin}
                onChange={(e) => update('salaryMin', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salaryMax">Salary max</Label>
              <Input
                id="salaryMax"
                type="number"
                value={form.salaryMax}
                onChange={(e) => update('salaryMax', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salaryCurrency">Currency</Label>
              <Input
                id="salaryCurrency"
                value={form.salaryCurrency}
                onChange={(e) => update('salaryCurrency', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employment type</Label>
              <Select
                value={form.employmentType}
                onValueChange={(v) =>
                  update('employmentType', v as Enums<'employment_type'>)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(
                      EMPLOYMENT_TYPE_LABELS,
                    ) as Enums<'employment_type'>[]
                  ).map((key) => (
                    <SelectItem key={key} value={key}>
                      {EMPLOYMENT_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => update('deadline', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobDescription">Job description</Label>
            <Textarea
              id="jobDescription"
              rows={5}
              value={form.jobDescription}
              onChange={(e) => update('jobDescription', e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
