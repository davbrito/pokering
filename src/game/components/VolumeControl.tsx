import { Popover } from "@base-ui/react/popover";
import { Slider } from "@base-ui/react/slider";
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { m } from "#/i18n/paraglide/messages.js";
import { useSettingsStore } from "../settings-store";

const DEFAULT_VOLUME = 0.5;

/**
 * Icono de audio que abre (con click) un popover con mute/unmute y el slider de volumen.
 * Un volumen de 0 equivale a silenciar.
 */
export function VolumeControl() {
  const enabled = useSettingsStore((s) => s.audio.enabled);
  const volume = useSettingsStore((s) => s.audio.volume);
  const setAudioEnabled = useSettingsStore((s) => s.setAudioEnabled);
  const setAudioVolume = useSettingsStore((s) => s.setAudioVolume);

  const muted = !enabled || volume === 0;
  const percent = muted ? 0 : Math.round(volume * 100);
  const label = muted ? m.audio_unmute() : m.audio_mute();
  const Icon = muted ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const toggleMute = () => {
    if (muted) {
      // Al reactivar con volumen 0, restauramos uno audible.
      if (volume === 0) setAudioVolume(DEFAULT_VOLUME);
      setAudioEnabled(true);
    } else {
      setAudioEnabled(false);
    }
  };

  const changeVolume = (value: number) => {
    setAudioVolume(value);
    // Mover el slider mientras está silenciado reactiva el audio.
    if (value > 0 && !enabled) setAudioEnabled(true);
  };

  return (
    <Popover.Root>
      <Popover.Trigger
        className="settings-gear cursor-pointer"
        aria-label={m.settings_audio_title()}
        title={m.settings_audio_title()}
      >
        <Icon size={24} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="center">
          <Popover.Popup className="bg-surface border-border2 flex flex-col items-center gap-3 rounded-lg border p-3 shadow-lg">
            <span className="text-muted w-[4ch] text-center font-mono text-[11px] tabular-nums">{percent}%</span>
            <Slider.Root
              orientation="vertical"
              min={0}
              max={100}
              value={percent}
              onValueChange={(v) => changeVolume((Array.isArray(v) ? (v[0] ?? 0) : v) / 100)}
            >
              <Slider.Control className="flex h-28 w-5 touch-none items-center justify-center select-none">
                <Slider.Track className="bg-border2 h-full w-1 rounded-full select-none">
                  <Slider.Indicator className="bg-accent w-full rounded-full select-none" />
                  <Slider.Thumb
                    getAriaLabel={() => m.settings_audio_volume()}
                    className="bg-accent focus-visible:outline-accent size-3.5 rounded-full select-none focus-visible:outline-2 focus-visible:outline-offset-2"
                  />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
            <button type="button" className="settings-gear cursor-pointer" aria-label={label} title={label} onClick={toggleMute}>
              <Icon size={24} />
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
