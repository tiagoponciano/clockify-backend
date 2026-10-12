export type ClockifyUser = {
  id: string;
  name: string;
  email: string;
  status?: string;
  profilePicture?: string | null;
};

export type ClockifyClient = {
  id: string;
  name: string;
  archived?: boolean;
};

export type ClockifyProject = {
  id: string;
  name: string;
  clientId?: string | null;
  archived?: boolean;
  color?: string;
};

export type ClockifyTag = {
  id: string;
  name: string;
  archived?: boolean;
};

export type ClockifyTimeInterval = {
  start: string;
  end: string | null;
  duration?: string | number | null;
};

export type ClockifyDetailedEntry = {
  _id: string;
  description?: string;
  userId: string;
  projectId?: string | null;
  clientId?: string | null;
  tagIds?: string[];
  tags?: Array<{ id?: string; name?: string }>;
  timeInterval: ClockifyTimeInterval;
};

export type ClockifyDetailedReport = {
  timeentries?: ClockifyDetailedEntry[];
};

type FetchJsonOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

export class ClockifyApiClient {
  private readonly apiBase = 'https://api.clockify.me/api/v1';
  private readonly reportsBase = 'https://reports.api.clockify.me/v1';

  constructor(
    private readonly apiKey: string,
    private readonly workspaceId: string,
  ) {}

  private async fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'X-Api-Key': this.apiKey,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    let attempt = 0;
    while (true) {
      attempt += 1;
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (response.status === 429 && attempt < 6) {
        const retryAfter = Number(response.headers.get('Retry-After') ?? '2');
        await sleep(Math.max(retryAfter, attempt) * 1000);
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Clockify ${options.method ?? 'GET'} ${url} → ${response.status}: ${text}`);
      }

      return (await response.json()) as T;
    }
  }

  async listUsers(): Promise<ClockifyUser[]> {
    return this.paginateGet<ClockifyUser>(
      `${this.apiBase}/workspaces/${this.workspaceId}/users`,
    );
  }

  async listClients(): Promise<ClockifyClient[]> {
    return this.paginateGet<ClockifyClient>(
      `${this.apiBase}/workspaces/${this.workspaceId}/clients`,
    );
  }

  async listProjects(): Promise<ClockifyProject[]> {
    return this.paginateGet<ClockifyProject>(
      `${this.apiBase}/workspaces/${this.workspaceId}/projects`,
      { 'archived': 'false' },
    ).then(async (active) => {
      const archived = await this.paginateGet<ClockifyProject>(
        `${this.apiBase}/workspaces/${this.workspaceId}/projects`,
        { archived: 'true' },
      );
      const byId = new Map<string, ClockifyProject>();
      for (const project of [...active, ...archived]) {
        byId.set(project.id, project);
      }
      return [...byId.values()];
    });
  }

  async listTags(): Promise<ClockifyTag[]> {
    return this.paginateGet<ClockifyTag>(
      `${this.apiBase}/workspaces/${this.workspaceId}/tags`,
    );
  }

  async detailedReportPage(input: {
    dateRangeStart: string;
    dateRangeEnd: string;
    page: number;
    pageSize: number;
  }): Promise<ClockifyDetailedEntry[]> {
    const json = await this.fetchJson<ClockifyDetailedReport>(
      `${this.reportsBase}/workspaces/${this.workspaceId}/reports/detailed`,
      {
        method: 'POST',
        body: {
          dateRangeStart: input.dateRangeStart,
          dateRangeEnd: input.dateRangeEnd,
          detailedFilter: {
            sortColumn: 'DATE',
            page: input.page,
            pageSize: input.pageSize,
          },
        },
      },
    );
    return json.timeentries ?? [];
  }

  private async paginateGet<T>(
    baseUrl: string,
    extraQuery: Record<string, string> = {},
  ): Promise<T[]> {
    const pageSize = 200;
    let page = 1;
    const all: T[] = [];

    while (true) {
      const query = new URLSearchParams({
        page: String(page),
        'page-size': String(pageSize),
        ...extraQuery,
      });
      const batch = await this.fetchJson<T[]>(`${baseUrl}?${query.toString()}`);
      all.push(...batch);
      if (batch.length < pageSize) {
        break;
      }
      page += 1;
    }

    return all;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
