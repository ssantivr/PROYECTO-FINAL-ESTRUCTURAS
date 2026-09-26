import './styles/main.css';
import { createAppStore } from './core/appState';
import { h } from './core/dom';
import { sampleProject } from './data/sampleProject';
import { downloadFile, serializeSvg } from './services/persistence';
import { loadInitialProject, persistProject } from './services/projectSync';
import { ApiError } from './services/apiClient';
import { exportSheet } from './render/planDrawing';
import { RuleBasedAssistant } from './services/aiAssistant';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Workspace } from './components/Workspace';
import { Viewer3D } from './components/Viewer3D';
import { TerrainInfoPanel } from './components/TerrainInfoPanel';
import { FloorPlans } from './components/FloorPlans';
import { TerrainAnalysis } from './components/TerrainAnalysis';
import { Elevations } from './components/Elevations';
import { ProjectEditor } from './components/ProjectEditor';
import { ConstructionPanel } from './components/ConstructionPanel';
import { MaterialsPanel } from './components/MaterialsPanel';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { Toaster } from './components/Toast';

async function bootstrap(root: HTMLElement): Promise<void> {
  const initial = await loadInitialProject(sampleProject);
  const store = createAppStore(initial.project);
  const toaster = new Toaster(document.body);
  if (initial.target === 'local') toaster.show('Servidor no disponible: trabajando con copia local.', 'info', 5000);

  let saving = false;
  const save = async () => {
    if (saving) return;
    saving = true;
    const sent = store.get().project;
    try {
      const { project, target } = await persistProject(sent);
      // Keep edits made while the request was in flight.
      const changedMeanwhile = store.get().project !== sent;
      store.set(changedMeanwhile
        ? { project: { ...store.get().project, id: project.id, updatedAt: project.updatedAt } }
        : { project, dirty: false });
      toaster.show(target === 'server' ? 'Proyecto guardado en el servidor.' : 'Servidor no disponible: guardado localmente.', target === 'server' ? 'success' : 'info');
    } catch (error) {
      const details = error instanceof ApiError && Array.isArray(error.details)
        ? ` ${error.details.map((d: unknown) => (typeof d === 'string' ? d : `${(d as { path?: string }).path ?? ''}: ${(d as { message?: string }).message ?? ''}`)).join(' ')}`
        : '';
      toaster.show(`${error instanceof Error ? error.message : 'Error al guardar.'}${details}`, 'error', 6000);
    } finally {
      saving = false;
    }
  };

  const exportPlans = () => {
    const { project } = store.get();
    downloadFile(`${project.name.replace(/\s+/g, '_')}_planos.svg`, serializeSvg(exportSheet(project), project.name), 'image/svg+xml');
    toaster.show('Planos exportados en SVG (preliminares, no certificados).', 'info');
  };

  const shell = h('div', { class: 'app-shell' });
  const main = h('div', { class: 'app-main' });
  new Sidebar(store).mount(shell);
  new Header(store, { onSave: () => void save(), onExport: exportPlans }).mount(main);
  new TabBar(store).mount(main);
  new Workspace(store, [
    new Viewer3D(store),
    new TerrainInfoPanel(store),
    new FloorPlans(store),
    new TerrainAnalysis(store),
    new Elevations(store),
    new ProjectEditor(store),
    new ConstructionPanel(store),
    new MaterialsPanel(store),
    new AIAssistantPanel(store, new RuleBasedAssistant()),
  ]).mount(main);
  shell.append(main);
  root.replaceChildren(shell);

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void save();
    }
  });
  window.addEventListener('beforeunload', (e) => {
    if (store.get().dirty) e.preventDefault();
  });
}

const root = document.getElementById('app');
if (!root) throw new Error('Elemento #app no encontrado');
void bootstrap(root);
