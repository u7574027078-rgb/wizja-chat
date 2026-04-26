// Definicje trybów analizy — carotid, TCD/TCCD, struktury mózgu
export type RegionCategory = "carotid" | "tcd" | "brain";

export interface RegionOption {
  id: string;
  label: string;
  description?: string;
  category: RegionCategory;
}

export const REGION_GROUPS: { category: RegionCategory; title: string; icon: string; regions: RegionOption[] }[] = [
  {
    category: "carotid",
    title: "USG tętnic szyjnych",
    icon: "📍",
    regions: [
      { id: "cca", label: "Tętnica szyjna wspólna (CCA)", category: "carotid" },
      { id: "bifurcation", label: "Bifurkacja", category: "carotid" },
      { id: "ica", label: "Tętnica szyjna wewnętrzna (ICA)", category: "carotid" },
      { id: "eca", label: "Tętnica szyjna zewnętrzna (ECA)", category: "carotid" },
      { id: "va", label: "Tętnica kręgowa (VA)", category: "carotid" },
      { id: "imt", label: "Pomiar IMT", description: "Intima-media thickness", category: "carotid" },
      { id: "doppler-carotid", label: "Doppler kolorowy / spektralny", category: "carotid" },
      { id: "vji", label: "Żyła szyjna wewnętrzna (VJI)", category: "carotid" },
    ],
  },
  {
    category: "tcd",
    title: "TCD / TCCD",
    icon: "🧠",
    regions: [
      { id: "mca", label: "MCA — tętnica środkowa mózgu", category: "tcd" },
      { id: "aca", label: "ACA — tętnica przednia mózgu", category: "tcd" },
      { id: "pca", label: "PCA — tętnica tylna mózgu", category: "tcd" },
      { id: "va-ba", label: "VA / BA — kręgowa / podstawna", category: "tcd" },
      { id: "willis", label: "Koło tętnicze Willisa", category: "tcd" },
      { id: "tccd-bmode", label: "TCCD — B-mode + Doppler", category: "tcd" },
      { id: "co2-bhi", label: "Test reaktywności CO2 (BHI)", category: "tcd" },
      { id: "vasospasm", label: "Vasospasm po SAH", category: "tcd" },
      { id: "embolus", label: "Embolus monitoring", category: "tcd" },
    ],
  },
  {
    category: "brain",
    title: "Struktury mózgu (TCCD)",
    icon: "🧠",
    regions: [
      { id: "cerebral-vessels", label: "Naczynia mózgowe (Doppler)", category: "brain" },
      { id: "ventricles", label: "Komory mózgu (przez okno skroniowe)", category: "brain" },
      { id: "midline", label: "Mid-line shift", category: "brain" },
      { id: "substantia-nigra", label: "Substantia nigra (TCS — Parkinson)", category: "brain" },
      { id: "lentiform", label: "Jądra soczewkowate (MSA, atypowe)", category: "brain" },
      { id: "raphe", label: "Raphe nuclei (depresja)", category: "brain" },
    ],
  },
];

export function findRegion(id: string): RegionOption | undefined {
  for (const g of REGION_GROUPS) {
    const r = g.regions.find((x) => x.id === id);
    if (r) return r;
  }
  return undefined;
}
