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
  private unitPool: PIXI.Container[] = [];
  private activeUnits: Map<string, PIXI.Container> = new Map();

  // Map features cached for redrawing
  private mapFeatures: any[] = [];
  private lastSelectedMatchId: string | null = null;
  private featureGraphicsMap: Map<string, PIXI.Graphics> = new Map();

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
      backgroundColor: 0x14161b, // sleek military charcoal gray
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
      .decelerate()
      .clampZoom({ minScale: 0.5, maxScale: 8 })
      .clamp({ direction: 'all' });

    this.app.stage.addChild(this.viewport);

    // Layering setup
    this.viewport.addChild(this.mapContainer);
    this.viewport.addChild(this.fogContainer);
    this.viewport.addChild(this.unitsContainer);
    this.viewport.addChild(this.fxContainer);

    // Register ticker
    this.app.ticker.add(this.updateParticles);

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
  public displayMode: 'political' | 'alliances' | 'war' | 'resources' = 'political';
  
  private lastTerritories: any[] = [];
  private lastSelectedProvinceId: string | null = null;
  private lastSelectedMatchId: string | null = null;

  public zoomIn() {
    if (this.viewport) this.viewport.zoomPercent(0.25, true);
  }

  public zoomOut() {
    if (this.viewport) this.viewport.zoomPercent(-0.25, true);
  }

  public recenter() {
    if (this.viewport) {
      this.viewport.animate({
        time: 500,
        position: { x: 500, y: 275 }, // Center of virtual world
        scale: 1
      });
    }
  }

  public setDisplayMode(mode: 'political' | 'alliances' | 'war' | 'resources') {
    this.displayMode = mode;
    this.drawMap(this.lastTerritories, this.lastSelectedProvinceId, this.lastSelectedMatchId);
  }

  // Draw political borders and filled shapes using Pixi Graphics
  public renderMapPolygons(features: any[], territories: any[] = [], selectedProvinceId: string | null = null, selectedMatchId: string | null = null) {
    this.mapFeatures = features;
    this.drawMap(territories, selectedProvinceId, selectedMatchId);
  }

  // Draw or Redraw the map without re-fetching GeoJSON
  public drawMap(territories: any[] = [], selectedProvinceId: string | null = null, selectedMatchId: string | null = null) {
    this.lastTerritories = territories;
    this.lastSelectedProvinceId = selectedProvinceId;
    this.lastSelectedMatchId = selectedMatchId;

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
      if (!featureId) return;
      
      const expectedDbId = selectedMatchId ? `${selectedMatchId}_${featureId}` : featureId;
      const territory = territories?.find(t => t.id === expectedDbId || t.id === featureId);

      // Determine colors based on display mode
      let fillColor = 0x2e3138; // Default independent/neutral color (Steel Gray)
      let fillAlpha = 0.6;
      let strokeColor = 0x474a52; // Sleek dark steel borders
      let strokeWidth = 0.8;

      if (territory) {
        if (this.displayMode === 'political') {
          if (territory.color) {
            fillColor = parseInt(territory.color.replace('#', '0x'), 16);
            fillAlpha = 0.75;
          } else {
            fillColor = 0x2e3138; // Uncolored owned territory
            fillAlpha = 0.6;
          }
        } else if (this.displayMode === 'resources') {
          if (territory.type === 'desert') { fillColor = 0xeab308; fillAlpha = 0.6; } // Yellow
          else if (territory.type === 'coastal') { fillColor = 0x3b82f6; fillAlpha = 0.6; } // Blue
          else if (territory.type === 'mountain') { fillColor = 0x94a3b8; fillAlpha = 0.6; } // Slate
          else { fillColor = 0x22c55e; fillAlpha = 0.5; } // Green (plain)
        } else if (this.displayMode === 'war') {
          if (territory.battleStatus === 'clashing') {
            fillColor = 0xef4444; fillAlpha = 0.8; // Red clash
            strokeColor = 0xb91c1c; strokeWidth = 2;
          } else if (territory.battleStatus === 'preparing') {
            fillColor = 0xf97316; fillAlpha = 0.7; // Orange prep
          } else {
            fillColor = 0x2e3138; fillAlpha = 0.3; // Dim others
          }
        } else if (this.displayMode === 'alliances') {
           // Simplified alliances (just show owned vs neutral)
           if (territory.ownerCountryId) {
             fillColor = 0x8b5cf6; fillAlpha = 0.7; // Purple
           }
        }

        // Highlight selected province with an Amber Gold halo
        if (territory.id === selectedProvinceId || featureId === selectedProvinceId) {
          strokeColor = 0xf59e0b;
          strokeWidth = 2.5;
          fillAlpha = Math.min(fillAlpha + 0.15, 1.0);
        }
      }

      let featureGraphics = this.featureGraphicsMap.get(featureId);
      let needsDraw = false;

      if (!featureGraphics) {
        featureGraphics = new PIXI.Graphics();
        featureGraphics.eventMode = 'static';
        featureGraphics.cursor = 'pointer';
        
        featureGraphics.on('pointerdown', () => {
          if (this.onFeatureClick && featureId) {
            this.onFeatureClick(featureId);
          }
        });

        // Highlight on hover
        featureGraphics.on('pointerover', () => {
          if (featureGraphics) featureGraphics.alpha = 0.8;
        });
        featureGraphics.on('pointerout', () => {
          if (featureGraphics) featureGraphics.alpha = 1.0;
        });

        this.featureGraphicsMap.set(featureId, featureGraphics);
        this.mapContainer.addChild(featureGraphics);
        needsDraw = true;
      }

      // Check if visual state changed to avoid unnecessary redraws
      const stateKey = `${fillColor}_${fillAlpha}_${strokeColor}_${strokeWidth}`;
      if ((featureGraphics as any)._lastStateKey !== stateKey) {
         needsDraw = true;
         (featureGraphics as any)._lastStateKey = stateKey;
      }

      if (needsDraw) {
        featureGraphics.clear();
        const drawRing = (ring: [number, number][]) => {
           if (ring.length === 0) return;
           const points: number[] = [];
           for(let i=0; i<ring.length; i++) {
             const pt = projectCoords(ring[i][1], ring[i][0]);
             points.push(pt.x, pt.y);
           }
           
           featureGraphics!.poly(points).fill({ color: fillColor, alpha: fillAlpha }).stroke({ width: strokeWidth, color: strokeColor });
        };

        if (geo.type === 'Polygon') {
          geo.coordinates.forEach((ring: any) => drawRing(ring));
        } else if (geo.type === 'MultiPolygon') {
          geo.coordinates.forEach((poly: any) => poly.forEach((ring: any) => drawRing(ring)));
        }
      }
    });
  }

  // Object Pooling for UI Units
  public getUnitSprite(type: string, colorHex: string = '#f59e0b'): PIXI.Container {
    let container: PIXI.Container;
    if (this.unitPool.length > 0) {
      container = this.unitPool.pop()!;
      container.visible = true;
    } else {
      container = new PIXI.Container();
      
      const bg = new PIXI.Graphics();
      bg.name = 'bg';
      container.addChild(bg);
      
      const icon = new PIXI.Sprite();
      icon.name = 'icon';
      icon.anchor.set(0.5);
      container.addChild(icon);
    }

    const bg = container.getChildByName('bg') as PIXI.Graphics;
    const icon = container.getChildByName('icon') as PIXI.Sprite;

    const color = parseInt(colorHex.replace('#', '0x'), 16);
    
    // Redraw background circle with country border
    bg.clear();
    bg.circle(0, 0, 14).fill({ color: 0x0f172a, alpha: 0.95 });
    bg.stroke({ width: 2.5, color: color });

    // Set texture based on unit type
    let textureUrl = '/icons/soldier.png';
    if (type === 'tank') {
      textureUrl = '/icons/tank.png';
    } else if (type === 'jet' || type === 'missile') {
      textureUrl = '/icons/military_plane.png';
    }

    try {
      icon.texture = PIXI.Texture.from(textureUrl);
    } catch (e) {
      console.warn("Failed to load unit texture:", textureUrl, e);
    }
    
    // Scale image nicely inside the circle
    icon.width = 18;
    icon.height = 18;
    icon.tint = 0xffffff; 
    
    return container;
  }

  public returnUnitSprite(container: PIXI.Container) {
    container.visible = false;
    this.unitPool.push(container);
  }

  // --- FX Particle System ---
  private particlePool: PIXI.Sprite[] = [];
  private activeParticles: Set<any> = new Set();
  
  public getParticleSprite(): PIXI.Sprite {
     if (this.particlePool.length > 0) {
       const spr = this.particlePool.pop()!;
       spr.visible = true;
       return spr;
     }
     const gr = new PIXI.Graphics();
     gr.circle(0, 0, 2).fill({ color: 0xffffff });
     const tex = this.app.renderer.generateTexture(gr);
     const sprite = new PIXI.Sprite(tex);
     sprite.anchor.set(0.5);
     return sprite;
  }

  public launchInvasionMarch(startLat: number, startLng: number, endLat: number, endLng: number, colorHex: string, count: number) {
    if (!this.app || !this.app.ticker) return;
    
    const virtualWidth = 1000;
    const virtualHeight = 550;
    
    const sx = ((startLng + 180) / 360) * virtualWidth;
    const sy = ((85 - startLat) / 170) * virtualHeight;
    const ex = ((endLng + 180) / 360) * virtualWidth;
    const ey = ((85 - endLat) / 170) * virtualHeight;

    const color = parseInt(colorHex.replace('#', '0x'), 16);

    for (let i = 0; i < count; i++) {
      const sprite = this.getParticleSprite();
      sprite.tint = Math.random() < 0.3 ? 0xffffff : color; // Some white flashes
      
      const jitterX = (Math.random() - 0.5) * 10;
      const jitterY = (Math.random() - 0.5) * 10;
      
      sprite.x = sx + jitterX;
      sprite.y = sy + jitterY;
      
      const angle = Math.atan2(ey - sy, ex - sx) + (Math.random() - 0.5) * 0.2;
      const speed = 0.5 + Math.random() * 1.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = 100 + Math.random() * 200; // frames
      
      const p = { sprite, vx, vy, life, maxLife: life };
      this.activeParticles.add(p);
      this.fxContainer.addChild(sprite);
    }
  }

  private updateParticles = (ticker: PIXI.Ticker) => {
    for (const p of this.activeParticles) {
      p.sprite.x += p.vx * ticker.deltaTime;
      p.sprite.y += p.vy * ticker.deltaTime;
      p.life -= ticker.deltaTime;
      p.sprite.alpha = p.life / p.maxLife;

      if (p.life <= 0) {
        this.fxContainer.removeChild(p.sprite);
        p.sprite.visible = false;
        this.particlePool.push(p.sprite);
        this.activeParticles.delete(p);
      }
    }
  };

  private activeUnitSprites: Map<string, PIXI.Container> = new Map();

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
        sprite = this.getUnitSprite(unit.type, unit.color || '#f59e0b');
        this.unitsContainer.addChild(sprite);
        this.activeUnitSprites.set(unit.id, sprite);
      }
      
      sprite.visible = true;
      sprite.x = x;
      sprite.y = y;
    });
  }
}
