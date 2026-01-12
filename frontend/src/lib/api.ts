const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "") + "/api";

type FetchOptions = RequestInit & {
  token?: string | null;
};

// Generic paginated response
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

async function fetchAPI<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "An error occurred" }));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  org_slug?: string;
  invite_code?: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  is_author: boolean;
  is_admin: boolean;
  org_id: number;
  created_at: string;
  organization?: Organization;
}

export interface Organization {
  id: number;
  slug: string;
  name: string;
  created_at: string;
}

export interface OrganizationPublic {
  id: number;
  slug: string;
  name: string;
}

export interface OrganizationCreateRequest {
  name: string;
  slug?: string;
}

export const auth = {
  login: (data: LoginRequest) =>
    fetchAPI<Token>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  register: (data: RegisterRequest) =>
    fetchAPI<Token>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: (token: string) =>
    fetchAPI<User>("/auth/me", { token }),

  refresh: (token: string) =>
    fetchAPI<Token>("/auth/refresh", {
      method: "POST",
      token,
    }),
};

// Invite Codes
export interface InviteCode {
  id: number;
  code: string;
  org_id: number;
  max_uses: number | null;
  uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface InviteCodeCreate {
  max_uses?: number | null;
  expires_in_days?: number | null;
}

export interface InviteCodeValidation {
  valid: boolean;
  organization?: OrganizationPublic;
  message: string;
}

// Organizations
export const organizations = {
  listPublic: () =>
    fetchAPI<OrganizationPublic[]>("/organizations/public"),

  create: (data: OrganizationCreateRequest, token: string) =>
    fetchAPI<Organization>("/organizations", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  getMy: (token: string) =>
    fetchAPI<Organization>("/organizations/my", { token }),

  join: (slug: string, token: string) =>
    fetchAPI<User>(`/organizations/${slug}/join`, {
      method: "POST",
      token,
    }),

  // Invite codes
  validateInviteCode: (code: string) =>
    fetchAPI<InviteCodeValidation>(`/organizations/invite/${code}`),

  createInviteCode: (data: InviteCodeCreate, token: string) =>
    fetchAPI<InviteCode>("/organizations/my/invite-codes", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  listInviteCodes: (token: string) =>
    fetchAPI<InviteCode[]>("/organizations/my/invite-codes", { token }),

  deleteInviteCode: (code: string, token: string) =>
    fetchAPI<void>(`/organizations/my/invite-codes/${code}`, {
      method: "DELETE",
      token,
    }),
};

// Tracks
export interface EnvVar {
  name: string;
  description: string;
  required: boolean;
}

export interface Track {
  id: number;
  slug: string;
  title: string;
  description: string;
  docker_image: string;
  is_published: boolean;
  author_id: number;
  org_id: number;
  env_template: EnvVar[];
  tags: string[];
  difficulty: string;
  estimated_minutes: number | null;
  created_at: string;
  // App configuration
  app_url_template: string | null;
  app_container_image: string | null;
  app_container_ports: { container: number; host: number | null }[];
  app_container_command: string | null;
  app_container_lifecycle: "enrollment" | "step";
  app_container_env: Record<string, string>;
  auto_run_setup: boolean;
  auto_login_type: "none" | "url_params" | "cookies";
  auto_login_config: {
    params?: Record<string, string>;
    cookies?: { name: string; value: string; domain?: string }[];
  };
  init_script: string | null;
}

export interface Step {
  id: number;
  track_id: number;
  order: number;
  title: string;
  instructions_md: string;
  setup_script: string;
  validation_script: string;
  hints: string[];
}

export interface TrackWithSteps extends Track {
  steps: Step[];
  author: User;
}

export interface TrackWithSecrets extends Track {
  env_secrets: Record<string, string>;
}

export interface TrackWithStepsAndSecrets extends TrackWithSecrets {
  steps: Step[];
  author: User;
}

export interface TrackCreate {
  title: string;
  slug: string;
  description?: string;
  docker_image?: string;
  env_template?: EnvVar[];
  env_secrets?: Record<string, string>;
  tags?: string[];
  difficulty?: string;
  estimated_minutes?: number;
}

export interface TrackUpdate {
  title?: string;
  description?: string;
  docker_image?: string;
  is_published?: boolean;
  env_template?: EnvVar[];
  env_secrets?: Record<string, string>;
  tags?: string[];
  difficulty?: string;
  estimated_minutes?: number;
  // App configuration
  app_url_template?: string | null;
  app_container_image?: string | null;
  app_container_ports?: { container: number; host: number | null }[];
  app_container_command?: string | null;
  app_container_lifecycle?: "enrollment" | "step";
  app_container_env?: Record<string, string>;
  auto_run_setup?: boolean;
  auto_login_type?: "none" | "url_params" | "cookies";
  auto_login_config?: {
    params?: Record<string, string>;
    cookies?: { name: string; value: string; domain?: string }[];
  };
  init_script?: string | null;
}

export interface TrackSearchParams {
  q?: string;
  tag?: string;
  difficulty?: string;
  sort?: "newest" | "oldest" | "title";
  page?: number;
  page_size?: number;
}

export const tracks = {
  // List tracks in user's organization (requires auth)
  list: (params: TrackSearchParams | undefined, token: string) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.tag) searchParams.set("tag", params.tag);
    if (params?.difficulty) searchParams.set("difficulty", params.difficulty);
    if (params?.sort) searchParams.set("sort", params.sort);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    const query = searchParams.toString();
    return fetchAPI<PaginatedResponse<Track>>(`/tracks${query ? `?${query}` : ""}`, { token });
  },

  // List tags from user's organization (requires auth)
  listTags: (token: string) => fetchAPI<string[]>("/tracks/tags", { token }),

  listMy: (token: string) =>
    fetchAPI<TrackWithSecrets[]>("/tracks/my", { token }),

  // Get track details (requires auth, scoped to user's org)
  get: (slug: string, token: string) =>
    fetchAPI<TrackWithSteps>(`/tracks/${slug}`, { token }),

  getForEditing: (slug: string, token: string) =>
    fetchAPI<TrackWithStepsAndSecrets>(`/tracks/${slug}/edit`, { token }),

  create: (data: TrackCreate, token: string) =>
    fetchAPI<Track>("/tracks", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  update: (slug: string, data: TrackUpdate, token: string) =>
    fetchAPI<Track>(`/tracks/${slug}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    }),

  delete: (slug: string, token: string) =>
    fetchAPI<void>(`/tracks/${slug}`, {
      method: "DELETE",
      token,
    }),
};

// Steps
export interface StepCreate {
  title: string;
  instructions_md?: string;
  setup_script?: string;
  validation_script?: string;
  hints?: string[];
}

export interface StepUpdate {
  title?: string;
  instructions_md?: string;
  setup_script?: string;
  validation_script?: string;
  hints?: string[];
  order?: number;
}

export const steps = {
  create: (trackSlug: string, data: StepCreate, token: string) =>
    fetchAPI<Step>(`/tracks/${trackSlug}/steps`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  update: (trackSlug: string, stepId: number, data: StepUpdate, token: string) =>
    fetchAPI<Step>(`/tracks/${trackSlug}/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    }),

  delete: (trackSlug: string, stepId: number, token: string) =>
    fetchAPI<void>(`/tracks/${trackSlug}/steps/${stepId}`, {
      method: "DELETE",
      token,
    }),
};

// Enrollments
export interface Enrollment {
  id: number;
  user_id: number;
  track_id: number;
  current_step: number;
  started_at: string;
  completed_at: string | null;
}

export interface EnrollmentWithTrack extends Enrollment {
  track: Track;
}

export interface EnrollmentDetail extends Enrollment {
  track: TrackWithSteps;
}

export interface EnrollmentCreate {
  track_slug: string;
}

export interface EnrollmentListParams {
  page?: number;
  page_size?: number;
  status?: "active" | "completed";
}

export const enrollments = {
  list: (token: string, params?: EnrollmentListParams) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.page_size) searchParams.set("page_size", params.page_size.toString());
    if (params?.status) searchParams.set("status_filter", params.status);
    const query = searchParams.toString();
    return fetchAPI<PaginatedResponse<EnrollmentWithTrack>>(`/enrollments${query ? `?${query}` : ""}`, { token });
  },

  create: (trackSlug: string, token: string) =>
    fetchAPI<Enrollment>("/enrollments", {
      method: "POST",
      body: JSON.stringify({ track_slug: trackSlug }),
      token,
    }),

  get: (id: number, token: string) =>
    fetchAPI<EnrollmentDetail>(`/enrollments/${id}`, { token }),

  delete: (id: number, token: string) =>
    fetchAPI<void>(`/enrollments/${id}`, {
      method: "DELETE",
      token,
    }),
};

