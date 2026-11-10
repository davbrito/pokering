import { Volume1, Volume2, VolumeX } from "lucide-react";
import { m } from "#/i18n/paraglide/messages.js";
import { useSettingsStore } from "../settings-store";

const DEFAULT_VOLUME = 0.5;

/** Botón mute/unmute + slider de volumen. Un volumen de 0 equivale a silenciar. */
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
    <div className="flex items-center gap-2">
      <button type="button" className="settings-gear" aria-label={label} title={label} onClick={toggleMute}>
        <Icon size={18} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        aria-label={m.settings_audio_volume()}
        onChange={(e) => changeVolume(Number(e.target.value) / 100)}
        className="audio-slider w-20"
      />
    </div>
  );
}
