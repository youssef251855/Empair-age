import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export interface PixiEngineOptions {
  container: HTMLElement;
  width: number;
  height: number;
  lowGraphics: boolean;
}

export class PixiMapEngine {
  public app: PIXI.Application;
  public viewport: Viewport;
  public mapContainer: PIXI.Container;
  public unitsContainer: PIXI.Container;
  public fxContainer: PIXI.Container;
  public fogContainer: PIXI.Container;
  
  // Object pooling for high performance
  private unitPool: PIXI.Sprite[] = [];
  private activeUnits: Map<string, PIXI.Sprite> = new Map();

  // Map features cached for redrawing
  private mapFeatures: any[] = [];
  private lastSelectedMatchId: string | null = null;

  constructor() {
    this.app = new PIXI.Application();
    
    // We will initialize asynchronously
    this.viewport = null as any;
    this.mapContainer = new PIXI.Container();
    this.unitsContainer = new PIXI.Container();
    this.fxContainer = new PIXI.Container();
    this.fogContainer = new PIXI.Container();
  }

  public async init(options: PixiEngineOptions) {
    // Determine resolution depending on graphics settings
    const savedQuality = localStorage.getItem('graphicsQuality') || 'high';
    let resolution = 1;
    let antialias = false;

    if (savedQuality === 'high') {
      resolution = Math.min(window.devicePixelRatio || 1, 1.5);
      antialias = true;
    } else if (savedQuality === 'medium') {
      resolution = Math.min(window.devicePixelRatio || 1, 1.25);
      antialias = false;
    } else {
      resolution = 1; // low quality
      antialias = false;
    }

    await this.app.init({
      width: options.width || 800,
      height: options.height || 500,
      backgroundColor: 0x0f172a, // match slate-900
      resolution: resolution,
      autoDensity: true,
      antialias: antialias,
      preference: 'webgl', // Force WebGL for extreme speed
      hello: false
    });

    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    
    options.container.appendChild(canvas);

    // Setup Viewport for panning and zooming
    this.viewport = new Viewport({
      screenWidth: options.width || 800,
      screenHeight: options.height || 500,
      worldWidth: 1000, // Matched with our projection coordinates
      worldHeight: 550,  // Matched with our projection coordinates
      events: this.app.renderer.events
    });

    this.viewport
      .drag()
      .pinch()
      .wheel()
      .decelerate();

    this.app.stage.addChild(this.viewport);

    // Layering setup
    this.viewport.addChild(this.mapContainer);
    this.viewport.addChild(this.fogContainer);
    this.viewport.addChild(this.unitsContainer);
    this.viewport.addChild(this.fxContainer);

    console.log("[PixiMapEngine] Initialized. Resolution:", resolution, "Antialias:", antialias);
  }

  public destroy() {
    // Destroy all children to prevent WebGL memory leaks
    if (this.app) {
      this.app.destroy({ removeView: true, children: true });
    }
  }

  public resize(width: number, height: number) {
    if (this.app && this.app.renderer && this.viewport) {
      this.app.renderer.resize(width, height);
      this.viewport.resize(width, height, 1000, 550);
    }
  }

  // Map interaction events
  public onFeatureClick: ((id: string) => void) | null = null;

  // Draw political borders and filled shapes using Pixi Graphics
  public renderMapPolygons(features: any[], territories: any[] = [], selectedProvinceId: string | null = null, selectedMatchId: string | null = null) {
    this.mapFeatures = features;
    this.drawMap(territories, selectedProvinceId, selectedMatchId);
  }

