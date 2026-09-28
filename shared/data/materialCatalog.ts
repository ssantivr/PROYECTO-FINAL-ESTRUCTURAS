import type { Finishes, Material } from '../types/project';

export const materialCatalog: Material[] = [
  {
    id: 'concrete', name: 'Concreto 3000 PSI', category: 'Estructura', slot: null,
    description: 'Concreto premezclado para cimentación, columnas, vigas y placas.',
    unit: 'm³', ratePerM2: 0.22, unitPrice: 520000, color: '#9a9a95', roughness: 0.9, metalness: 0,
  },
  {
    id: 'rebar', name: 'Acero de refuerzo', category: 'Estructura', slot: null,
    description: 'Varilla corrugada grado 60 para elementos de concreto reforzado.',
    unit: 'kg', ratePerM2: 28, unitPrice: 4800, color: '#5b6168', roughness: 0.45, metalness: 0.9,
  },
  {
    id: 'mortar', name: 'Mortero de pega', category: 'Mampostería', slot: null,
    description: 'Mortero 1:4 para pega de mampostería y nivelación.',
    unit: 'm³', ratePerM2: 0.03, unitPrice: 410000, color: '#b9b3a8', roughness: 0.95, metalness: 0,
  },
  {
    id: 'insulation', name: 'Aislamiento termoacústico', category: 'Aislamiento', slot: null,
    description: 'Lana mineral bajo cubierta; reduce pérdidas de calor en clima frío.',
    unit: 'm²', ratePerM2: 0.55, unitPrice: 24000, color: '#e4c77a', roughness: 1, metalness: 0,
  },
  {
    id: 'brick', name: 'Ladrillo estructural a la vista', category: 'Mampostería', slot: 'walls',
    description: 'Bloque de arcilla cocida; buena inercia térmica y bajo mantenimiento.',
    unit: 'und', ratePerM2: 55, unitPrice: 1250, color: '#b0643f', roughness: 0.85, metalness: 0,
  },
  {
    id: 'stucco', name: 'Pañete y pintura blanca', category: 'Fachada', slot: 'walls',
    description: 'Bloque revocado con acabado en pintura elastomérica exterior.',
    unit: 'm²', ratePerM2: 1.9, unitPrice: 38000, color: '#e2ddd2', roughness: 0.8, metalness: 0,
  },
  {
    id: 'stone', name: 'Enchape en piedra laja', category: 'Fachada', slot: 'walls',
    description: 'Piedra natural de la región; alta durabilidad frente a la lluvia.',
    unit: 'm²', ratePerM2: 1.9, unitPrice: 115000, color: '#8b857a', roughness: 0.95, metalness: 0,
  },
  {
    id: 'woodCladding', name: 'Revestimiento en madera', category: 'Fachada', slot: 'walls',
    description: 'Listones de madera inmunizada sobre cámara ventilada.',
    unit: 'm²', ratePerM2: 1.9, unitPrice: 98000, color: '#9b6a43', roughness: 0.7, metalness: 0,
  },
  {
    id: 'roofTile', name: 'Teja termoacústica', category: 'Cubierta', slot: 'roof',
    description: 'Panel sándwich con núcleo aislante; liviano y silencioso bajo lluvia.',
    unit: 'm²', ratePerM2: 0.62, unitPrice: 58000, color: '#7a3f32', roughness: 0.6, metalness: 0.1,
  },
  {
    id: 'clayTile', name: 'Teja de barro', category: 'Cubierta', slot: 'roof',
    description: 'Teja tradicional andina sobre estructura de madera.',
    unit: 'm²', ratePerM2: 0.62, unitPrice: 72000, color: '#a4532f', roughness: 0.85, metalness: 0,
  },
  {
    id: 'metalRoof', name: 'Cubierta metálica', category: 'Cubierta', slot: 'roof',
    description: 'Lámina de acero galvanizado prepintado.',
    unit: 'm²', ratePerM2: 0.62, unitPrice: 46000, color: '#6c7780', roughness: 0.35, metalness: 0.75,
  },
  {
    id: 'tile', name: 'Porcelanato', category: 'Pisos', slot: 'floor',
    description: 'Piso de alto tráfico, fácil limpieza.',
    unit: 'm²', ratePerM2: 1.05, unitPrice: 62000, color: '#d7d1c5', roughness: 0.3, metalness: 0,
  },
  {
    id: 'ceramic', name: 'Cerámica', category: 'Pisos', slot: 'floor',
    description: 'Opción económica para zonas húmedas y de servicio.',
    unit: 'm²', ratePerM2: 1.05, unitPrice: 38000, color: '#c9b8a0', roughness: 0.45, metalness: 0,
  },
  {
    id: 'woodFloor', name: 'Piso de madera', category: 'Pisos', slot: 'floor',
    description: 'Madera laminada; mayor confort térmico en clima frío.',
    unit: 'm²', ratePerM2: 1.05, unitPrice: 89000, color: '#a8743f', roughness: 0.6, metalness: 0,
  },
  {
    id: 'windows', name: 'Ventanería en aluminio y vidrio', category: 'Carpintería', slot: 'frames',
    description: 'Perfil de aluminio con vidrio templado de 6 mm.',
    unit: 'm²', ratePerM2: 0.14, unitPrice: 310000, color: '#2d5f86', roughness: 0.1, metalness: 0.4,
  },
  {
    id: 'woodWindows', name: 'Carpintería en madera', category: 'Carpintería', slot: 'frames',
    description: 'Marcos en madera con vidrio doble para mejor aislamiento.',
    unit: 'm²', ratePerM2: 0.14, unitPrice: 360000, color: '#3a5a66', roughness: 0.2, metalness: 0.1,
  },
];

export const defaultFinishes: Finishes = { walls: 'brick', roof: 'roofTile', floor: 'tile', frames: 'windows' };
