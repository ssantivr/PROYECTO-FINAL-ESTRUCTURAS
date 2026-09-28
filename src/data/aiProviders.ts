import type { AIProviderDef, AppSettings } from '../types/ui';

export const AI_PROVIDERS: readonly AIProviderDef[] = [
  { id: 'auto', label: 'Automático', description: 'Servidor con LM Studio si está disponible; motor de reglas como respaldo.' },
  { id: 'server', label: 'Servidor ARQUILA', description: 'Consulta el backend Express, que usa LM Studio o reglas.' },
  { id: 'rules', label: 'Motor de reglas local', description: 'Respuestas deterministas calculadas en el navegador.' },
  { id: 'external', label: 'API externa (compatible OpenAI)', description: 'Endpoint /v1/chat/completions configurable para integraciones futuras.' },
];

export const DEFAULT_SETTINGS: AppSettings = {
  showAxes: true,
  showDimensions: true,
  autosave: false,
  aiProvider: 'auto',
  aiEndpoint: '',
  aiModel: '',
  aiApiKey: '',
};