  // Draw or Redraw the map without re-fetching GeoJSON
  public drawMap(territories: any[] = [], selectedProvinceId: string | null = null, selectedMatchId: string | null = null) {
    this.lastSelectedMatchId = selectedMatchId;

    // To prevent WebGL memory leaks, destroy all child graphics objects before removing them
    while (this.mapContainer.children.length > 0) {
      const child = this.mapContainer.getChildAt(0) as PIXI.Graphics;
      this.mapContainer.removeChildAt(0);
      child.destroy({ children: true, texture: true, geometry: true });
    }
    
    // Virtual Dimensions mapping matching the worldWidth/worldHeight
    const virtualWidth = 1000;
    const virtualHeight = 550;

    const projectCoords = (lat: number, lng: number) => {
      const xPercent = (lng + 180) / 360;
      const yPercent = (85 - lat) / 170;
      return {
        x: xPercent * virtualWidth,
        y: yPercent * virtualHeight,
      };
    };

    this.mapFeatures.forEach(feat => {
      const geo = feat.geometry;
      if (!geo) return;

      const featureId = feat.properties?.id;
      const expectedDbId = selectedMatchId ? `${selectedMatchId}_${featureId}` : featureId;
      
      // Look up target territory state to resolve tactical colors
      const territory = territories?.find(t => t.id === expectedDbId || t.id === featureId);

      // Determine colors
      let fillColor = 0x1e293b; // Default independent/neutral color (Slate-800)
      let fillAlpha = 0.5;
      let strokeColor = 0x334155; // Default Slate-700 border
      let strokeWidth = 1;

      if (territory) {
        if (territory.color) {
          fillColor = parseInt(territory.color.replace('#', '0x'), 16);
          fillAlpha = 0.75;
        } else {
          fillColor = 0x334155; // Uncolored owned territory
          fillAlpha = 0.6;
        }

        // Highlight selected province with an Amber Gold halo
        if (territory.id === selectedProvinceId || featureId === selectedProvinceId) {
          strokeColor = 0xf59e0b;
          strokeWidth = 2.5;
          fillAlpha = Math.min(fillAlpha + 0.15, 1.0);
        }
      }

      const featureGraphics = new PIXI.Graphics();
      featureGraphics.eventMode = 'static';
      featureGraphics.cursor = 'pointer';
      
      featureGraphics.on('pointerdown', () => {
        if (this.onFeatureClick && featureId) {
          this.onFeatureClick(featureId);
        }
      });

      // Highlight on hover
      featureGraphics.on('pointerover', () => {
        featureGraphics.alpha = 0.8;
      });
      featureGraphics.on('pointerout', () => {
        featureGraphics.alpha = 1.0;
      });

      const drawRing = (ring: [number, number][]) => {
         if (ring.length === 0) return;
         const points: number[] = [];
         for(let i=0; i<ring.length; i++) {
           const pt = projectCoords(ring[i][1], ring[i][0]);
           points.push(pt.x, pt.y);
         }
         
         featureGraphics.poly(points).fill({ color: fillColor, alpha: fillAlpha }).stroke({ width: strokeWidth, color: strokeColor });
      };

      if (geo.type === 'Polygon') {
        geo.coordinates.forEach((ring: any) => drawRing(ring));
      } else if (geo.type === 'MultiPolygon') {
        geo.coordinates.forEach((poly: any) => poly.forEach((ring: any) => drawRing(ring)));
      }

      this.mapContainer.addChild(featureGraphics);
    });
  }

  // Object Pooling for UI Units
  public getUnitSprite(type: string): PIXI.Sprite {
    if (this.unitPool.length > 0) {
      const spr = this.unitPool.pop()!;
      spr.visible = true;
      return spr;
    }
    const gr = new PIXI.Graphics();
    gr.circle(0, 0, 5).fill({ color: 0xffffff });
    
    // Convert to texture for max performance rather than drawing graphics each frame
    const tex = this.app.renderer.generateTexture(gr);
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    return sprite;
  }

  public returnUnitSprite(sprite: PIXI.Sprite) {
    sprite.visible = false;
    this.unitPool.push(sprite);
  }

  private activeUnitSprites: Map<string, PIXI.Sprite> = new Map();

  public updateUnits(units: any[]) {
    if (!this.viewport) return;

    // Cull out bounds for high performance
    const bounds = this.viewport.getVisibleBounds();

    const currentIds = new Set(units.map(u => u.id));

    // Return stale sprites to pool
    for (const [id, sprite] of this.activeUnitSprites.entries()) {
      if (!currentIds.has(id)) {
        this.unitsContainer.removeChild(sprite);
        this.returnUnitSprite(sprite);
        this.activeUnitSprites.delete(id);
      }
    }

    // Update or spawn
    units.forEach(unit => {
      // Align coordinates EXACTLY with map projection
      const xPercent = (unit.lng + 180) / 360;
      const yPercent = (85 - unit.lat) / 170;
      const x = xPercent * 1000;
      const y = yPercent * 550;

      // Viewport Culling logic
      const isVisible = (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height);
      
      if (!isVisible) {
         if (this.activeUnitSprites.has(unit.id)) {
            const spr = this.activeUnitSprites.get(unit.id)!;
            spr.visible = false;
         }
         return; // Skip rendering if outside viewport (Chunk/Cull performance)
      }

      let sprite = this.activeUnitSprites.get(unit.id);
      if (!sprite) {
        sprite = this.getUnitSprite(unit.type);
        sprite.tint = unit.color ? parseInt(unit.color.replace('#', '0x'), 16) : 0xffffff;
        this.unitsContainer.addChild(sprite);
        this.activeUnitSprites.set(unit.id, sprite);
      }
      
      sprite.visible = true;
      sprite.x = x;
      sprite.y = y;
    });
  }
}
