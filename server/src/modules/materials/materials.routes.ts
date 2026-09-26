import { Router } from 'express';
import { idParamSchema } from '../projects/projects.schemas';
import { materialInputSchema, materialPatchSchema, materialsService } from './materials.service';

export const materialsRouter = Router();

materialsRouter.get('/', async (_req, res) => {
  res.json(await materialsService.list());
});

materialsRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await materialsService.get(id));
});

materialsRouter.post('/', async (req, res) => {
  res.status(201).json(await materialsService.create(materialInputSchema.parse(req.body)));
});

materialsRouter.patch('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await materialsService.update(id, materialPatchSchema.parse(req.body)));
});

materialsRouter.delete('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  await materialsService.remove(id);
  res.status(204).end();
});
