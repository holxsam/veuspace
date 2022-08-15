import { SVGScene } from "@pixi-essentials/svg";
import { Viewport } from "pixi-viewport";
import {
  Application,
  autoDetectRenderer,
  Container,
  Graphics,
} from "pixi.js-legacy";
import {
  colorToNumber as ctn,
  roundIntToNearestMultiple,
} from "../utils/utils";
import { BaseTool } from "./tools/BaseTool";
import { EraserTool } from "./tools/EraserTool";
import { DrawTool } from "./tools/DrawTool";
import { SelectTool } from "./tools/SelectTool";

export const TOOL = {
  //                         DESKTOP                     | MOBILE
  SELECT: "select", //       L=tool M=pan R=pan   W=zoom | L1=pan   L2=zoom L3=pan
  ERASE: "erase", //         L=tool M=pan R=erase W=zoom | L1=erase L2=zoom L3=pan
  DRAW: "draw", //           L=tool M=pan R=erase W=zoom | L1=tool  L2=zoom L3=pan
  FORM: "form", //           L=tool M=pan R=erase W=zoom | L1=tool  L2=zoom L3=pan
  ARROW: "arrow", //         L=tool M=pan R=erase W=zoom | L1=tool  L2=zoom L3=pan
  TEXT_ADD: "text_add", //   L=tool M=pan R=erase W=zoom | L1=tool  L2=zoom L3=pan
  TEXT_EDIT: "text_edit", // L=tool M=pan R=erase W=zoom | L1=tool  L2=zoom L3=pan
  IMAGE: "image", //         L=tool M=pan R=erase W=zoom | L1=tool  L2=zoom L3=pan
} as const;

export type ReverseMap<T> = T[keyof T];
export type Tool = ReverseMap<typeof TOOL>;

export class PixiApplication {
  private static instance: PixiApplication;
  private static initialized = false;

  // main states:
  public readonly app: Application;
  public readonly background: Container;
  public readonly items: Container;
  public readonly viewport: Viewport;

  // tools:
  public activeTool: BaseTool;
  public readonly drawTool: DrawTool;
  public readonly selectTool: SelectTool;
  public readonly eraserTool: EraserTool;

  private _mode: Tool;
  private _grid: boolean;
  private _cellSize: number;
  private _backgroundPattern: { type: string; color: string };
  public longPressFn?: () => void;

  private constructor() {
    this._mode = "select";
    this._cellSize = 60;
    this._grid = true;
    this._backgroundPattern = { type: "dot", color: "#000000" };

    this.app = new Application();
    this.background = new Container();
    this.items = new Container();
    this.viewport = new Viewport({
      passiveWheel: false,
      disableOnContextMenu: true,
    });

    this.drawTool = new DrawTool(this);
    this.selectTool = new SelectTool(this);
    this.eraserTool = new EraserTool(this);

    this.activeTool = this.selectTool;

    this.drawTool.setOptions({ size: 5, color: 0x555555 });
  }

  public static getInstance(): PixiApplication {
    if (!PixiApplication.instance)
      PixiApplication.instance = new PixiApplication();
    return PixiApplication.instance;
  }

  public setup(canvas?: HTMLCanvasElement, container?: HTMLElement) {
    if (PixiApplication.initialized) return;

    PixiApplication.initialized = true;

    const box = container?.getBoundingClientRect() || { width: 0, height: 0 };

    // destroy and remake the renderer:
    this.app.renderer.destroy();
    this.app.renderer = autoDetectRenderer({
      width: box.width,
      height: box.height,
      resolution: window.devicePixelRatio,
      antialias: true,
      autoDensity: true,
      view: canvas,
      backgroundAlpha: 0,
    });

    // name the major containers:
    this.viewport.name = "viewport";
    this.background.name = "background";
    this.items.name = "items";

    // add the containers to the stage (order is important):
    this.viewport.addChild(this.background);
    this.viewport.addChild(this.items);
    this.app.stage.addChild(this.viewport);

    this.selectTool.activate();
  }

  public get grid() {
    return this._grid;
  }

  public set grid(value: boolean) {
    this._grid = value;
    if (value) this.drawBackgroundPattern();
    else this.background.removeChildren();
  }

  public get cellSize() {
    return this._cellSize;
  }

  public set cellSize(value: number) {
    if (value === this._cellSize) return;

    this._cellSize = value;
    this.drawBackgroundPattern();
  }

  public get backgroundPattern() {
    return this._backgroundPattern;
  }

  public set backgroundPattern(
    value: Partial<{ type: string; color: string }>
  ) {
    this._backgroundPattern = { ...this._backgroundPattern, ...value };
    this.drawBackgroundPattern();
  }

  public get mode() {
    return this._mode;
  }

  public set mode(value: Tool) {
    if (value === this._mode) return;

    this._mode = value;

    switch (value) {
      case TOOL.SELECT:
        this.selectTool.activate();
        // this.activeTool = this.selectTool;
        break;
      case TOOL.DRAW:
        this.drawTool.activate();
        // this.activeTool = this.drawTool;
        break;
      case TOOL.ERASE:
        this.eraserTool.activate();
        // this.activeTool = this.eraserTool;
        break;
      default:
        break;
    }
  }

  public resize(width: number, height: number) {
    this.app.renderer.resize(width, height);
    this.app.view.style.width = `${width}px`;
    this.app.view.style.height = `${height}px`;
    this.viewport.resize(width, height);
    this.drawBackgroundPattern();
  }

  public disablePanning() {
    // console.log("disablePanning");
    this.viewport.drag({ pressDrag: false, mouseButtons: "middle" });
  }

  public enablePanning() {
    // console.log("enablePanning");
    this.viewport.drag({ pressDrag: true, mouseButtons: "middle" });
  }

  public drawBackgroundPattern(force = false) {
    if (!this._grid && !force) return;

    this.background.removeChildren();
    const { color, type } = this._backgroundPattern;
    const cell = this._cellSize; // the gap between each cell of the grid ;
    const pattern = new Graphics();
    // measurements
    const vp_bounds = this.viewport.getVisibleBounds();
    const gridbox = vp_bounds.pad(cell);
    const hboxes = Math.round(gridbox.width / cell);
    const vboxes = Math.round(gridbox.height / cell);
    // for circle:
    pattern.beginFill(ctn(color), 1);
    pattern.lineStyle({ width: 0 });
    // for rect:
    // pattern.beginFill(0, 0);
    // pattern.lineStyle({ width: 1, color: 0xffffff });
    for (let x = 0; x < hboxes; x++) {
      for (let y = 0; y < vboxes; y++) {
        const offsetX = roundIntToNearestMultiple(vp_bounds.x, cell);
        const offsetY = roundIntToNearestMultiple(vp_bounds.y, cell);
        const X = offsetX + x * cell;
        const Y = offsetY + y * cell;
        pattern.drawCircle(X, Y, 1); // for circle
        // pattern.drawRect(X, Y, cell, cell); // for rect
      }
    }
    pattern.endFill();
    this.background.addChild(pattern);
  }
}
