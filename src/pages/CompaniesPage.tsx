import { Link } from 'react-router-dom';
import { Star, Users, Bot, Briefcase, ExternalLink, ArrowRight } from 'lucide-react';
import { mockCompanies } from '../data/mock';
import type { Company } from '../types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
  'bg-indigo-600',
  'bg-pink-600',
];

function companyColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${companyColor(
                company.name
              )}`}
            >
              {company.name.charAt(0)}
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
          to={`/companies/${company.id}`}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockCompanies.map((company) => (
          <CompanyCard key={company.id} company={company} />
        ))}
      </div>
    </div>
  );
}
