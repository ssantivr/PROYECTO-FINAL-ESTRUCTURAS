import { Router, type Request } from 'express';
import { z } from 'zod';
import type { ChatResult, TerrainAnalysisInput } from '../../../../shared/types/ai';
import type { Project } from '../../../../shared/types/project';
import { answerRules } from '../../../../shared/domain/assistantRules';
import { aiLimiter } from '../../http/rateLimit';
import { currentUser } from '../auth/auth.middleware';
import { materialsService } from '../materials/materials.service';
import { projectsService } from '../projects/projects.service';
import {
  buildingTypeSchema, facadeSideSchema, orientationSchema, programSchema, projectInputSchema, terrainSchema,
} from '../projects/projects.schemas';
import { aiService, type AIRequestContext } from './AIService';
import { BuildingSuggestionService } from './BuildingSuggestionService';
import { MaterialRecommendationService } from './MaterialRecommendationService';
import { TerrainAnalysisService } from './TerrainAnalysisService';
import { projectContext, SYSTEM_PROMPT } from './prompts';

const terrainAnalysis = new TerrainAnalysisService(aiService);
const materialRecommendation = new MaterialRecommendationService(aiService);
const buildingSuggestion = new BuildingSuggestionService(aiService);

const cleanText = (max: number) => z.string().transform((s) => s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim()).pipe(z.string().min(1, 'Escriba una pregunta.').max(max));

const projectIdSchema = z.string().min(1).max(40).optional();

const terrainInputSchema = z.object({
  width: z.number().positive().max(500),
  length: z.number().positive().max(500),
  area: z.number().positive().max(250_000),
  shape: z.enum(['rectangular', 'corner', 'trapezoidal', 'irregular']),
  slope: z.number().min(0).max(100),
  elevation: z.number().min(-500).max(9000),
  orientation: orientationSchema,
  access: facadeSideSchema,
  latitude: z.number().min(-90).max(90),
  constructionArea: z.number().min(0).max(250_000),
  gardenArea: z.number().min(0).max(250_000),
  parkingArea: z.number().min(0).max(250_000),
  poolArea: z.number().min(0).max(250_000),
  maxFloors: z.number().int().min(1).max(100),
}) satisfies z.ZodType<TerrainAnalysisInput>;

const chatSchema = z.object({
  projectId: projectIdSchema,
  project: projectInputSchema.optional(),
  message: cleanText(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: cleanText(4000) })).max(12).default([]),
});

const analyzeTerrainSchema = z.object({ projectId: projectIdSchema, terrain: terrainInputSchema });
const recommendMaterialsSchema = z.object({ projectId: projectIdSchema, project: projectInputSchema });
const generateLayoutSchema = z.object({
  projectId: projectIdSchema,
  terrain: terrainSchema,
  program: programSchema,
  buildingType: buildingTypeSchema,
  budget: z.number().min(0).max(1e13),
  style: z.string().trim().min(1).max(80),
});

async function contextFor(req: Request, projectId: string | undefined): Promise<AIRequestContext> {
  const userId = currentUser(req).id;
  if (projectId) await projectsService.get(userId, projectId);
  return { userId, projectId: projectId ?? null };
}

async function resolveProject(req: Request, projectId: string | undefined, draft: z.infer<typeof projectInputSchema> | undefined): Promise<Project | null> {
  if (draft) {
    return { ...draft, id: projectId ?? 'borrador', updatedAt: new Date().toISOString(), materials: await materialsService.list() };
  }
  return projectId ? projectsService.get(currentUser(req).id, projectId) : null;
}

export const aiRouter = Router();

aiRouter.get('/status', async (_req, res) => {
  res.json(await aiService.status());
});

aiRouter.post('/chat', aiLimiter, async (req, res) => {
  const body = chatSchema.parse(req.body);
  const context = await contextFor(req, body.projectId);
  const project = await resolveProject(req, body.projectId, body.project);
  const envelope = await aiService.run<ChatResult>({
    kind: 'chat',
    context,
    input: { message: body.message, historyLength: body.history.length },
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nDatos actuales del proyecto:\n${project ? projectContext(project) : 'No hay un proyecto abierto.'}` },
      ...body.history,
      { role: 'user', content: body.message },
    ],
    interpret: (output) => ({ reply: String(output) }),
    fallback: () => ({
      reply: project ? answerRules(project, body.message) : 'Abra o cree un proyecto para que pueda analizar su terreno y su construcción.',
    }),
  });
  res.json(envelope);
});

aiRouter.post('/analyze-terrain', aiLimiter, async (req, res) => {
  const body = analyzeTerrainSchema.parse(req.body);
  res.json(await terrainAnalysis.analyze(body.terrain, await contextFor(req, body.projectId)));
});

aiRouter.post('/recommend-materials', aiLimiter, async (req, res) => {
  const body = recommendMaterialsSchema.parse(req.body);
  const context = await contextFor(req, body.projectId);
  const project = await resolveProject(req, body.projectId, body.project);
  if (!project) throw new Error('Proyecto requerido.');
  res.json(await materialRecommendation.recommend(project, context));
});

aiRouter.post('/generate-layout', aiLimiter, async (req, res) => {
  const { projectId, ...request } = generateLayoutSchema.parse(req.body);
  res.json(await buildingSuggestion.generateLayout(request, await contextFor(req, projectId)));
});
