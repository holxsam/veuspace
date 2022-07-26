import { useTheme } from "@emotion/react";
import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useRef,
  useState,
} from "react";
import { useEffect } from "react";
import { useMediaQuery } from "react-responsive";

// styling:
import styled from "@emotion/styled";
// import { contentCenter } from "../../styles/content-centerer";
import { fabric } from "fabric";

import { clamp } from "../utils/utils";
import useUpdatedState from "../hooks/useUpdatedState";

export type CanvasMode =
  | "select"
  | "draw"
  | "pan"
  | "text_add"
  | "text_edit"
  | "reset";

export const MODES: Record<CanvasMode, CanvasMode> = {
  select: "select",
  draw: "draw",
  pan: "pan",
  text_add: "text_add",
  text_edit: "text_edit",
  reset: "reset",
};

type State = {
  canvas: React.MutableRefObject<fabric.Canvas>;
  prevMode: React.MutableRefObject<CanvasMode>;
  mode: React.MutableRefObject<CanvasMode>;
  renderMode: CanvasMode;
  setMode: (val: CanvasMode) => void;

  toggleMode: (newMode: CanvasMode) => void;
  setBackground: (
    type: "dot" | "grid" | "hline" | "vline",
    patternColor: string,
    backgroundColor: string
  ) => void;
};

type Props = {
  children: React.ReactNode;
};

