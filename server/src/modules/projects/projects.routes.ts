import { Router, type Request, type Response } from 'express';
import { analysisRouter } from '../analysis/analysis.routes';
import { floorPlansRouter } from '../floorPlans/floorPlans.routes';
import { currentUser } from '../auth/auth.middleware';
import { projectsService } from './projects.service';
import { buildingSchema, finishesSchema, idParamSchema, projectInputSchema, projectPatchSchema, terrainSchema } from './projects.schemas';

export const projectsRouter = Router();

projectsRouter.get('/', async (req, res) => {
  res.json(await projectsService.list(currentUser(req).id));
});

projectsRouter.post('/', async (req, res) => {
  const project = await projectsService.create(currentUser(req).id, projectInputSchema.parse(req.body));
  res.status(201).location(`/api/projects/${project.id}`).json(project);
});

projectsRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.get(currentUser(req).id, id));
});

projectsRouter.put('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.replace(currentUser(req).id, id, projectInputSchema.parse(req.body)));
});

projectsRouter.patch('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.patch(currentUser(req).id, id, projectPatchSchema.parse(req.body)));
});

projectsRouter.delete('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await projectsService.remove(currentUser(req).id, id);
  res.status(204).end();
});

projectsRouter.get('/:id/terrain', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json((await projectsService.get(currentUser(req).id, id)).terrain);
});

const setTerrain = async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.updateTerrain(currentUser(req).id, id, terrainSchema.parse(req.body)));
};
projectsRouter.post('/:id/terrain', setTerrain);
projectsRouter.put('/:id/terrain', setTerrain);

projectsRouter.get('/:id/building', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json((await projectsService.get(currentUser(req).id, id)).building);
});

const setBuilding = async (req: Request, res: Response) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.updateBuilding(currentUser(req).id, id, buildingSchema.parse(req.body)));
};
projectsRouter.post('/:id/building', setBuilding);
projectsRouter.put('/:id/building', setBuilding);

projectsRouter.get('/:id/materials', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json((await projectsService.get(currentUser(req).id, id)).finishes);
});

projectsRouter.post('/:id/materials', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await projectsService.updateFinishes(currentUser(req).id, id, finishesSchema.parse(req.body)));
});

projectsRouter.use('/:id/floor-plans', floorPlansRouter);
projectsRouter.use('/:id', analysisRouter);
