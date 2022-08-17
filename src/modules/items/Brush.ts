import {
  colorToNumber as ctn,
  extraPoint,
  generateColors,
  getRandomIntInclusive,
  getSvgPathFromStroke,
  midpoint,
  normalPoint,
} from "../../utils/utils";
import { MultiPolygon, Ring, union } from "polygon-clipping";
import { Graphics, LINE_CAP, Polygon } from "pixi.js-legacy";
import { BaseItem } from "./BaseItem";
import getStroke from "perfect-freehand";

export type BrushOptions = {
  color: string | number;
  size: number;
};

const DefaultBrushOptions: BrushOptions = {
  color: 0x222222,
  size: 10,
};

export class BrushPath extends Graphics implements BaseItem<BrushOptions> {
  public type: string = "brush-path";
  public points: number[][];
  protected options: BrushOptions;

  constructor(points?: number[][], options?: Partial<BrushOptions>) {
    super();
    this.points = points || [];
    this.options = { ...DefaultBrushOptions, ...options };

    this.draw();
    this.computeHitArea();
  }

  private fillOptions = (options: Partial<BrushOptions>): BrushOptions => ({
    ...this.options,
    ...options,
  });

  public setOptions = (options: Partial<BrushOptions>) => {
    this.options = this.fillOptions(options);
    this.draw();
    this.computeHitArea();
  };

  public getData = () => {
    return this.options;
  };

  public computeHitArea = () => {
    const { size } = this.options;
    const w = Math.max(5, size);
    const p = this.points;
    if (p.length > 3) {
      const top: number[][] = []; // points "above" or on "top" of the line of points
      const bot: number[][] = []; // points "below" or or "bottom" of the line of points
      for (let i = 0; i < p.length - 1; i++) {
        const [p1, p2] = normalPoint(p[i], p[i + 1], w);
        top.push(p1);
        bot.unshift(p2); // push in reverse so we dont have to reverse this list after
      }

      const [, first] = extraPoint(p[0], p[1], size);
      const [, last] = extraPoint(p[p.length - 1], p[p.length - 2], size);

      return [first, ...top, last, ...bot];
    }

    return [];
  };

  public generateHitArea = () => {
    const polyorder = this.computeHitArea();
    const polypoints = polyorder.flatMap((p) => p);
    this.hitArea = new Polygon(polypoints);
  };

  public drawPerfectFreehand = () => {
    // perfect-freehand implementation with the default fill rule on Graphics:
    // This implementation is slow and because of the fill rule on Graphics objects,
    // we get weird fills that are not accurate.
    const { color, size } = this.options;
    const points = this.points;

    const outlinePoints = getStroke(points, {
      size,
      smoothing: 0.5,
      thinning: 0.7,
      streamline: 0.34,
      easing: (t) => t,
      start: {
        taper: 0,
        cap: true,
      },
      end: {
        taper: 0,
        cap: true,
      },
    });

    this.clear();
    this.beginFill(ctn(color), 1);
    this.drawPolygon(outlinePoints.flatMap((p) => p));
    this.endFill();

    this.drawStrokePolygonPath(outlinePoints);
  };

  public draw = () => {
    const { color, size } = this.options;
    const points = this.points;

    if (this.destroyed) return;
    this.clear();

    if (points.length < 4) {
      // draw points as circles:
      points.forEach(([x, y]) => {
        this.beginFill(ctn(color), 1);
        this.drawCircle(x, y, size / 2);
        this.endFill();
      });
      return;
    }

    let [c, n] = points; // c -> current / n -> next
    this.beginFill(0, 0);
    this.lineStyle({
      width: size,
      color: ctn(color),
      cap: LINE_CAP.ROUND,
    });
    this.moveTo(c[0], c[1]);

    for (let i = 1; i < points.length; i++) {
      const midPoint = midpoint(c, n); // endpoint
      this.quadraticCurveTo(c[0], c[1], midPoint[0], midPoint[1]);
      c = points[i];
      n = points[i + 1];
    }
    this.lineTo(c[0], c[1]);
    this.endFill();
  };

