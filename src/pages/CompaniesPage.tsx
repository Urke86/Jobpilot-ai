import { Link } from 'react-router-dom';
import { Star, Users, Bot, Briefcase, ExternalLink, ArrowRight, Building2 } from 'lucide-react';
import type { Company } from '@/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/common';
import { ROUTES } from '@/constants/routes';
import { useResource } from '@/hooks/use-resource';
import { listCompanies } from '@/services';
import { getCompanyColor, getCompanyInitials } from '@/utils';

// ---------------------------------------------------------------------------
// Company Card
// ---------------------------------------------------------------------------

function CompanyCard({ company }: { company: Company }) {
  return (
    <Card className="group flex flex-col transition-all duration-200 hover:shadow-lg hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Company initial circle */}
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${getCompanyColor(
                company.name
              )}`}
            >
              {getCompanyInitials(company.name)}
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight truncate">
                {company.name}
              </h3>
              <Badge
                variant="secondary"
                className="mt-1 text-xs font-normal"
              >
                {company.industry}
              </Badge>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1 shrink-0">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold">{company.rating}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 pb-4">
        {/* Key info row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {company.size}
          </span>
          <span className="flex items-center gap-1">
            <Bot className="h-3.5 w-3.5" />
            <span className="truncate max-w-[120px]">{company.aiFocus.split(' ').slice(0, 3).join(' ')}</span>
          </span>
          <span className="flex items-center gap-1">
            <Briefcase className="h-3.5 w-3.5" />
            {company.openPositions}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {company.description}
        </p>
      </CardContent>

      <CardFooter className="pt-0 pb-4 flex items-center justify-between border-t mt-auto pt-4">
        <Link
          to={ROUTES.companyDetail(company.id)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4 transition-colors"
        >
          View Details
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>

        <a
          href={company.careersUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Careers
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompaniesPage() {
  const { data: companies, isLoading } = useResource(listCompanies, []);

  if (isLoading) {
    return <LoadingState label="Loading companies…" />;
  }

  const allCompanies = companies ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
        <p className="text-muted-foreground mt-1">
          Research and track target companies
        </p>
      </div>

      {/* Grid */}
      {allCompanies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No companies yet"
          description="Companies you track will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allCompanies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  );
}