// Execution
export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  advanced: boolean;
}

export interface AutoSetupResult {
  skipped: boolean;
  reason?: string;
  success: boolean;
  cached?: boolean;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  duration_ms?: number;
}

export const execution = {
  run: (
    enrollmentId: number,
    stepOrder: number,
    scriptType: "setup" | "validation",
    token: string
  ) =>
    fetchAPI<ExecutionResult>(
      `/enrollments/${enrollmentId}/steps/${stepOrder}/execute`,
      {
        method: "POST",
        body: JSON.stringify({ script_type: scriptType }),
        token,
      }
    ),

  autoSetup: (
    enrollmentId: number,
    stepOrder: number,
    token: string
  ) =>
    fetchAPI<AutoSetupResult>(
      `/enrollments/${enrollmentId}/steps/${stepOrder}/execute/auto-setup`,
      {
        method: "POST",
        token,
      }
    ),
};

// App Container
export interface AppContainerStatus {
  status: "no_app" | "needs_init" | "initializing" | "init_failed" | "ready" | "external" | "stopped" | "starting" | "running" | "failed" | "error";
  has_app: boolean;
  type?: "external" | "container";
  url?: string;
  cookies?: { name: string; value: string; domain?: string }[];
  ports?: Record<string, number>;
  can_start?: boolean;
  can_restart?: boolean;
  restart_count?: number;
  started_at?: string;
  message?: string;
  error?: string;
}