  /**
   * Good for debugging.
   */
  public drawPoints = (line = false, rainbow = false) => {
    if (this.points.length === 0) return;
    const points = this.points;
    const path = this.addChild(new Graphics());
    const lineClrs = generateColors(points.length);
    const pointColor = 0x00ffff;

    path.beginFill(0, 0);
    path.moveTo(points[0][0], points[0][1]);
    points.forEach(([x, y]) => {
      const c = lineClrs.next().value ?? 0;
      console.log(c);
      const color = rainbow ? c : pointColor;
      path.lineStyle({ width: 1, color });
      if (line) path.lineTo(x, y);
      path.drawCircle(x, y, 1);
    });
    path.endFill();
  };

  /**
   * To visualize the hit area we generated:
   */
  public drawHitArea = () => {
    const points = this.computeHitArea();
    // draw the entire boundary
    const outline = new Graphics();
    this.addChild(outline);
    const clr = generateColors(points.length);
    outline.beginFill(0, 0);
    outline.moveTo(points[0][0], points[0][1]);
    points.forEach(([x, y]) => {
      const c = clr.next().value ?? 0;
      outline.lineStyle({ color: c, width: 1 });
      outline.lineTo(x, y);
      outline.drawCircle(x, y, 1);
    });
    outline.lineTo(points[0][0], points[0][1]);
    outline.endFill();
  };

  /**
   * Good for debugging perfect-freehand.
   */
  public drawStrokePolygonPath = (points: number[][]) => {
    if (points.length === 0) return;

    // const points = this.points;
    const path = this.addChild(new Graphics());
    // const lineClrs = generateColors(p.length);
    const ogLineColor = 0x00ffff;

    path.beginFill(0, 0);
    path.moveTo(points[0][0], points[0][1]);
    points.forEach(([x, y]) => {
      // const c = lineClrs.next().value ?? 0;
      path.lineStyle({ width: 1, color: ogLineColor });
      // ogLine.lineTo(x, y);
      path.drawCircle(x, y, 1);
    });
    path.endFill();
  };
}

/// different ways to draw
//----------------------------------------------------------------------------------
// // perfect-freehand implementation with the default fill rule on Graphics that's wrong:
// this.path.clear();
// this.path.beginFill(ctn(color), 1);
// this.path.drawPolygon(outlinePoints.flatMap((p) => p));
// this.path.endFill();
//----------------------------------------------------------------------------------
// // perfect-freehand using polygon-clipping to flatten the polygon
// // before giving it to Graphics
// const outlinePoints = getStroke(points, this._strokeOptions);
// const outlineColor = outlinePoints.map((p, i) => [
//   p[0],
//   p[1],
//   i * 0x010101,
//   // ctn(getRandomIntInclusive(0, 0xffffff)),
// ]);
// const svgPath = getSvgPathFromStroke(outlinePoints);

// try {
//   const faces = union([outlinePoints as Ring]); // very expensive calculation, need to find a way to optimize this

//   this.path.clear();
//   // this.path.beginFill(ctn(color), 1);
//   faces.forEach((face) => {
//     face.forEach((points, j) => {
//       // this.path.lineStyle({ width: 1, color: 0xffffff });
//       if (j !== 0) this.path.beginHole();
//       this.path.drawPolygon(points.flatMap((p) => p));
//       this.path.finishPoly();
//       if (j !== 0) this.path.endHole();
//     });
//   });
//   // this.path.endFill();
// } catch (e) {
//   console.error(e);
// }
//--------------------------------------------------------------------------------
// // SVG implementation (too slow)
// if (!this.svg2 || !this.p2 || !this.svgScene) return;
// this.svg2.firstChild?.remove();
// this.p2.setAttributeNS("http://www.w3.org/2000/svg", "d", svgPath);
// this.svg2.appendChild(this.p2);
// this.svgScene.content = this.svg2;
// this.svgScene.refresh();
//----------------------------------------------------------------------------------
// // FASTEST BUT VERY JAGGED:
// const prev = points.at(-2);
// const curr = points.at(-1);
// if (!prev || !curr) return;
// console.log(`(${prev[0]}, ${prev[1]}) (${curr[0]}, ${curr[1]})`);
// // const rcolor = getRandomIntInclusive(0, 0xffffff);
// this.path.beginFill();
// this.path.lineStyle({ width: 3, color: ctn(color) });
// this.path.moveTo(prev[0], prev[1]);
// this.path.lineTo(curr[0], curr[1]);
// this.path.endFill();
//----------------------------------------------------------------------------------
