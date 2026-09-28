import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleProject } from '../../../shared/data/sampleProject';
import { analyzeTerrainRules, answerRules, climateFor, recommendMaterialsRules, terrainInputFromProject } from '../../../shared/domain/assistantRules';
import { parseJsonReply, stripReasoning } from '../modules/ai/LMStudioService';
import { hashPassword, verifyPassword } from '../modules/auth/password';

test('passwords are salted and verified', async () => {
  const a = await hashPassword('arquila2026');
  const b = await hashPassword('arquila2026');
  assert.notEqual(a, b);
  assert.ok(await verifyPassword('arquila2026', a));
  assert.equal(await verifyPassword('otra-clave', a), false);
  assert.equal(await verifyPassword('arquila2026', 'texto-plano'), false);
});

test('model replies are parsed with fences, prose and reasoning blocks', () => {
  assert.deepEqual(parseJsonReply('Claro:\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonReply('{"a": {"b": [1, 2]}} gracias'), { a: { b: [1, 2] } });
  assert.equal(stripReasoning('<think>pienso…</think>\nRespuesta'), 'Respuesta');
  assert.throws(() => parseJsonReply('sin json'));
});

test('climate follows Colombian thermal floors', () => {
  assert.equal(climateFor(300), 'cálido');
  assert.equal(climateFor(1500), 'templado');
  assert.equal(climateFor(2527), 'frío');
  assert.equal(climateFor(3200), 'páramo');
});

test('rule-based terrain analysis returns every structured field in Spanish', () => {
  const result = analyzeTerrainRules(terrainInputFromProject(sampleProject));
  for (const value of Object.values(result)) assert.ok(value.length > 0);
  assert.match(result.placementRecommendation, /pendiente/i);
});

test('rule-based material recommendations only use catalog materials that fit the surface', () => {
  const { recommendations } = recommendMaterialsRules(sampleProject);
  assert.equal(recommendations.length, 4);
  for (const rec of recommendations) {
    assert.equal(sampleProject.materials.find((m) => m.id === rec.materialId)?.slot, rec.slot);
  }
});

test('the offline assistant answers distribution questions with the project rooms', () => {
  const reply = answerRules(sampleProject, '¿Cómo está la distribución?');
  assert.match(reply, /Planta Baja/);
  assert.match(reply, /Hab\. principal/);
});
