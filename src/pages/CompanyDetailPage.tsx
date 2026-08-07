import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  ExternalLink,
  Bot,
  Users,
  Briefcase,
  Building2,
  Globe,
  Link2,
  User,
  Mail,
  MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { EmptyState, LoadingState } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useResource } from '@/hooks/use-resource';
import { getCompanyById, getJobsByCompanyName } from '@/services';
import type { Company, Job } from '@/types';
import {
  getCompanyColor,
  getCompanyInitials,
  getScoreColor,
} from '@/utils';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useResource(
    async (): Promise<{ company: Company; jobs: Job[] } | null> => {
      if (!id) return null;
      const company = await getCompanyById(id);
      if (!company) return null;
      const jobs = await getJobsByCompanyName(company.name);
      return { company, jobs };
    },
    [id],
  );

  if (isLoading) {
    return <LoadingState label="Loading company…" />;
  }

  if (!data) {
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

  const { company, jobs: companyJobs } = data;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" className="-ml-2" asChild>
        <Link to={ROUTES.companies}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Companies
        </Link>
      </Button>

      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* Large company initial circle */}
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white ${getCompanyColor(
            company.name
          )}`}
        >
          {getCompanyInitials(company.name)}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {company.name}
            </h1>
            <Badge variant="secondary" className="text-sm">
              {company.industry}
            </Badge>
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm font-semibold">{company.rating}</span>
            </div>
          </div>

          <a
            href={company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            {company.website.replace(/^https?:\/\//, '')}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Grid Layout                                                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ============================================================ */}
        {/* Left Column (2/3)                                            */}
        {/* ============================================================ */}
        <div className="lg:col-span-2 space-y-6">
          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {company.description}
              </p>
            </CardContent>
          </Card>

          {/* AI Focus */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-primary" />
                AI Focus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {company.aiFocus}
              </p>
            </CardContent>
          </Card>

          {/* Open Positions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5 text-primary" />
                Open Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {companyJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Briefcase className="h-8 w-8 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No open positions tracked
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
                        <TableHead className="text-right">
                          Match Score
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyJobs.map((job) => (
                        <TableRow
                          key={job.id}
                          className="group cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(ROUTES.jobDetail(job.id))}
                        >
                            <TableCell className="font-medium group-hover:text-primary transition-colors">
                              {job.position}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {job.location}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`font-semibold ${getScoreColor(
                                  job.matchScore
                                )}`}
                              >
                                {job.matchScore}%
                              </span>
                            </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* Right Column (1/3)                                           */}
        {/* ============================================================ */}
        <div className="space-y-6">
          {/* Company Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow
                icon={<Building2 className="h-4 w-4" />}
                label="Industry"
                value={company.industry}
              />
              <Separator />
              <InfoRow
                icon={<Users className="h-4 w-4" />}
                label="Company Size"
                value={`${company.size} employees`}
              />
              <Separator />
              <InfoRow
                icon={<Bot className="h-4 w-4" />}
                label="AI Focus"
                value={company.aiFocus}
              />
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4" />
                  <span>Rating</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-semibold">
                    {company.rating}
                  </span>
                </div>
              </div>
              <Separator />
              <InfoRow
                icon={<Briefcase className="h-4 w-4" />}
                label="Open Positions"
                value={String(company.openPositions)}
              />
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>Website</span>
                </div>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
                >
                  Visit
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <span>Careers Page</span>
                </div>
                <a
                  href={company.careersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-4"
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {company.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts available.
                </p>
              ) : (
                <div className="space-y-3">
                  {company.contacts.map((contact, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium leading-tight">
                          {contact.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {contact.role}
                        </p>
                        <a
                          href={`mailto:${contact.email}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
                        >
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InfoRow sub-component
// ---------------------------------------------------------------------------

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        {icon}
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
