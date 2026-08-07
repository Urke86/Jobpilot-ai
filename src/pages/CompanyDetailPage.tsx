import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  Briefcase,
  Building2,
  ExternalLink,
  Globe,
  Link2,
  Mail,
  MapPin,
  Plus,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/constants/routes';
import {
  APPLICATION_STAGE_LABELS,
  JOB_STATUS_LABELS,
} from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import {
  createContact,
  formatSalary,
  getCompanyById,
  listApplications,
  listContactsByCompany,
  listJobsByCompany,
  updateCompany,
  type CompanyRecord,
} from '@/services';
import {
  getCompanyColor,
  getCompanyInitials,
  getJobStatusStyle,
  getStageBadgeClass,
} from '@/utils';

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editForm, setEditForm] = useState({
    name: '',
    website: '',
    industry: '',
    company_size: '',
    ai_focus: '',
    careers_url: '',
    notes: '',
  });
  const [savingCompany, setSavingCompany] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    role: '',
    email: '',
    linkedin_url: '',
    notes: '',
  });
  const [savingContact, setSavingContact] = useState(false);

  const {
    data: company,
    isLoading,
    refetch: refetchCompany,
  } = useResource(
    () => (id ? getCompanyById(id) : Promise.resolve(null)),
    [id],
  );

  const { data: jobs } = useResource(
    () => (id ? listJobsByCompany(id) : Promise.resolve([])),
    [id],
  );

  const { data: contacts, refetch: refetchContacts } = useResource(
    () => (id ? listContactsByCompany(id) : Promise.resolve([])),
    [id],
  );

  const { data: applications } = useResource(listApplications, []);

  useEffect(() => {
    if (!company) return;
    setEditForm({
      name: company.name,
      website: company.website ?? '',
      industry: company.industry ?? '',
      company_size: company.company_size ?? '',
      ai_focus: company.ai_focus ?? '',
      careers_url: company.careers_url ?? '',
      notes: company.notes ?? '',
    });
  }, [company]);

  const jobIds = useMemo(
    () => new Set((jobs ?? []).map((j) => j.id)),
    [jobs],
  );

  const companyApps = useMemo(
    () => (applications ?? []).filter((app) => jobIds.has(app.job_id)),
    [applications, jobIds],
  );

  const jobTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs ?? []) map.set(job.id, job.job_title);
    return map;
  }, [jobs]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !editForm.name.trim()) return;
    setSavingCompany(true);
    try {
      await updateCompany(company.id, {
        name: editForm.name.trim(),
        website: editForm.website.trim() || null,
        industry: editForm.industry.trim() || null,
        company_size: editForm.company_size.trim() || null,
        ai_focus: editForm.ai_focus.trim() || null,
        careers_url: editForm.careers_url.trim() || null,
        notes: editForm.notes.trim() || null,
      });
      toast.success('Company updated');
      refetchCompany();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !contactForm.name.trim()) return;
    setSavingContact(true);
    try {
      await createContact({
        company_id: company.id,
        name: contactForm.name.trim(),
        role: contactForm.role.trim() || null,
        email: contactForm.email.trim() || null,
        linkedin_url: contactForm.linkedin_url.trim() || null,
        notes: contactForm.notes.trim() || null,
      });
      toast.success('Contact added');
      setContactOpen(false);
      setContactForm({
        name: '',
        role: '',
        email: '',
        linkedin_url: '',
        notes: '',
      });
      refetchContacts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setSavingContact(false);
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading company…" />;
  }

  if (!company) {
    return (
      <EmptyState
        icon={Building2}
        title="Company not found"
        description="The company you're looking for doesn't exist or may have been removed."
        actionLabel="Back to Companies"
        onAction={() => navigate(ROUTES.companies)}
      />
    );
  }

  const companyJobs = jobs ?? [];
  const companyContacts = contacts ?? [];

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to={ROUTES.companies}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Companies
        </Link>
      </Button>

      <div className="flex flex-col items-start gap-5 sm:flex-row">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white ${getCompanyColor(
            company.name,
          )}`}
        >
          {getCompanyInitials(company.name)}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
            {company.industry && (
              <Badge variant="secondary" className="text-sm">
                {company.industry}
              </Badge>
            )}
          </div>
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              <Globe className="h-3.5 w-3.5" />
              {company.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit company</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCompany} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cname">Name</Label>
                    <Input
                      id="cname"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cindustry">Industry</Label>
                    <Input
                      id="cindustry"
                      value={editForm.industry}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          industry: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cwebsite">Website</Label>
                    <Input
                      id="cwebsite"
                      value={editForm.website}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, website: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="csize">Size</Label>
                    <Input
                      id="csize"
                      value={editForm.company_size}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          company_size: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cai">AI focus</Label>
                    <Input
                      id="cai"
                      value={editForm.ai_focus}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          ai_focus: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ccareers">Careers URL</Label>
                    <Input
                      id="ccareers"
                      value={editForm.careers_url}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          careers_url: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnotes">Notes</Label>
                  <Textarea
                    id="cnotes"
                    rows={3}
                    value={editForm.notes}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, notes: e.target.value }))
                    }
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingCompany}>
                    {savingCompany ? 'Saving…' : 'Save changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {company.ai_focus && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="h-5 w-5 text-primary" />
                  AI Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {company.ai_focus}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5 text-primary" />
                Linked Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              {companyJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Briefcase className="mb-3 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    No jobs linked to this company
                  </p>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Position</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Location
                        </TableHead>
                        <TableHead className="hidden md:table-cell">
                          Salary
                        </TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyJobs.map((job) => (
                        <TableRow
                          key={job.id}
                          className="group cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(ROUTES.jobDetail(job.id))}
                        >
                          <TableCell className="font-medium transition-colors group-hover:text-primary">
                            {job.job_title}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground sm:table-cell">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {job.location || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">
                            {formatSalary(job)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={getJobStatusStyle(job.status)}
                            >
                              {JOB_STATUS_LABELS[job.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {companyApps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No applications for jobs at this company.
                </p>
              ) : (
                <div className="space-y-2">
                  {companyApps.map((app) => (
                    <Link
                      key={app.id}
                      to={ROUTES.applicationDetail(app.id)}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium">
                        {jobTitleById.get(app.job_id) ?? 'Job'}
                      </span>
                      <Badge className={getStageBadgeClass(app.stage)}>
                        {APPLICATION_STAGE_LABELS[app.stage]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow
                icon={<Building2 className="h-4 w-4" />}
                label="Industry"
                value={company.industry || '—'}
              />
              <Separator />
              <InfoRow
                icon={<Users className="h-4 w-4" />}
                label="Company Size"
                value={company.company_size || '—'}
              />
              <Separator />
              <InfoRow
                icon={<Bot className="h-4 w-4" />}
                label="AI Focus"
                value={company.ai_focus || '—'}
              />
              <Separator />
              <InfoRow
                icon={<Briefcase className="h-4 w-4" />}
                label="Linked Jobs"
                value={String(companyJobs.length)}
              />
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>Website</span>
                </div>
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Visit
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <span>Careers Page</span>
                </div>
                {company.careers_url ? (
                  <a
                    href={company.careers_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Contacts</CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setContactOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {companyContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {companyContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium leading-tight">
                          {contact.name}
                        </p>
                        {contact.role && (
                          <p className="text-xs text-muted-foreground">
                            {contact.role}
                          </p>
                        )}
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {contact.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Add a person at {(company as CompanyRecord).name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddContact} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Name</Label>
              <Input
                id="contactName"
                value={contactForm.name}
                onChange={(e) =>
                  setContactForm((p) => ({ ...p, name: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactRole">Role</Label>
                <Input
                  id="contactRole"
                  value={contactForm.role}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, role: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactLinkedin">LinkedIn URL</Label>
              <Input
                id="contactLinkedin"
                value={contactForm.linkedin_url}
                onChange={(e) =>
                  setContactForm((p) => ({
                    ...p,
                    linkedin_url: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNotes">Notes</Label>
              <Textarea
                id="contactNotes"
                rows={2}
                value={contactForm.notes}
                onChange={(e) =>
                  setContactForm((p) => ({ ...p, notes: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setContactOpen(false)}
                disabled={savingContact}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingContact}>
                {savingContact ? 'Saving…' : 'Add contact'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
