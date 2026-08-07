import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState, LoadingState } from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/constants/routes';
import { REMOTE_PREFERENCE_LABELS } from '@/constants/status';
import { useAuth, useTheme, type ThemeMode } from '@/contexts';
import { useResource } from '@/hooks/use-resource';
import {
  getCurrentProfile,
  updateCurrentProfile,
} from '@/services';
import type { Enums } from '@/types/database';

interface PreferencesState {
  remoteType: string;
  minimumSalary: string;
  preferredLocations: string;
  jobSources: Record<string, boolean>;
  minimumMatchScore: string;
  autoShortlistThreshold: string;
}

interface NotificationsState {
  newJobMatches: boolean;
  applicationStatus: boolean;
  interviewReminders: boolean;
  weeklySummary: boolean;
  aiAnalysisComplete: boolean;
  companyUpdates: boolean;
}

interface AppearanceState {
  theme: ThemeMode;
  compactMode: boolean;
  showMatchScores: boolean;
  showAiRecommendations: boolean;
}

interface NotificationItem {
  key: keyof NotificationsState;
  label: string;
  description: string;
}

const notificationItems: NotificationItem[] = [
  {
    key: 'newJobMatches',
    label: 'New job matches',
    description: 'Get notified when new jobs match your profile and preferences',
  },
  {
    key: 'applicationStatus',
    label: 'Application status updates',
    description: 'Receive alerts when your application status changes',
  },
  {
    key: 'interviewReminders',
    label: 'Interview reminders',
    description: 'Get reminders before scheduled interviews',
  },
  {
    key: 'weeklySummary',
    label: 'Weekly summary email',
    description: 'Receive a weekly digest of your job search activity',
  },
  {
    key: 'aiAnalysisComplete',
    label: 'AI analysis complete',
    description: 'Get notified when AI finishes analyzing a job or your CV',
  },
  {
    key: 'companyUpdates',
    label: 'Company updates',
    description: 'Receive news and updates from companies you follow',
  },
];

const themeOptions: {
  value: AppearanceState['theme'];
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
    description: 'Light background with dark text',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    description: 'Dark background with light text',
  },
  {
    value: 'system',
    label: 'System',
    icon: Monitor,
    description: 'Follows your OS setting',
  },
];

