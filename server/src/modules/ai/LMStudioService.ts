export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface JsonSchemaFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface LLMReply {
  content: string;
  model: string;
}

export class LMStudioError extends Error {}

interface ModelsResponse {
  data?: Array<{ id?: string }>;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
}

export interface LMStudioConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  temperature: number;
}

export class LMStudioService {
  constructor(private readonly config: LMStudioConfig) {}

  get baseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(path: string, init: RequestInit, timeoutMs: number): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new LMStudioError(timedOut
        ? `LM Studio no respondió en ${Math.round(timeoutMs / 1000)} s.`
        : `No hay conexión con LM Studio en ${this.baseUrl}. Verifique que el servidor local esté iniciado.`);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new LMStudioError(`LM Studio respondió ${response.status}: ${body.slice(0, 200)}`);
    }
    return (await response.json()) as T;
  }

  async listModels(): Promise<string[]> {
    const body = await this.request<ModelsResponse>('/models', { method: 'GET' }, 4000);
    return (body.data ?? []).map((m) => m.id ?? '').filter((id) => id && !/embed/i.test(id));
  }

  async resolveModel(): Promise<string> {
    if (this.config.model) return this.config.model;
    const [first] = await this.listModels();
    if (!first) throw new LMStudioError('LM Studio está activo pero no tiene ningún modelo cargado.');
    return first;
  }

  async chat(messages: LLMMessage[], format?: JsonSchemaFormat, maxTokens = 1200): Promise<LLMReply> {
    const model = await this.resolveModel();
    const body = await this.request<ChatCompletionResponse>('/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: this.config.temperature,
        max_tokens: maxTokens,
        stream: false,
        ...(format ? { response_format: { type: 'json_schema', json_schema: { name: format.name, strict: true, schema: format.schema } } } : {}),
      }),
    }, this.config.timeoutMs);
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new LMStudioError('El modelo devolvió una respuesta vacía.');
    return { content: stripReasoning(content), model: body.model ?? model };
  }
}

export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function parseJsonReply(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new LMStudioError('La respuesta del modelo no contiene JSON.');
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    throw new LMStudioError('La respuesta del modelo no es un JSON válido.');
  }
}
