import type { BuildingProgram, BuildingType, FacadeSide, FinishSlot, LotShape, Orientation } from '../types/project';

export const BUILDING_TYPE_LABEL: Record<BuildingType, string> = {
  house: 'Casa',
  residential: 'Edificio residencial',
  office: 'Oficina',
  retail: 'Local comercial',
  warehouse: 'Bodega',
  hotel: 'Hotel pequeño',
  other: 'Otra construcción',
};

export const ORIENTATION_LABEL: Record<Orientation, string> = {
  N: 'Norte', NE: 'Nororiente', E: 'Oriente', SE: 'Suroriente', S: 'Sur', SW: 'Suroccidente', W: 'Occidente', NW: 'Noroccidente',
};

export const SHAPE_LABEL: Record<LotShape, string> = {
  rectangular: 'Rectangular',
  corner: 'Esquinero',
  trapezoidal: 'Trapezoidal',
  irregular: 'Irregular',
};

export const SIDE_LABEL: Record<FacadeSide, string> = {
  front: 'Frente',
  back: 'Fondo',
  left: 'Lateral izquierdo',
  right: 'Lateral derecho',
};

export const FINISH_SLOT_LABEL: Record<FinishSlot, string> = {
  walls: 'Muros exteriores',
  roof: 'Cubierta',
  floor: 'Pisos',
  frames: 'Ventanas y puertas',
};

type ProgramToggle = { [K in keyof BuildingProgram]: BuildingProgram[K] extends boolean ? K : never }[keyof BuildingProgram];

export const PROGRAM_TOGGLE_LABEL: Record<ProgramToggle, string> = {
  kitchen: 'Cocina',
  livingRoom: 'Sala',
  diningRoom: 'Comedor',
  garage: 'Garaje',
  terrace: 'Terraza',
  balcony: 'Balcón',
  garden: 'Jardín',
  pool: 'Piscina',
  laundry: 'Lavandería',
  office: 'Oficina / estudio',
};

export const PRELIMINARY_DISCLAIMER =
  'Las recomendaciones, planos, cantidades y costos generados por este sistema son preliminares y tienen fines de visualización y planificación. No sustituyen la revisión o certificación de un arquitecto, ingeniero u otro profesional competente.';
