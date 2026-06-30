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

  // Basic graphic references to prevent recreating
  private mapGraphics: PIXI.Graphics;

  constructor() {
    this.app = new PIXI.Application();
    
    // We will initialize asynchronously
    this.viewport = null as any;
    this.mapContainer = new PIXI.Container();
    this.unitsContainer = new PIXI.Container();
    this.fxContainer = new PIXI.Container();
    this.fogContainer = new PIXI.Container();
    
    this.mapGraphics = new PIXI.Graphics();
    this.mapContainer.addChild(this.mapGraphics);
  }

  public async init(options: PixiEngineOptions) {
    await this.app.init({
      width: options.width,
      height: options.height,
      backgroundColor: 0x0f172a, // match slate-900
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: !options.lowGraphics,
      preference: 'webgl' // Force WebGL
    });

    const canvas = this.app.canvas as HTMLCanvasElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    
    options.container.appendChild(canvas);

    // Setup Viewport for panning and zooming
    this.viewport = new Viewport({
      screenWidth: options.width,
      screenHeight: options.height,
      worldWidth: 2000,
      worldHeight: 1100,
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

    console.log("[PixiMapEngine] Initialized with WebGL WebRender. Anti-alias:", !options.lowGraphics);
  }

  public destroy() {
    this.app.destroy({ removeView: true });
  }

  public resize(width: number, height: number) {
    this.app.renderer.resize(width, height);
    this.viewport.resize(width, height, 2000, 1100);
  }

  // Map interaction events
  public onFeatureClick: ((id: string) => void) | null = null;

  // Draw political borders and filled shapes using Pixi Graphics
  public renderMapPolygons(features: any[]) {
    // Clear previous
    this.mapContainer.removeChildren();
    
    // Virtual Dimensions mapping
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

    features.forEach(feat => {
      const geo = feat.geometry;
      if (!geo) return;

      const featureId = feat.properties?.id;
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
         
         featureGraphics.poly(points).fill({ color: 0x0f172a }).stroke({ width: 1, color: 0x1e293b });
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
    // 1. Cull out bounds
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
      // Very basic projection equivalent to projectCoords
      const xPercent = (unit.lng + 180) / 360;
      const yPercent = (90 - unit.lat) / 180;
      const x = xPercent * 2000;
      const y = yPercent * 1100;

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
