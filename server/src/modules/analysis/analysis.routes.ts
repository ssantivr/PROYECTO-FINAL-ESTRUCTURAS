import { Router } from 'express';
import { computeMetrics } from '../../../../shared/domain/metrics';
import { constructionSchedule, estimateMaterials, totalCost } from '../../../../shared/domain/materials';
import { longitudinalProfile, monthlyInsolation, slopeDistribution } from '../../../../shared/domain/terrainAnalysis';
import { idParamSchema } from '../projects/projects.schemas';
import { projectsService } from '../projects/projects.service';
import { currentUser } from '../auth/auth.middleware';

export const analysisRouter = Router({ mergeParams: true });

analysisRouter.get('/metrics', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const project = await projectsService.get(currentUser(req).id, id);
  res.json(computeMetrics(project));
});

analysisRouter.get('/terrain-analysis', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { terrain } = await projectsService.get(currentUser(req).id, id);
  res.json({
    profile: longitudinalProfile(terrain),
    slopeDistribution: slopeDistribution(terrain),
    insolation: monthlyInsolation(terrain.latitude),
  });
});

analysisRouter.get('/estimate', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const project = await projectsService.get(currentUser(req).id, id);
  const materials = estimateMaterials(project).map(({ material, quantity, cost }) => ({
    slot: material.slot,
    materialId: material.id,
    name: material.name,
    category: material.category,
    unit: material.unit,
    quantity: Math.round(quantity * 100) / 100,
    unitPrice: material.unitPrice,
    cost: Math.round(cost),
  }));
  const schedule = constructionSchedule(project);
  res.json({
    currency: 'COP',
    totalCost: Math.round(totalCost(estimateMaterials(project))),
    totalWeeks: schedule.reduce((sum, phase) => sum + phase.weeks, 0),
    materials,
    schedule,
  });
});
