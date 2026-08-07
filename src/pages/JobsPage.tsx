import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { JobFormDialog } from '@/components/jobs/JobFormDialog';
import { EmptyState, LoadingState } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import {
  JOB_STATUS_LABELS,
  JOB_STATUSES,
  REMOTE_SCOPE_LABELS,
} from '@/constants/status';
import { useResource } from '@/hooks/use-resource';
import {
  createJob,
  formatSalary,
  listCompanies,
  listJobs,
  type CreateJobInput,
  type JobRecord,
} from '@/services';
import type { Enums } from '@/types/database';
import { getCompanyColor, getJobStatusStyle } from '@/utils';

export default function JobsPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading, error, refetch } = useResource(listJobs, []);
  const { data: companies } = useResource(listCompanies, []);
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const allJobs = useMemo(() => jobs ?? [], [jobs]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const job of allJobs) {
      if (job.source?.trim()) set.add(job.source.trim());
    }
    return [...set].sort();
  }, [allJobs]);

  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (remoteFilter !== 'all' && job.remote_scope !== remoteFilter) {
        return false;
      }
      if (sourceFilter !== 'all' && job.source !== sourceFilter) return false;
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !job.job_title.toLowerCase().includes(q) &&
          !job.company_name_snapshot.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allJobs, remoteFilter, sourceFilter, statusFilter, search]);

  const handleCreate = async (input: CreateJobInput) => {
    try {
      const created = await createJob(input);
      toast.success('Job added');
      refetch();
      navigate(ROUTES.jobDetail(created.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add job');
      throw err;
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading jobs…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Could not load jobs"
        description={error.message}
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="mt-1 text-muted-foreground">
            Discover and track opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            {filteredJobs.length} / {allJobs.length} jobs
          </Badge>
          <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Job
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {JOB_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={remoteFilter} onValueChange={setRemoteFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Remote scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All remote scopes</SelectItem>
            {(
              Object.keys(REMOTE_SCOPE_LABELS) as Enums<'remote_scope'>[]
            ).map((key) => (
              <SelectItem key={key} value={key}>
                {REMOTE_SCOPE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source} value={source}>
                {source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {allJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs yet"
          description="Add your first job to start tracking opportunities."
          actionLabel="Add Job"
          onAction={() => setDialogOpen(true)}
        />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No jobs match your filters"
          description="Try adjusting your filters or search query."
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Company</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="hidden lg:table-cell">Salary</TableHead>
                <TableHead className="hidden lg:table-cell">Source</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job: JobRecord, idx) => (
                <TableRow
                  key={job.id}
                  className={`group cursor-pointer transition-colors hover:bg-muted/50 ${
                    idx % 2 === 1 ? 'bg-muted/20' : ''
                  }`}
                  onClick={() => navigate(ROUTES.jobDetail(job.id))}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-3 w-3 shrink-0 rounded-full ${getCompanyColor(
                          job.company_name_snapshot,
                        )}`}
                      />
                      <span className="truncate">
                        {job.company_name_snapshot}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium transition-colors group-hover:text-primary">
                    {job.job_title}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {job.location || '—'}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {formatSalary(job)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {job.source || '—'}
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

      <JobFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companies={companies ?? []}
        onSubmit={handleCreate}
      />
    </div>
  );
}