export interface InitResult {
  status: "success" | "failed" | "running";
  url?: string;
  cookies?: { name: string; value: string; domain?: string }[];
  error?: string;
  message?: string;
}

export const appContainer = {
  getStatus: (enrollmentId: number, token: string) =>
    fetchAPI<AppContainerStatus>(`/enrollments/${enrollmentId}/app`, { token }),

  init: (enrollmentId: number, token: string) =>
    fetchAPI<InitResult>(`/enrollments/${enrollmentId}/app/init`, {
      method: "POST",
      token,
    }),

  start: (enrollmentId: number, token: string) =>
    fetchAPI<AppContainerStatus>(`/enrollments/${enrollmentId}/app/start`, {
      method: "POST",
      token,
    }),

  restart: (enrollmentId: number, token: string) =>
    fetchAPI<AppContainerStatus>(`/enrollments/${enrollmentId}/app/restart`, {
      method: "POST",
      token,
    }),

  stop: (enrollmentId: number, token: string) =>
    fetchAPI<{ status: string; message: string }>(`/enrollments/${enrollmentId}/app/stop`, {
      method: "POST",
      token,
    }),
};

// Achievements
export interface Achievement {
  id: number;
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  xp_value: number;
}

export interface UserAchievement {
  id: number;
  achievement: Achievement;
  earned_at: string;
}

export interface UserStats {
  total_xp: number;
  tracks_completed: number;
  achievements_count: number;
  achievements: UserAchievement[];
}

export interface CertificateData {
  user_name: string;
  track_title: string;
  completed_at: string;
  certificate_id: string;
}

