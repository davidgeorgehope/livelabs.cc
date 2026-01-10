const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type FetchOptions = RequestInit & {
  token?: string | null;
};

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
  created_at: string;
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

export interface TrackCreate {
  title: string;
  slug: string;
  description?: string;
  docker_image?: string;
  env_template?: EnvVar[];
}

export interface TrackUpdate {
  title?: string;
  description?: string;
  docker_image?: string;
  is_published?: boolean;
  env_template?: EnvVar[];
}

export const tracks = {
  listPublic: () => fetchAPI<Track[]>("/tracks/public"),

  listMy: (token: string) =>
    fetchAPI<Track[]>("/tracks/my", { token }),

  get: (slug: string, token?: string) =>
    fetchAPI<TrackWithSteps>(`/tracks/${slug}`, { token }),

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
  environment: Record<string, string>;
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
  environment: Record<string, string>;
}

export const enrollments = {
  list: (token: string) =>
    fetchAPI<EnrollmentWithTrack[]>("/enrollments", { token }),

  create: (data: EnrollmentCreate, token: string) =>
    fetchAPI<Enrollment>("/enrollments", {
      method: "POST",
      body: JSON.stringify(data),
      token,
    }),

  get: (id: number, token: string) =>
    fetchAPI<EnrollmentDetail>(`/enrollments/${id}`, { token }),

  updateEnv: (id: number, environment: Record<string, string>, token: string) =>
    fetchAPI<Enrollment>(`/enrollments/${id}/environment`, {
      method: "PATCH",
      body: JSON.stringify(environment),
      token,
    }),

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
};
