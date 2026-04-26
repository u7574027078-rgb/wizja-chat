// Presety filtrów obrazowych — implementowane jako CSS filter na canvasie/wideo
export interface FilterPreset {
  id: string;
  label: string;
  // CSS filter string
  filter: string;
  description: string;
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: "none",
    label: "Bez filtra",
    filter: "none",
    description: "Surowy obraz",
  },
  {
    id: "carotid-bmode",
    label: "Carotid B-mode",
    filter: "contrast(1.3) saturate(1) brightness(1) ", // ostrość przez canvas convolution opcjonalnie
    description: "Kontrast 130%, ostrość 35%",
  },
  {
    id: "carotid-doppler",
    label: "Carotid Doppler kolor",
    filter: "contrast(1.1) saturate(1.4)",
    description: "Saturacja 140%, kontrast 110%",
  },
  {
    id: "tcd-spectral",
    label: "TCD spektralny",
    filter: "contrast(1.5) brightness(0.9)",
    description: "Kontrast 150%, jasność 90%",
  },
  {
    id: "tccd-temporal",
    label: "TCCD przez okno skroniowe",
    filter: "contrast(1.6) brightness(1.05)",
    description: "Kontrast 160%, gamma ~0.7",
  },
];
