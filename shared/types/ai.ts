import type { RoomSpec } from '../domain/layoutGenerator';
import type { Building, FacadeSide, FinishSlot, LotShape, Orientation } from './project';

export type AISource = 'lmstudio' | 'rules' | 'external';

export interface AIEnvelope<T> {
  source: AISource;
  model: string | null;
  disclaimer: string;
  fallbackReason?: string;
  result: T;
}

export interface TerrainAnalysisInput {
  width: number;
  length: number;
  area: number;
  shape: LotShape;
  slope: number;
  elevation: number;
  orientation: Orientation;
  access: FacadeSide;
  latitude: number;
  constructionArea: number;
  gardenArea: number;
  parkingArea: number;
  poolArea: number;
  maxFloors: number;
}

export interface TerrainAnalysisResult {
  orientationRecommendation: string;
  placementRecommendation: string;
  drainageRecommendation: string;
  lightingRecommendation: string;
  ventilationRecommendation: string;
  materialRecommendation: string;
  generalNotes: string[];
}

export interface MaterialRecommendation {
  slot: FinishSlot;
  materialId: string;
  reason: string;
}

export interface MaterialRecommendationResult {
  recommendations: MaterialRecommendation[];
  notes: string[];
}

export interface LayoutSuggestionResult {
  rooms: RoomSpec[];
  building: Building;
  notes: string[];
  warnings: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  reply: string;
}
