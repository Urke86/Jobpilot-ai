import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useTheme, type ThemeMode } from '@/contexts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileState {
  fullName: string;
  email: string;
  title: string;
  bio: string;
}

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

// ---------------------------------------------------------------------------
// Notification items config
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Theme options config
// ---------------------------------------------------------------------------

const themeOptions: {
  value: AppearanceState['theme'];
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  { value: 'light', label: 'Light', icon: Sun, description: 'Light background with dark text' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Dark background with light text' },
  { value: 'system', label: 'System', icon: Monitor, description: 'Follows your OS setting' },
];

// ---------------------------------------------------------------------------
// Job‑source options
// ---------------------------------------------------------------------------

const jobSourceOptions = [
  'LinkedIn',
  'Indeed',
  'AngelList',
  'Remote OK',
  'Wellfound',
  'Company Websites',
];

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  // Profile state
  const [profile, setProfile] = useState<ProfileState>({
    fullName: 'Alex Johnson',
    email: 'alex@example.com',
    title: 'Senior Frontend Engineer',
    bio: '',
  });

  // Preferences state
  const [preferences, setPreferences] = useState<PreferencesState>({
    remoteType: 'fully-remote',
    minimumSalary: '$120,000',
    preferredLocations: 'Remote, USA, Europe',
    jobSources: Object.fromEntries(jobSourceOptions.map((s) => [s, true])),
    minimumMatchScore: '70',
    autoShortlistThreshold: '85',
  });

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationsState>({
    newJobMatches: true,
    applicationStatus: true,
    interviewReminders: true,
    weeklySummary: false,
    aiAnalysisComplete: true,
    companyUpdates: false,
  });

  // Appearance state
  const [appearance, setAppearance] = useState<AppearanceState>({
    theme,
    compactMode: false,
    showMatchScores: true,
    showAiRecommendations: true,
  });

  // Keep local appearance.theme in sync with ThemeContext
  useEffect(() => {
    setAppearance((prev) => ({ ...prev, theme }));
  }, [theme]);

  // ------ Handlers ------

  const updateProfile = (field: keyof ProfileState, value: string) =>
    setProfile((prev) => ({ ...prev, [field]: value }));

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

  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your preferences
        </p>
      </div>

      {/* Tabbed Sections */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* Profile Tab                                                    */}
        {/* ============================================================== */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
              <CardDescription>
                Update your personal details and public profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={profile.fullName}
                    onChange={(e) => updateProfile('fullName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => updateProfile('email', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title / Role</Label>
                <Input
                  id="title"
                  value={profile.title}
                  onChange={(e) => updateProfile('title', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profile.bio}
                  onChange={(e) => updateProfile('bio', e.target.value)}
                  placeholder="Tell us a bit about yourself and your career goals..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* Preferences Tab                                                */}
        {/* ============================================================== */}
        <TabsContent value="preferences" className="space-y-6">
          {/* Job Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Job Preferences</CardTitle>
              <CardDescription>
                Define what you're looking for in your next role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {jobSourceOptions.map((source) => (
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox
                        id={`source-${source}`}
                        checked={preferences.jobSources[source]}
                        onCheckedChange={() => toggleJobSource(source)}
                      />
                      <Label
                        htmlFor={`source-${source}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {source}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Search Preferences</CardTitle>
              <CardDescription>
                Configure how jobs are scored and filtered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <p className="text-xs text-muted-foreground">
                    Jobs below this score won't appear in your feed
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Jobs above this score are automatically shortlisted
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================== */}
        {/* Notifications Tab                                              */}
        {/* ============================================================== */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose which notifications you'd like to receive
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

        {/* ============================================================== */}
        {/* Appearance Tab                                                 */}
        {/* ============================================================== */}
        <TabsContent value="appearance" className="space-y-6">
          {/* Theme Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>
                Select how JobPilot AI looks for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = appearance.theme === option.value;
                  return (
                    <button
                      key={option.value}
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
                      <span className="text-xs text-muted-foreground text-center">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Display Toggles */}
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
                      Display AI-generated match percentages on job cards
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
                      Display AI-powered suggestions and insights throughout the
                      app
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