const jobSourceOptions = [
  'LinkedIn',
  'Indeed',
  'AngelList',
  'Remote OK',
  'Wellfound',
  'Company Websites',
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, profile: authProfile, signOut, refreshProfile } = useAuth();
  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useResource(getCurrentProfile, []);

  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [targetRoles, setTargetRoles] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryCurrency, setSalaryCurrency] = useState('EUR');
  const [remotePreference, setRemotePreference] =
    useState<Enums<'remote_preference'>>('unknown');
  const [masterCv, setMasterCv] = useState('');
  const [portfolioSummary, setPortfolioSummary] = useState('');
  const [saving, setSaving] = useState(false);

  const [preferences, setPreferences] = useState<PreferencesState>({
    remoteType: 'fully-remote',
    minimumSalary: '',
    preferredLocations: '',
    jobSources: Object.fromEntries(jobSourceOptions.map((s) => [s, true])),
    minimumMatchScore: '70',
    autoShortlistThreshold: '85',
  });

  const [notifications, setNotifications] = useState<NotificationsState>({
    newJobMatches: true,
    applicationStatus: true,
    interviewReminders: true,
    weeklySummary: false,
    aiAnalysisComplete: true,
    companyUpdates: false,
  });

  const [appearance, setAppearance] = useState<AppearanceState>({
    theme,
    compactMode: false,
    showMatchScores: true,
    showAiRecommendations: true,
  });

  useEffect(() => {
    const source = profile ?? authProfile;
    if (!source) return;
    setFullName(source.full_name ?? '');
    setHeadline(source.headline ?? '');
    setLocation(source.location ?? '');
    setTargetRoles((source.target_roles ?? []).join(', '));
    setSalaryMin(source.salary_min != null ? String(source.salary_min) : '');
    setSalaryCurrency(source.salary_currency || 'EUR');
    setRemotePreference(source.remote_preference);
    setMasterCv(source.master_cv_text ?? '');
    setPortfolioSummary(source.portfolio_summary ?? '');
  }, [profile, authProfile]);

  useEffect(() => {
    setAppearance((prev) => ({ ...prev, theme }));
  }, [theme]);

  const updatePreferences = (field: keyof PreferencesState, value: string) =>
    setPreferences((prev) => ({ ...prev, [field]: value }));

  const toggleJobSource = (source: string) =>
    setPreferences((prev) => ({
      ...prev,
      jobSources: {
        ...prev.jobSources,
        [source]: !prev.jobSources[source],
      },
    }));

  const toggleNotification = (key: keyof NotificationsState) =>
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  const updateAppearance = <K extends keyof AppearanceState>(
    key: K,
    value: AppearanceState[K],
  ) => setAppearance((prev) => ({ ...prev, [key]: value }));

  const handleThemeChange = (value: ThemeMode) => {
    setTheme(value);
    updateAppearance('theme', value);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const roles = targetRoles
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const min = salaryMin.trim() ? Number(salaryMin) : null;
      await updateCurrentProfile({
        full_name: fullName.trim() || null,
        headline: headline.trim() || null,
        location: location.trim() || null,
        target_roles: roles,
        salary_min: min != null && Number.isFinite(min) ? min : null,
        salary_currency: salaryCurrency.trim() || 'EUR',
        remote_preference: remotePreference,
        master_cv_text: masterCv.trim() || null,
        portfolio_summary: portfolioSummary.trim() || null,
      });
      toast.success('Profile saved');
      await refreshProfile();
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate(ROUTES.login);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign out failed');
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading settings…" />;
  }

  if (error && !authProfile) {
    return (
      <EmptyState
        title="Could not load profile"
        description={error.message}
        actionLabel="Retry"
        onAction={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
              <CardDescription>
                Update your profile stored in Supabase
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email ?? ''}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Senior Frontend Engineer"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Remote preference</Label>
                  <Select
                    value={remotePreference}
                    onValueChange={(v) =>
                      setRemotePreference(v as Enums<'remote_preference'>)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(
                          REMOTE_PREFERENCE_LABELS,
                        ) as Enums<'remote_preference'>[]
                      ).map((key) => (
                        <SelectItem key={key} value={key}>
                          {REMOTE_PREFERENCE_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetRoles">
                  Target roles (comma-separated)
                </Label>
                <Input
                  id="targetRoles"
                  value={targetRoles}
                  onChange={(e) => setTargetRoles(e.target.value)}
                  placeholder="Frontend Engineer, Full Stack Developer"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="salaryMin">Minimum salary</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salaryCurrency">Currency</Label>
                  <Input
                    id="salaryCurrency"
                    value={salaryCurrency}
                    onChange={(e) => setSalaryCurrency(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="masterCv">Master CV text</Label>
                <Textarea
                  id="masterCv"
                  rows={6}
                  value={masterCv}
                  onChange={(e) => setMasterCv(e.target.value)}
                  placeholder="Paste your master CV content…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="portfolio">Portfolio summary</Label>
                <Textarea
                  id="portfolio"
                  rows={3}
                  value={portfolioSummary}
                  onChange={(e) => setPortfolioSummary(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Preferences</CardTitle>
              <CardDescription>
                Local preferences for this device (not synced yet)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="remoteType">Preferred Remote Type</Label>
                  <Select
                    value={preferences.remoteType}
                    onValueChange={(v) => updatePreferences('remoteType', v)}
                  >
                    <SelectTrigger id="remoteType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fully-remote">Fully Remote</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="on-site">On-site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimumSalary">Minimum Salary</Label>
                  <Input
                    id="minimumSalary"
                    value={preferences.minimumSalary}
                    onChange={(e) =>
                      updatePreferences('minimumSalary', e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredLocations">Preferred Locations</Label>
                <Input
                  id="preferredLocations"
                  value={preferences.preferredLocations}
                  onChange={(e) =>
                    updatePreferences('preferredLocations', e.target.value)
                  }
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Job Sources</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {jobSourceOptions.map((source) => (
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox
                        id={`source-${source}`}
                        checked={preferences.jobSources[source]}
                        onCheckedChange={() => toggleJobSource(source)}
                      />
                      <Label
                        htmlFor={`source-${source}`}
                        className="cursor-pointer text-sm font-normal"
                      >
                        {source}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search Preferences</CardTitle>
              <CardDescription>
                Configure how jobs are scored and filtered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minimumMatchScore">
                    Minimum Match Score (%)
                  </Label>
                  <Input
                    id="minimumMatchScore"
                    type="number"
                    value={preferences.minimumMatchScore}
                    onChange={(e) =>
                      updatePreferences('minimumMatchScore', e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="autoShortlistThreshold">
                    Auto-shortlist Threshold (%)
                  </Label>
                  <Input
                    id="autoShortlistThreshold"
                    type="number"
                    value={preferences.autoShortlistThreshold}
                    onChange={(e) =>
                      updatePreferences(
                        'autoShortlistThreshold',
                        e.target.value,
                      )
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Local toggles for a future notifications phase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {notificationItems.map((item, index) => (
                  <div key={item.key}>
                    <div className="flex items-center justify-between py-4">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-sm font-medium">
                          {item.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <Switch
                        checked={notifications[item.key]}
                        onCheckedChange={() => toggleNotification(item.key)}
                      />
                    </div>
                    {index < notificationItems.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>
                Select how JobPilot AI looks for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = appearance.theme === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleThemeChange(option.value)}
                      className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border/80 hover:bg-muted/40'
                      }`}
                    >
                      <Icon
                        className={`h-6 w-6 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                      <span
                        className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}
                      >
                        {option.label}
                      </span>
                      <span className="text-center text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Display Options</CardTitle>
              <CardDescription>
                Customize how information is shown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">Compact mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Reduce spacing and padding for a denser layout
                    </p>
                  </div>
                  <Switch
                    checked={appearance.compactMode}
                    onCheckedChange={(v) => updateAppearance('compactMode', v)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">
                      Show match scores
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Display match percentages when analysis exists
                    </p>
                  </div>
                  <Switch
                    checked={appearance.showMatchScores}
                    onCheckedChange={(v) =>
                      updateAppearance('showMatchScores', v)
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">
                      Show AI recommendations
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Display AI-powered suggestions when available
                    </p>
                  </div>
                  <Switch
                    checked={appearance.showAiRecommendations}
                    onCheckedChange={(v) =>
                      updateAppearance('showAiRecommendations', v)
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
