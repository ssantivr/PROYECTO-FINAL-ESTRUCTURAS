import './styles/main.css';
import { createAppStore, type AppStore } from './state/appState';
import { h } from './core/dom';
import { api, ApiError, describeApiError, hasAuthToken, setAuthToken, UNAUTHORIZED_EVENT, type AuthUser } from './services/apiClient';
import { createProject, deleteProject, loadLocalProject, loadServerProject, openProject, persistProject, refreshProjects } from './services/projectSync';
import { exportPdf } from './services/pdfExport';
import { showAuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Workspace } from './components/Workspace';
import { DashboardPanel } from './components/DashboardPanel';
import { ProjectsPanel } from './components/ProjectsPanel';
import { ProjectEditor } from './components/ProjectEditor';
import { TerrainForm } from './components/TerrainForm';
import { TerrainAnalysis } from './components/TerrainAnalysis';
import { ProgramPanel } from './components/ProgramPanel';
import { ConstructionPanel } from './components/ConstructionPanel';
import { FloorPlans } from './components/FloorPlans';
import { Elevations } from './components/Elevations';
import { MaterialsPanel } from './components/MaterialsPanel';
import { AIAssistantPanel } from './components/AIAssistantPanel';
import { Viewer3D } from './components/Viewer3D';
import { TerrainInfoPanel } from './components/TerrainInfoPanel';
import { Toaster } from './components/Toast';
import { TerrainViewer } from './components/TerrainViewer';
import { TerrainInsights } from './components/TerrainInsights';
import { PlanCards } from './components/PlanCards';
import { ElevationCards } from './components/ElevationCards';
import { NewProjectPanel } from './components/NewProjectPanel';
import { SettingsPanel } from './components/SettingsPanel';

async function connect(root: HTMLElement): Promise<AuthUser | null> {
  try {
    await api.health();
  } catch {
    return null;
  }
  if (hasAuthToken()) {
    try {
      return await api.me();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) return null;
      setAuthToken(null);
    }
  }
  return showAuthScreen(root, { allowOffline: true });
}

async function bootstrap(root: HTMLElement): Promise<void> {
  root.replaceChildren(h('div', { class: 'boot' }, 'Cargando ARQUILA…'));
  const user = await connect(root);
  const toaster = new Toaster(document.body);
  let store: AppStore;

  if (user) {
    try {
      const { project, projects } = await loadServerProject();
      store = createAppStore(project, 'server', user);
      store.set({ projects });
    } catch (error) {
      toaster.show(`${describeApiError(error)} Se trabajará con la copia local.`, 'error', 6000);
      store = createAppStore(loadLocalProject(), 'local', null);
    }
  } else {
    store = createAppStore(loadLocalProject(), 'local', null);
    toaster.show('Modo sin conexión: el proyecto se guarda en este navegador y la IA usa el motor de reglas.', 'info', 6000);
  }
  if (store.get().mode === 'local') void refreshProjects(store);
  else void api.aiStatus().then((aiStatus) => store.set({ aiStatus })).catch(() => undefined);

  let saving = false;
  const save = async (): Promise<boolean> => {
    if (saving) return false;
    saving = true;
    const sent = store.get().project;
    try {
      const project = await persistProject(store, sent);
      const changedMeanwhile = store.get().project !== sent;
      store.set(changedMeanwhile
        ? { project: { ...store.get().project, id: project.id, updatedAt: project.updatedAt } }
        : { project, dirty: false });
      toaster.show(store.get().mode === 'server' ? 'Proyecto guardado en PostgreSQL.' : 'Guardado en este navegador (sin conexión).', 'success');
      void refreshProjects(store).catch(() => undefined);
      return true;
    } catch (error) {
      toaster.show(describeApiError(error, 'Error al guardar.'), 'error', 7000);
      return false;
    } finally {
      saving = false;
    }
  };

  const guard = async (action: () => Promise<void>, success?: string) => {
    try {
      await action();
      if (success) toaster.show(success, 'success');
    } catch (error) {
      toaster.show(describeApiError(error), 'error', 6000);
    }
  };

  const confirmDiscard = () => !store.get().dirty || confirm('Hay cambios sin guardar en el proyecto actual. ¿Descartarlos?');

  const logout = () => {
    if (!confirmDiscard()) return;
    setAuthToken(null);
    location.reload();
  };
  window.addEventListener(UNAUTHORIZED_EVENT, () => {
    toaster.show('La sesión expiró. Inicie sesión de nuevo.', 'error', 6000);
    setTimeout(() => location.reload(), 1500);
  });

  const open = (id: string) => guard(async () => {
    if (confirmDiscard()) await openProject(store, id);
  });

  const shell = h('div', { class: 'app-shell' });
  const main = h('div', { class: 'app-main' });
  new Sidebar(store, logout).mount(shell);
  new Header(store, {
    onSave: () => void save(),
    onExport: () => {
      if (!exportPdf(store.get().project)) toaster.show('Permita ventanas emergentes para exportar el PDF.', 'error');
    },
  }).mount(main);
  new TabBar(store).mount(main);
  new Workspace(store, [
    new DashboardPanel(store, { openProject: (id) => void open(id) }),
    new ProjectsPanel(store, {
      open,
      remove: (id) => guard(() => deleteProject(store, id), 'Proyecto eliminado.'),
    }),
    new NewProjectPanel(store, {
      create: async (input) => {
        if (!confirmDiscard()) return;
        await createProject(store, input);
        toaster.show(`Proyecto "${input.name}" creado. Configure ahora el terreno.`, 'success');
      },
    }),
    new ProjectEditor(store),
    new TerrainForm(store),
    new TerrainAnalysis(store),
    new ProgramPanel(store),
    new ConstructionPanel(store),
    new FloorPlans(store, {
      saveFirst: () => (store.get().dirty ? save() : Promise.resolve(true)),
      notify: (message, kind) => toaster.show(message, kind, 5000),
    }),
    new Elevations(store),
    new MaterialsPanel(store),
    new AIAssistantPanel(store),
    new Viewer3D(store),
    new TerrainInfoPanel(store),
    new TerrainViewer(store),
    new TerrainInsights(store),
    new PlanCards(store),
    new ElevationCards(store),
    new SettingsPanel(store),
  ]).mount(main);
  shell.append(main);
  root.replaceChildren(shell);

  let autosaveTimer = 0;
  store.subscribe((state, previous) => {
    if (!state.settings.autosave || !state.dirty || state.project === previous.project) return;
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      if (store.get().dirty && store.get().settings.autosave) void save();
    }, 4000);
  });

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
