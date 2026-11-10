import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { VolumeControl } from "#/game/components/VolumeControl.tsx";
import { useSettingsStore } from "#/game/settings-store.ts";
import { m } from "#/i18n/paraglide/messages.js";

const audio = () => useSettingsStore.getState().audio;
const slider = () => screen.getByLabelText(m.settings_audio_volume()) as HTMLInputElement;

describe("VolumeControl", () => {
  beforeEach(() => {
    useSettingsStore.setState({ audio: { enabled: true, volume: 0.5 } });
  });

  it("el slider cambia el volumen", () => {
    render(<VolumeControl />);
    fireEvent.change(slider(), { target: { value: "30" } });
    expect(audio()).toEqual({ enabled: true, volume: 0.3 });
  });

  it("el botón silencia y reactiva conservando el volumen", () => {
    render(<VolumeControl />);
    fireEvent.click(screen.getByRole("button", { name: m.audio_mute() }));
    expect(audio()).toEqual({ enabled: false, volume: 0.5 });
    expect(slider().value).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: m.audio_unmute() }));
    expect(audio()).toEqual({ enabled: true, volume: 0.5 });
  });

  it("mover el slider estando silenciado reactiva el audio", () => {
    useSettingsStore.setState({ audio: { enabled: false, volume: 0.5 } });
    render(<VolumeControl />);
    fireEvent.change(slider(), { target: { value: "70" } });
    expect(audio()).toEqual({ enabled: true, volume: 0.7 });
  });

  it("volumen 0 cuenta como silencio y al reactivar restaura uno audible", () => {
    useSettingsStore.setState({ audio: { enabled: true, volume: 0 } });
    render(<VolumeControl />);
    fireEvent.click(screen.getByRole("button", { name: m.audio_unmute() }));
    expect(audio()).toEqual({ enabled: true, volume: 0.5 });
  });
});
