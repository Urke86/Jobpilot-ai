import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { mockJobs } from '../data/mock';
import type { Job } from '../types';
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number) {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 80) return 'text-blue-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-gray-500';
}

function getScoreRingColor(score: number) {
  if (score >= 90) return 'bg-emerald-500';
  if (score >= 80) return 'bg-blue-500';
  if (score >= 70) return 'bg-yellow-500';
  return 'bg-gray-400';
}

function getRecommendationStyle(rec: Job['recommendation']) {
  switch (rec) {
    case 'strong':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'good':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'moderate':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'weak':
      return 'bg-red-100 text-red-700 border-red-200';
  }
}

function getStatusStyle(status: Job['status']) {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'shortlisted':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'applied':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'interviewing':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'offer':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'archived':
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

function companyColor(name: string) {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-violet-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-pink-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JobsPage() {
  const navigate = useNavigate();
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filteredJobs = useMemo(() => {
    return mockJobs.filter((job) => {
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
        )
          return false;
      }

      return true;
    });
  }, [remoteFilter, scoreFilter, sourceFilter, statusFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground mt-1">
            Discover and track opportunities
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {filteredJobs.length} / {mockJobs.length} jobs
        </Badge>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        {/* Remote Type */}
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

        {/* Score */}
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

        {/* Source */}
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

        {/* Status */}
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

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by position or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No jobs match your filters</h3>
          <p className="text-muted-foreground mt-1 max-w-sm">
            Try adjusting your filters or search query to find more
            opportunities.
          </p>
        </div>
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
                  onClick={() => navigate(`/jobs/${job.id}`)}
                >
                    {/* Company */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-3 w-3 shrink-0 rounded-full ${companyColor(
                            job.company
                          )}`}
                        />
                        <span className="truncate">{job.company}</span>
                      </div>
                    </TableCell>

                    {/* Position */}
                    <TableCell className="font-medium group-hover:text-primary transition-colors">
                      {job.position}
                    </TableCell>

                    {/* Location */}
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {job.location}
                    </TableCell>

                    {/* Salary */}
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {job.salary}
                    </TableCell>

                    {/* Source */}
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {job.source}
                    </TableCell>

                    {/* Match Score */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${getScoreRingColor(
                            job.matchScore
                          )}`}
                        />
                        <span
                          className={`font-semibold ${getScoreColor(
                            job.matchScore
                          )}`}
                        >
                          {job.matchScore}
                        </span>
                      </div>
                    </TableCell>

                    {/* Recommendation */}
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={`capitalize ${getRecommendationStyle(
                          job.recommendation
                        )}`}
                      >
                        {job.recommendation}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={`capitalize ${getStatusStyle(job.status)}`}
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
