import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { EmptyState, LoadingState } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useResource } from '@/hooks/use-resource';
import { listJobs } from '@/services';
import {
  getCompanyColor,
  getJobStatusStyle,
  getRecommendationStyle,
  getScoreColor,
  getScoreRingColor,
} from '@/utils';

export default function JobsPage() {
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useResource(listJobs, []);
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const allJobs = useMemo(() => jobs ?? [], [jobs]);

  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (remoteFilter !== 'all' && job.remoteType !== remoteFilter) return false;

      if (scoreFilter !== 'all') {
        const min = parseInt(scoreFilter, 10);
        if (job.matchScore < min) return false;
      }

      if (sourceFilter !== 'all' && job.source !== sourceFilter) return false;

      if (statusFilter !== 'all' && job.status !== statusFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !job.position.toLowerCase().includes(q) &&
          !job.company.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allJobs, remoteFilter, scoreFilter, sourceFilter, statusFilter, search]);

  if (isLoading) {
    return <LoadingState label="Loading jobs…" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Discover and track opportunities
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {filteredJobs.length} / {allJobs.length} jobs
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Select value={remoteFilter} onValueChange={setRemoteFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Remote Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="fully-remote">Fully Remote</SelectItem>
            <SelectItem value="hybrid">Hybrid</SelectItem>
            <SelectItem value="on-site">On-site</SelectItem>
          </SelectContent>
        </Select>

        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scores</SelectItem>
            <SelectItem value="90">90+</SelectItem>
            <SelectItem value="80">80+</SelectItem>
            <SelectItem value="70">70+</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="LinkedIn">LinkedIn</SelectItem>
            <SelectItem value="Indeed">Indeed</SelectItem>
            <SelectItem value="Company Website">Company Website</SelectItem>
            <SelectItem value="AngelList">AngelList</SelectItem>
            <SelectItem value="Remote OK">Remote OK</SelectItem>
            <SelectItem value="Wellfound">Wellfound</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="shortlisted">Shortlisted</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="interviewing">Interviewing</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by position or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No jobs match your filters"
          description="Try adjusting your filters or search query to find more opportunities."
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
                <TableHead className="w-[100px] text-center">Score</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Recommendation
                </TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.map((job, idx) => (
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
                          job.company,
                        )}`}
                      />
                      <span className="truncate">{job.company}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium transition-colors group-hover:text-primary">
                    {job.position}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {job.location}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {job.salary}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {job.source}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${getScoreRingColor(
                          job.matchScore,
                        )}`}
                      />
                      <span
                        className={`font-semibold ${getScoreColor(
                          job.matchScore,
                        )}`}
                      >
                        {job.matchScore}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge
                      variant="outline"
                      className={`capitalize ${getRecommendationStyle(
                        job.recommendation,
                      )}`}
                    >
                      {job.recommendation}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={`capitalize ${getJobStatusStyle(job.status)}`}
                    >
                      {job.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
