import type {
  HttpClient,
  HttpRequest,
  HttpResponse,
} from '../infrastructure/api-client/HttpClient.js';

export interface RecordedCall {
  readonly method: string;
  readonly url: string;
  readonly body?: unknown;
}

/** An HttpClient that records every call and answers with the queued response bodies. */
export class RecordingHttpClient implements HttpClient {
  readonly calls: RecordedCall[] = [];
  private readonly responses: unknown[] = [];

  respondWith(...bodies: unknown[]): void {
    this.responses.push(...bodies);
  }

  async request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
    return this.record<T>({ method: req.method, url: req.url, body: req.body });
  }

  async get<T = unknown>(url: string): Promise<HttpResponse<T>> {
    return this.record<T>({ method: 'GET', url });
  }

  async post<T = unknown>(url: string, body: unknown): Promise<HttpResponse<T>> {
    return this.record<T>({ method: 'POST', url, body });
  }

  async put<T = unknown>(url: string, body: unknown): Promise<HttpResponse<T>> {
    return this.record<T>({ method: 'PUT', url, body });
  }

  async patch<T = unknown>(url: string, body: unknown): Promise<HttpResponse<T>> {
    return this.record<T>({ method: 'PATCH', url, body });
  }

  async delete<T = unknown>(url: string): Promise<HttpResponse<T>> {
    return this.record<T>({ method: 'DELETE', url });
  }

  private record<T>(call: RecordedCall): HttpResponse<T> {
    this.calls.push(call);
    // The queued bodies are typed by each test; the client cannot check them.
    const data = this.responses.shift() as T;

    return { status: 200, data, headers: {} };
  }
}
