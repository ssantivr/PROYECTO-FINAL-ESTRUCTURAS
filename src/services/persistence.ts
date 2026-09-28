import type { Project } from '../types/project';

const STORAGE_KEY = 'arquila.project.v1';

export function saveProject(project: Project): Project {
  const saved = { ...project, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    throw new Error('No fue posible guardar en el almacenamiento local.');
  }
  return saved;
}

export function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Project) : null;
  } catch {
    return null;
  }
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function serializeSvg(svg: SVGSVGElement, title: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.classList.add('export');
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = EXPORT_STYLE;
  clone.prepend(style);
  const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  titleEl.textContent = title;
  clone.prepend(titleEl);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`;
}

export const EXPORT_STYLE = `
  svg { background:#fff; font-family: Arial, sans-serif; }
  .wall { fill:#1a1a1a; } .room { fill:#fff; stroke:#333; stroke-width:.05; }
  .room-label { fill:#111; font-size:.42px; } .room-label.compact { font-size:.28px; } .room-label.tiny { font-size:.2px; } .room-area { fill:#555; font-size:.32px; }
  .axis-line { stroke:#999; stroke-width:.03; stroke-dasharray:.3 .15; }
  .axis-bubble { fill:#fff; stroke:#333; stroke-width:.04; } .axis-text { fill:#111; font-size:.34px; }
  .dim-line { stroke:#333; stroke-width:.025; } .dim-text { fill:#111; font-size:.3px; }
  .opening { fill:#fff; stroke:#333; stroke-width:.03; } .door-swing { fill:none; stroke:#333; stroke-width:.03; }
  .stair-step { stroke:#555; stroke-width:.03; } .plan-title { fill:#111; font-size:.5px; font-weight:bold; }
  .furniture { fill:none; stroke:#777; stroke-width:.025; } .arrow-head { fill:#333; }
  .elev-ground { fill:#e8e4dc; stroke:#333; stroke-width:.04; } .elev-wall { fill:#fff; stroke:#111; stroke-width:.05; }
  .elev-window { fill:#dfe9f1; stroke:#111; stroke-width:.03; } .elev-door { fill:#c9b79c; stroke:#111; stroke-width:.03; }
  .elev-mullion { stroke:#111; stroke-width:.02; } .elev-roof { fill:#bbb; stroke:#111; stroke-width:.05; } .elev-slab { fill:#666; }
  .section-space { fill:#fafafa; } .section-cut { fill:#111; } .section-roof { fill:none; stroke:#111; stroke-width:.12; }
  .level-symbol { fill:#111; }
  .site-lot { fill:#fff; stroke:#111; stroke-width:.08; stroke-dasharray:.4 .2; } .site-building { fill:#ddd; stroke:#111; stroke-width:.06; }
  .site-garden { fill:#e3eedc; } .site-parking { fill:#eee; stroke:#555; stroke-width:.04; } .site-pool { fill:#cfe3f3; stroke:#336; stroke-width:.04; }
  .site-text { fill:#111; font-size:.45px; } .site-text.strong { font-weight:bold; } .site-dim { stroke:#555; stroke-width:.03; stroke-dasharray:.2 .1; }
  .site-street { stroke:#111; stroke-width:.08; } .site-north path, .site-access path { fill:#111; }
`;
