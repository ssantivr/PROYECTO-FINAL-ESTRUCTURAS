import { Router } from 'express';
import { analysisRouter } from '../analysis/analysis.routes';
import { projectsService } from './projects.service';
import { idParamSchema, projectInputSchema, projectPatchSchema, terrainSchema } from './projects.schemas';

export const projectsRouter = Router();

projectsRouter.get('/', async (_req, res) => {
  res.json(await projectsService.list());
});

projectsRouter.post('/', async (req, res) => {
  const project = await projectsService.create(projectInputSchema.parse(req.body));
  res.status(201).location(`/api/projects/${project.id}`).json(project);
});

projectsRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.get(id));
});

projectsRouter.put('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.replace(id, projectInputSchema.parse(req.body)));
});

projectsRouter.patch('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.patch(id, projectPatchSchema.parse(req.body)));
});

projectsRouter.delete('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await projectsService.remove(id);
  res.status(204).end();
});

projectsRouter.put('/:id/terrain', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.updateTerrain(id, terrainSchema.parse(req.body)));
});

projectsRouter.use('/:id', analysisRouter);