export const achievements = {
  getMyStats: (token: string) =>
    fetchAPI<UserStats>("/achievements/my", { token }),

  listAll: () =>
    fetchAPI<Achievement[]>("/achievements/all"),

  getCertificate: (enrollmentId: number, token: string) =>
    fetchAPI<CertificateData>(`/achievements/certificate/${enrollmentId}`, { token }),
};

// AI
export interface HelpRequest {
  step_instructions: string;
  step_title: string;
  error_output?: string;
  question?: string;
}

export interface HelpResponse {
  response: string;
  suggestions: string[];
}

export interface ExplainCodeRequest {
  code: string;
  language?: string;
  context?: string;
}

export interface ExplainCodeResponse {
  explanation: string;
  line_by_line: { line: string; explanation: string }[];
}

export interface GenerateInstructionsRequest {
  title: string;
  bullet_points: string[];
  track_context?: string;
}

export interface GenerateInstructionsResponse {
  instructions_md: string;
}

export interface GenerateValidationRequest {
  step_title: string;
  expected_outcome: string;
  setup_script?: string;
}

export interface GenerateValidationResponse {
  validation_script: string;
  hints: string[];
}

export interface GenerateHintsRequest {
  step_title: string;
  instructions: string;
  validation_script: string;
}

export interface GenerateHintsResponse {
  hints: string[];
}

export interface GenerateInitScriptRequest {
  track_title: string;
  track_description?: string;
  app_type?: string;  // "saas_sandbox", "docker_app", "external_url"
  env_secret_names?: string[];
  example_url?: string;
  additional_context?: string;
}

export interface GenerateInitScriptResponse {
  init_script: string;
  notes: string[];
}