const PaperSpaceStateContext = createContext<State | undefined>(undefined);
const PaperSpaceStateProvider = ({ children }: Props) => {
  // fabric states:
  const canvas = useRef<fabric.Canvas>(new fabric.Canvas(""));
  const prevMode = useRef<CanvasMode>("select");

  const [mode, renderMode, setMode] = useUpdatedState<CanvasMode>("select");
  const [rmb, , setRMB] = useUpdatedState<boolean>(false); // right mouse button
  const [lmb, , setLMB] = useUpdatedState<boolean>(false); // left mouse button

  const toggleMode = (newMode: CanvasMode) => {
    setMode(newMode);

    // keeps track of the latest mode selected that is NOT the "pan" mode:
    if (newMode !== MODES.pan) prevMode.current = newMode;
  };

  const changeCursor = (cursor: string) => {
    canvas.current.setCursor(cursor);
    canvas.current.defaultCursor = cursor;
    canvas.current.moveCursor = cursor;
    canvas.current.hoverCursor = cursor;
    canvas.current.rotationCursor = cursor;
    canvas.current.freeDrawingCursor = cursor;
    canvas.current.notAllowedCursor = cursor;
    canvas.current.requestRenderAll();
  };

  const hackyRefresh = () => {
    changeCursor("wait");
    // hacky way to get the pattern to appear not as a black blackground
    setTimeout(() => {
      console.log("changed back");
      changeCursor("default");
    }, 0);
  };

  const setBackground = (
    type: "dot" | "grid" | "hline" | "vline",
    patternColor: string,
    backgroundColor: string
  ) => {
    const gap = 30;

    const patternCanvas = new fabric.StaticCanvas("", {
      backgroundColor,

      // backgroundColor: ,
      // fill: "white",
      fill: "transparent",
      width: gap,
      height: gap,
      // imageSmoothingEnabled: false,
      // enableRetinaScaling: false,
    });

    const dot = new fabric.Rect({
      width: 1,
      height: 1,
      fill: patternColor,
      strokeWidth: 0,
      // dirty: false,
    });

    const hLine = new fabric.Rect({
      width: gap,
      height: 1,
      fill: patternColor,
      strokeWidth: 0,

      // dirty: false,
    });

    const vLine = new fabric.Rect({
      width: 1,
      height: gap,
      fill: patternColor,
      strokeWidth: 0,

      // dirty: false,
    });

    switch (type) {
      case "dot":
        patternCanvas.add(dot);
        break;
      case "grid":
        patternCanvas.add(hLine);
        patternCanvas.add(vLine);
        break;
      case "hline":
        patternCanvas.add(hLine);
        break;
      case "vline":
        patternCanvas.add(vLine);
        break;
    }

    const pattern = new fabric.Pattern({
      offsetX: gap / 2,
      offsetY: gap / 2,
      source: patternCanvas.toDataURL(),
      repeat: "repeat",
    });

    canvas.current.setBackgroundColor(pattern, hackyRefresh);
  };

  const addText = (position: { x: number; y: number }) => {
    const text = new fabric.Textbox("", {
      fontFamily: "Fira Code",
      fill: "red",
      left: position.x,
      top: position.y,
      width: 200,
      height: 500,
    });

    text.on("editing:entered", (e) => {
      console.log("editing:entered");
      toggleMode(MODES.text_edit);
    });

    text.on("editing:exited", (e) => {
      console.log("editing:exited");
      toggleMode(MODES.select);
      console.log("text we have", text.text);
    });

    text.on("selection:changed", (e) => {
      console.log("selection:changed");
    });

    text.on("event:deselected", (e) => {
      console.log("deselect");
    });

    canvas.current.add(text);
    canvas.current.renderAll();
    canvas.current.setActiveObject(text);

    toggleMode(MODES.select);
  };

  const pan = (point: { x: number; y: number }) => {
    const delta = new fabric.Point(point.x, point.y);
    canvas.current.relativePan(delta);
  };

  const zoom = (dy: number, point: { x: number; y: number }, step = 0.1) => {
    const dir = -dy / Math.abs(dy);
    const cursorPosition = new fabric.Point(point.x, point.y);

    const zoomLvl = canvas.current.getZoom() + dir * step;
    canvas.current.zoomToPoint(cursorPosition, clamp(zoomLvl, 0.5, 4));
  };

  // This useEffect is divided into TWO parts (make sure you understand how and why)
  useEffect(() => {
    // -------------------------------------------------------------------------------
    // 1. TRIGGERS BASED ON EVENTS:
    // you should only call toggleMode in these listeners
    // meaning don't write code for an action
    // -------------------------------------------------------------------------------
    const keyboardTriggers = (e: KeyboardEvent) => {
      console.log("keydown", mode.current, renderMode);

      if (mode.current === MODES.text_edit) return;

      const key = e.key.toLocaleLowerCase();

      if (key === "s" || e.shiftKey) {
        toggleMode(MODES.select);
      }

      if (key === "d") {
        toggleMode(MODES.draw);
      }

      if (key === "f") {
        toggleMode(MODES.pan);
      }

      if (key === "t") {
        toggleMode(MODES.text_add);
      }
    };

    const mouseDownTriggers = (e: fabric.IEvent<MouseEvent>) => {
      console.log("mousedown", mode.current, renderMode);

      // left mouse button down:
      if (e.button === 1) {
        setLMB(true);
      }

      // middle mouse button down:
      if (e.button === 2) {
      }

      // right mouse button down:
      if (e.button === 3) {
        setRMB(true);
        toggleMode(MODES.pan);
      }
    };

    const mouseUpTriggers = (e: fabric.IEvent<MouseEvent>) => {
      console.log("mouseup", mode.current, renderMode);

      // left mouse button down:
      if (e.button === 1) {
        setLMB(false);
      }

      // middle mouse button down:
      if (e.button === 2) {
      }

      // right mouse button down:
      if (e.button === 3) {
        setRMB(false);
        toggleMode(prevMode.current);
      }
    };

    window.addEventListener("keydown", keyboardTriggers);
    canvas.current.on("mouse:down", mouseDownTriggers);
    canvas.current.on("mouse:up", mouseUpTriggers);

    // -------------------------------------------------------------------------------
    // 2. ACTIONS BASED ON CURRENT MODE AND AN EVENT:
    // define actions per event and mode combination
    // -------------------------------------------------------------------------------
    const mouseWheelAction = (fe: fabric.IEvent<WheelEvent>) => {
      console.log("mouse:wheel", mode.current, renderMode);
      zoom(fe.e.deltaY, { x: fe.e.offsetX, y: fe.e.offsetY });
      fe.e.preventDefault();
      fe.e.stopPropagation();
    };

    const mouseDownAction = (fe: fabric.IEvent<MouseEvent>) => {
      console.log("mouse:down", mode.current, renderMode);

      if (mode.current === MODES.pan) {
      }
    };

    const mouseUpAction = (fe: fabric.IEvent<MouseEvent>) => {
      console.log("mouse:up", mode.current, renderMode);

      if (mode.current === MODES.text_add && fe.button === 1) {
        const cursorPosition = canvas.current.getPointer(fe.e);
        addText(cursorPosition);
      }
    };

    const mouseMoveAction = (fe: fabric.IEvent<MouseEvent>) => {
      // console.log("mouse:move", mode.current, renderMode);

      if (mode.current === MODES.pan && (lmb.current || rmb.current)) {
        pan({ x: fe.e.movementX, y: fe.e.movementY });
      }
    };

    canvas.current.on("mouse:wheel", mouseWheelAction);
    canvas.current.on("mouse:down", mouseDownAction);
    canvas.current.on("mouse:up", mouseUpAction);
    canvas.current.on("mouse:move", mouseMoveAction);

    return () => {
      canvas.current.off();
      window.removeEventListener("keydown", keyboardTriggers);
    };
  }, []);

  // Side effects for each mode:
  useEffect(() => {
    switch (mode.current) {
      case MODES.select:
        canvas.current.isDrawingMode = false;
        canvas.current.selection = true;
        changeCursor("default");
        break;
      case MODES.pan:
        canvas.current.isDrawingMode = false;
        canvas.current.selection = false;
        changeCursor("grabbing");
        break;
      case MODES.draw:
        canvas.current.isDrawingMode = true;
        canvas.current.selection = false;
        changeCursor("crosshair");
        break;
      case MODES.text_add:
        canvas.current.isDrawingMode = false;
        canvas.current.selection = false;
        changeCursor("text");
        break;
      case MODES.text_edit:
        canvas.current.isDrawingMode = false;
        canvas.current.selection = false;
        changeCursor("text");
        break;
      default:
        break;
    }
  }, [renderMode]);

  return (
    <PaperSpaceStateContext.Provider
      value={{
        canvas,
        prevMode,
        mode,
        renderMode,
        setMode,
        toggleMode,
        setBackground,
      }}
    >
      {children}
    </PaperSpaceStateContext.Provider>
  );
};

const usePaperSpaceState = () => {
  const context = useContext(PaperSpaceStateContext);
  if (context === undefined)
    throw new Error("useUIState must be used within a UIStateProvider");
  return context;
};

export { PaperSpaceStateProvider, usePaperSpaceState };
