import type { AIRequestKind, Prisma } from '@prisma/client';
import type { ZodType } from 'zod';
import type { AIEnvelope } from '../../../../shared/types/ai';
import { PRELIMINARY_DISCLAIMER } from '../../../../shared/i18n/es';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { LMStudioError, LMStudioService, parseJsonReply, type JsonSchemaFormat, type LLMMessage } from './LMStudioService';

export interface AIRequestContext {
  userId: string;
  projectId: string | null;
}

interface RunOptions<T> {
  kind: AIRequestKind;
  context: AIRequestContext;
  input: unknown;
  messages: LLMMessage[];
  structured?: { format: JsonSchemaFormat; schema: ZodType<unknown> };
  interpret: (output: unknown) => T;
  fallback: () => T;
  maxTokens?: number;
}

export interface AIStatus {
  provider: 'lmstudio' | 'none';
  baseUrl: string;
  available: boolean;
  model: string | null;
  models: string[];
  message: string;
}

const describeError = (error: unknown): string =>
  error instanceof LMStudioError ? error.message : error instanceof Error ? `Salida del modelo no utilizable: ${error.message}` : 'Error desconocido del modelo.';

export class AIService {
  constructor(private readonly llm: LMStudioService | null) {}

  async status(): Promise<AIStatus> {
    const baseUrl = this.llm?.baseUrl ?? env.AI_BASE_URL;
    if (!this.llm) {
      return { provider: 'none', baseUrl, available: false, model: null, models: [], message: 'IA local desactivada (AI_PROVIDER=none). Se usa el motor de reglas.' };
    }
    try {
      const models = await this.llm.listModels();
      const model = env.AI_MODEL || models[0] || null;
      return {
        provider: 'lmstudio',
        baseUrl,
        available: model !== null,
        model,
        models,
        message: model ? `Conectado a LM Studio · modelo ${model}` : 'LM Studio activo, pero sin modelos cargados.',
      };
    } catch (error) {
      return { provider: 'lmstudio', baseUrl, available: false, model: null, models: [], message: describeError(error) };
    }
  }

  async run<T>(options: RunOptions<T>): Promise<AIEnvelope<T>> {
    const started = Date.now();
    let envelope: AIEnvelope<T>;
    if (!this.llm) {
      envelope = this.fallback(options, 'IA local desactivada (AI_PROVIDER=none).');
    } else {
      try {
        const reply = await this.llm.chat(options.messages, options.structured?.format, options.maxTokens);
        const output = options.structured
          ? options.structured.schema.parse(parseJsonReply(reply.content))
          : reply.content;
        envelope = { source: 'lmstudio', model: reply.model, disclaimer: PRELIMINARY_DISCLAIMER, result: options.interpret(output) };
      } catch (error) {
        envelope = this.fallback(options, describeError(error));
      }
    }
    await this.record(options, envelope, Date.now() - started);
    return envelope;
  }

  private fallback<T>(options: RunOptions<T>, reason: string): AIEnvelope<T> {
    return { source: 'rules', model: null, disclaimer: PRELIMINARY_DISCLAIMER, fallbackReason: reason, result: options.fallback() };
  }

  private async record<T>(options: RunOptions<T>, envelope: AIEnvelope<T>, durationMs: number): Promise<void> {
    try {
      await prisma.aIRequest.create({
        data: {
          kind: options.kind,
          userId: options.context.userId,
          projectId: options.context.projectId,
          input: options.input as Prisma.InputJsonValue,
          generation: {
            create: {
              source: envelope.source,
              model: envelope.model,
              output: envelope.result as unknown as Prisma.InputJsonValue,
              fallbackReason: envelope.fallbackReason ?? null,
              durationMs,
            },
          },
        },
      });
    } catch (error) {
      console.error('No se pudo registrar la solicitud de IA:', error);
    }
  }
}

export const aiService = new AIService(
  env.AI_PROVIDER === 'lmstudio'
    ? new LMStudioService({ baseUrl: env.AI_BASE_URL, model: env.AI_MODEL, timeoutMs: env.AI_TIMEOUT_MS, temperature: env.AI_TEMPERATURE })
    : null,
);