export const ai = {
  getHelp: (data: HelpRequest, token: string) =>
    fetchAPI<HelpResponse>("/ai/help", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  explainCode: (data: ExplainCodeRequest, token: string) =>
    fetchAPI<ExplainCodeResponse>("/ai/explain-code", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  generateInstructions: (data: GenerateInstructionsRequest, token: string) =>
    fetchAPI<GenerateInstructionsResponse>("/ai/generate-instructions", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  generateValidation: (data: GenerateValidationRequest, token: string) =>
    fetchAPI<GenerateValidationResponse>("/ai/generate-validation", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  generateHints: (data: GenerateHintsRequest, token: string) =>
    fetchAPI<GenerateHintsResponse>("/ai/generate-hints", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  generateInitScript: (data: GenerateInitScriptRequest, token: string) =>
    fetchAPI<GenerateInitScriptResponse>("/ai/generate-init-script", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),
};

// GitHub
export interface GitHubConnection {
  id: number;
  github_username: string;
  connected_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
}

export interface TrackGitSync {
  id: number;
  track_id: number;
  repo_owner: string;
  repo_name: string;
  branch: string;
  last_sync_at: string | null;
  last_sync_sha: string | null;
}

export interface TrackExport {
  title: string;
  slug: string;
  description: string | null;
  docker_image: string;
  tags: string[];
  difficulty: string;
  estimated_minutes: number | null;
  env_template: { name: string; description: string; required: boolean }[];
  steps: {
    order: number;
    title: string;
    instructions_md: string;
    setup_script: string;
    validation_script: string;
    hints: string[];
  }[];
}

export interface SetupSyncRequest {
  repo_owner: string;
  repo_name: string;
  branch?: string;
}

export const github = {
  getAuthUrl: (token: string) =>
    fetchAPI<{ auth_url: string }>("/github/auth/url", { token }),

  callback: (code: string, state: string, token: string) =>
    fetchAPI<{ message: string; username: string }>("/github/auth/callback", {
      method: "POST",
      body: JSON.stringify({ code, state }),
      token,
    }),

  getConnection: (token: string) =>
    fetchAPI<GitHubConnection | null>("/github/connection", { token }),

  disconnect: (token: string) =>
    fetchAPI<{ message: string }>("/github/connection", {
      method: "DELETE",
      token,
    }),

  listRepos: (token: string) =>
    fetchAPI<GitHubRepo[]>("/github/repos", { token }),

  exportTrack: (slug: string, token: string) =>
    fetchAPI<TrackExport>(`/github/tracks/${slug}/export`, { token }),

  importTrack: (data: TrackExport, token: string) =>
    fetchAPI<{ message: string; track_id: number; slug: string }>("/github/tracks/import", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  getTrackSync: (slug: string, token: string) =>
    fetchAPI<TrackGitSync | null>(`/github/tracks/${slug}/sync`, { token }),

  setupTrackSync: (slug: string, data: SetupSyncRequest, token: string) =>
    fetchAPI<TrackGitSync>(`/github/tracks/${slug}/sync/setup`, {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  pushTrack: (slug: string, token: string) =>
    fetchAPI<{ message: string; commit_sha: string; file_path: string }>(`/github/tracks/${slug}/sync/push`, {
      method: "POST",
      token,
    }),

  pullTrack: (slug: string, token: string) =>
    fetchAPI<{ message: string; commit_sha: string }>(`/github/tracks/${slug}/sync/pull`, {
      method: "POST",
      token,
    }),

  removeTrackSync: (slug: string, token: string) =>
    fetchAPI<{ message: string }>(`/github/tracks/${slug}/sync`, {
      method: "DELETE",
      token,
    }),
};

// Analytics
export interface StepAnalytics {
  step_id: number;
  step_order: number;
  step_title: string;
  attempts: number;
  completions: number;
  completion_rate: number;
  avg_attempts: number;
  avg_duration_ms: number | null;
  common_errors: string[];
}

export interface TrackAnalytics {
  track_id: number;
  track_title: string;
  track_slug: string;
  total_enrollments: number;
  active_enrollments: number;
  completions: number;
  completion_rate: number;
  avg_completion_time_hours: number | null;
  steps: StepAnalytics[];
}

export interface TrackSummary {
  track_id: number;
  track_title: string;
  track_slug: string;
  enrollments: number;
  completions: number;
  completion_rate: number;
}

export interface OverviewAnalytics {
  total_tracks: number;
  published_tracks: number;
  total_enrollments: number;
  total_completions: number;
  tracks: TrackSummary[];
}

export interface TimeSeriesPoint {
  date: string;
  enrollments: number;
  completions: number;
}

export interface EnrollmentTimeline {
  track_id: number;
  track_title: string;
  data: TimeSeriesPoint[];
}

export interface DropoffStep {
  step_order: number;
  step_title: string;
  stuck: number;
  passed: number;
  dropoff_rate: number;
}

export interface DropoffAnalysis {
  total_enrollments: number;
  steps: DropoffStep[];
}

export const analytics = {
  getOverview: (token: string) =>
    fetchAPI<OverviewAnalytics>("/analytics/overview", { token }),

  getTrackAnalytics: (slug: string, token: string) =>
    fetchAPI<TrackAnalytics>(`/analytics/tracks/${slug}`, { token }),

  getTrackTimeline: (slug: string, days: number, token: string) =>
    fetchAPI<EnrollmentTimeline>(`/analytics/tracks/${slug}/timeline?days=${days}`, { token }),

  getDropoffAnalysis: (slug: string, token: string) =>
    fetchAPI<DropoffAnalysis>(`/analytics/tracks/${slug}/dropoff`, { token }),
};

// Admin
export interface AdminUser {
  id: number;
  email: string;
  name: string;
  is_author: boolean;
  is_admin: boolean;
  is_active: boolean;
  org_id: number;
  organization_name: string | null;
  created_at: string;
  tracks_count: number;
  enrollments_count: number;
}

export interface AdminOrganization {
  id: number;
  slug: string;
  name: string;
  created_at: string;
  users_count: number;
  tracks_count: number;
}

export interface SystemStats {
  total_users: number;
  total_authors: number;
  total_admins: number;
  total_organizations: number;
  total_tracks: number;
  published_tracks: number;
  total_enrollments: number;
  completed_enrollments: number;
  total_executions: number;
  active_users_7d: number;
  new_users_7d: number;
}

export interface UserUpdate {
  is_author?: boolean;
  is_admin?: boolean;
  is_active?: boolean;
}

export const admin = {
  getStats: (token: string) =>
    fetchAPI<SystemStats>("/admin/stats", { token }),

  listUsers: (token: string, params?: { search?: string; org_id?: number; is_author?: boolean; is_admin?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.org_id) searchParams.set("org_id", params.org_id.toString());
    if (params?.is_author !== undefined) searchParams.set("is_author", params.is_author.toString());
    if (params?.is_admin !== undefined) searchParams.set("is_admin", params.is_admin.toString());
    const query = searchParams.toString();
    return fetchAPI<AdminUser[]>(`/admin/users${query ? `?${query}` : ""}`, { token });
  },

  getUser: (userId: number, token: string) =>
    fetchAPI<AdminUser>(`/admin/users/${userId}`, { token }),

  updateUser: (userId: number, data: UserUpdate, token: string) =>
    fetchAPI<AdminUser>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    }),

  listOrganizations: (token: string, search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return fetchAPI<AdminOrganization[]>(`/admin/organizations${query}`, { token });
  },

  getOrganization: (orgId: number, token: string) =>
    fetchAPI<AdminOrganization>(`/admin/organizations/${orgId}`, { token }),

  updateOrganization: (orgId: number, data: { name?: string }, token: string) =>
    fetchAPI<AdminOrganization>(`/admin/organizations/${orgId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      token,
    }),
};

// Infrastructure
export interface DockerImage {
  image: string;
  size_mb: number;
  created: string | null;
  id: string | null;
}

export interface ImageStatus {
  image: string;
  status: "available" | "not_found" | "pulling" | "error";
  size_mb?: number;
  created?: string | null;
  id?: string | null;
  error?: string;
  started_at?: string;
}

export interface DiskUsage {
  images: { count: number; size_mb: number; reclaimable_mb: number };
  containers: { count: number; size_mb: number };
  volumes: { count: number; size_mb: number };
}

export interface TrackImage {
  image: string;
  track_count: number;
  tracks: { slug: string; title: string }[];
  cached: boolean;
  size_mb: number;
}

export interface PruneResult {
  containers_removed: number;
  images_removed: number;
  space_reclaimed_mb: number;
}

export const infrastructure = {
  listImages: (token: string) =>
    fetchAPI<DockerImage[]>("/infrastructure/images", { token }),

  getImageStatus: (image: string, token: string) =>
    fetchAPI<ImageStatus>(`/infrastructure/images/${encodeURIComponent(image)}`, { token }),

  pullImage: (image: string, background: boolean, token: string) =>
    fetchAPI<ImageStatus>(`/infrastructure/images/pull?background=${background}`, {
      method: "POST",
      body: JSON.stringify({ image }),
      token,
    }),

  warmupImages: (images: string[], token: string) =>
    fetchAPI<Record<string, ImageStatus>>("/infrastructure/images/warmup", {
      method: "POST",
      body: JSON.stringify({ images }),
      token,
    }),

  removeImage: (image: string, force: boolean, token: string) =>
    fetchAPI<{ image: string; status: string }>(`/infrastructure/images/${encodeURIComponent(image)}?force=${force}`, {
      method: "DELETE",
      token,
    }),

  getDiskUsage: (token: string) =>
    fetchAPI<DiskUsage>("/infrastructure/disk-usage", { token }),

  prune: (token: string) =>
    fetchAPI<PruneResult>("/infrastructure/prune", {
      method: "POST",
      token,
    }),

  getTrackImages: (token: string) =>
    fetchAPI<TrackImage[]>("/infrastructure/track-images", { token }),

  warmupTrackImages: (token: string) =>
    fetchAPI<Record<string, ImageStatus>>("/infrastructure/warmup-track-images", {
      method: "POST",
      token,
    }),
};
