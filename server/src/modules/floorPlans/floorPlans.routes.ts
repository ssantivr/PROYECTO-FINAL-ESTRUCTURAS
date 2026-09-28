import { Router } from 'express';
import { currentUser } from '../auth/auth.middleware';
import { idParamSchema } from '../projects/projects.schemas';
import { floorPlansService } from './floorPlans.service';

export const floorPlansRouter = Router({ mergeParams: true });

floorPlansRouter.get('/', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await floorPlansService.list(currentUser(req).id, id));
});

floorPlansRouter.post('/', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.status(201).json(await floorPlansService.generate(currentUser(req).id, id));
});
