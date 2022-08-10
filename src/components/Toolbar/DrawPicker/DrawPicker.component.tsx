import { AnimatePresence } from "framer-motion";
import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import { usePaperState } from "../../../contexts/PaperContext";
import { BrushOptions } from "../../../modules/items/Brush";
import { Tool } from "../../../modules/PixiApplication";
import { clamp } from "../../../utils/utils";
import {
  Circle,
  BrushButton,
  Container,
  Header,
  Modify,
  Presets,
  Selector,
  NumInput,
  StrokeContainer,
  SmallButton,
  NumInputContainer,
  NumInputLabel,
} from "./DrawPicker.styles";

const ColorPicker = () => {
  return <div></div>;
};

export interface PresetOptions extends BrushOptions {
  id: string;
}

export type MappedPresetOptions = { [id: string]: PresetOptions };

const default_presets: MappedPresetOptions = {
  a: { id: "a", size: 3, color: "#d2fab5" },
  b: { id: "b", size: 6, color: "#7050cc" },
  c: { id: "c", size: 9, color: "#ffffff" },
  d: { id: "d", size: 12, color: "#c544b0" },
  e: { id: "e", size: 17, color: "#2e8df9" },
  f: { id: "f", size: 18, color: "#ecdf2e" },
  g: { id: "g", size: 22, color: "#cb5151" },
  h: { id: "h", size: 25, color: "#3dc973" },
};

type Props = {};

const DrawPicker = ({}: Props) => {
  const { pixim } = usePaperState();
  const [presets, setPresets] = useState<MappedPresetOptions>(default_presets);
  const [activePid, setActivePid] = useState("a");

  const currentPreset = presets[activePid];

  const updatePreset = (value: PresetOptions) => {
    setPresets((presets) => {
      if (!presets[value.id]) return presets;

      pixim.current.drawTool.setOptions(value);

      const copy = { ...presets };
      copy[value.id] = value;
      return copy;
    });
  };

  useEffect(() => {
    const opt = presets[activePid];

    if (opt) pixim.current.drawTool.setOptions(opt);
  }, [activePid]);

  return (
    <Container>
      <Presets>
        {Object.entries(presets).map(([id, options]) => (
          <BrushPreview
            key={id}
            activeId={activePid}
            options={options}
            onClick={() => setActivePid(id)}
          />
        ))}
      </Presets>
      <Modify>
        <NumberInput preset={currentPreset} updatePreset={updatePreset} />
        <NumberInput preset={currentPreset} updatePreset={updatePreset} />
      </Modify>
    </Container>
  );
};

//--------------------------------------------------------------------------------
type BrushPreviewProps = {
  activeId: string;
  options: PresetOptions;
  onClick: any;
};

const BrushPreview = ({ activeId, options, onClick }: BrushPreviewProps) => {
  const highlight = activeId === options.id;

  return (
    <BrushButton onClick={onClick}>
      {highlight && <Selector layoutId="brush-selected" />}

      <Circle presetOptions={options}></Circle>
    </BrushButton>
  );
};

//--------------------------------------------------------------------------------
type NumberInputProps = {
  preset: PresetOptions;
  updatePreset: (value: PresetOptions) => void;
  min?: number;
  max?: number;
};

const NumberInput = ({
  preset,
  updatePreset,
  min = 1,
  max = 25,
}: NumberInputProps) => {
  const { id, size } = preset;

  const stepper = (step = 1) => {
    updatePreset({ ...preset, size: clamp(size + step, min, max) });
  };

  const increment = () => stepper(1);
  const decrement = () => stepper(-1);

  const htmlId = `draw-${id}`;

  return (
    <NumInputContainer>
      <NumInputLabel htmlFor={htmlId}>SIZE</NumInputLabel>
      <StrokeContainer>
        <SmallButton type="button" onClick={decrement}>
          -
        </SmallButton>
        <NumInput id={htmlId} type="number" value={size} readOnly></NumInput>
        <SmallButton type="button" onClick={increment}>
          +
        </SmallButton>
      </StrokeContainer>
    </NumInputContainer>
  );
};

export default DrawPicker;