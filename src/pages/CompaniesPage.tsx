import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Building2,
  ExternalLink,
  Plus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/constants/routes';
import { useResource } from '@/hooks/use-resource';
import {
  createCompany,
  listCompanies,
  type CompanyRecord,
} from '@/services';
import { getCompanyColor, getCompanyInitials } from '@/utils';

type CompanyForm = {
  name: string;
  website: string;
  industry: string;
  company_size: string;
  ai_focus: string;
  careers_url: string;
  notes: string;
};

const emptyForm: CompanyForm = {
  name: '',
  website: '',
  industry: '',
  company_size: '',
  ai_focus: '',
  careers_url: '',
  notes: '',
};

function CompanyCard({ company }: { company: CompanyRecord }) {
  return (
    <Card className="group flex flex-col transition-all duration-200 hover:border-primary/30 hover:shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${getCompanyColor(
                company.name,
              )}`}
            >
              {getCompanyInitials(company.name)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold leading-tight">
                {company.name}
              </h3>
              {company.industry && (
                <Badge variant="secondary" className="mt-1 text-xs font-normal">
                  {company.industry}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {company.company_size && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {company.company_size}
            </span>
          )}
          {company.ai_focus && (
            <span className="flex items-center gap-1">
              <Bot className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">
                {company.ai_focus.split(' ').slice(0, 3).join(' ')}
              </span>
            </span>
          )}
        </div>
        {company.notes ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {company.notes}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-between border-t pb-4 pt-4">
        <Link
          to={ROUTES.companyDetail(company.id)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline"
        >
          View Details
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        {company.careers_url ? (
          <a
            href={company.careers_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            Careers
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </CardFooter>
    </Card>
  );
}

export default function CompaniesPage() {
  const navigate = useNavigate();
  const { data: companies, isLoading, error, refetch } = useResource(
    listCompanies,
    [],
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const update = (key: keyof CompanyForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const created = await createCompany({
        name: form.name.trim(),
        website: form.website.trim() || null,
        industry: form.industry.trim() || null,
        company_size: form.company_size.trim() || null,
        ai_focus: form.ai_focus.trim() || null,
        careers_url: form.careers_url.trim() || null,
        notes: form.notes.trim() || null,
      });
      toast.success('Company added');
      setOpen(false);
      setForm(emptyForm);
      refetch();
      navigate(ROUTES.companyDetail(created.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add company');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading companies…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon={Building2}
        title="Could not load companies"
        description={error.message}
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  const allCompanies = companies ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="mt-1 text-muted-foreground">
            Research and track target companies
          </p>
        </div>
        <Button
          className="gap-1.5"
          onClick={() => {
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Company
        </Button>
      </div>

      {allCompanies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Add a company to start researching and linking jobs."
          actionLabel="Add Company"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {allCompanies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
            <DialogDescription>
              Save a company you want to track.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={form.website}
                  onChange={(e) => update('website', e.target.value)}
                  placeholder="https://"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={form.industry}
                  onChange={(e) => update('industry', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="size">Size</Label>
                <Input
                  id="size"
                  value={form.company_size}
                  onChange={(e) => update('company_size', e.target.value)}
                  placeholder="e.g. 50-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="careers">Careers URL</Label>
                <Input
                  id="careers"
                  value={form.careers_url}
                  onChange={(e) => update('careers_url', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai_focus">AI focus</Label>
              <Input
                id="ai_focus"
                value={form.ai_focus}
                onChange={(e) => update('ai_focus', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Add company'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
