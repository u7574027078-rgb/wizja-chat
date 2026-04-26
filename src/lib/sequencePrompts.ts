// Prompty AI dla analizy sekwencji wieloklatkowej — używane wyłącznie po stronie serwera
import type { RegionCategory } from "./regions";

interface Ctx {
  category: RegionCategory;
  regionLabel: string;
  sampleCount: number;
  videoDuration: number;
}

export function buildSequencePrompt(c: Ctx): string {
  if (c.category === "carotid") return carotid(c);
  if (c.category === "tcd") return tcd(c);
  return brain(c);
}

function carotid({ regionLabel, sampleCount, videoDuration }: Ctx): string {
  return `Jesteś specjalistą USG naczyniowego (angiosonografistą). Otrzymujesz ${sampleCount} klatek chronologicznie pobranych z ${videoDuration.toFixed(
    1,
  )}-sekundowego nagrania USG tętnicy szyjnej (region: ${regionLabel}).

Klatki są podane w kolejności czasowej (1 → ${sampleCount}). Reprezentują rozłożenie czasowe całego nagrania — jeśli to Doppler kolorowy lub spektralny, prawdopodobnie obejmują kilka cykli serca.

Strukturalny opis DYNAMICZNY:

1. RODZAJ BADANIA — rozpoznaj:
   - B-mode (skala szarości)
   - Doppler kolorowy (color flow mapping)
   - Doppler spektralny (krzywa)
   - Power Doppler
   - Triplex (B-mode + kolor + spektrum)
2. PROJEKCJA — długa / krótka oś, lokalizacja anatomiczna
3. JAKOŚĆ I STABILNOŚĆ — czy nagranie stabilne, ruchy sondy, artefakty
4. MORFOLOGIA NACZYNIA (jeśli widoczna B-mode):
   - Światło naczynia
   - Ściany (warstwowość, IMT wizualnie)
   - Blaszki miażdżycowe (lokalizacja, charakter, echogeniczność)
5. **DYNAMIKA PRZEPŁYWU (KLUCZOWE dla sekwencji)**:
   - Doppler kolorowy — wypełnienie światła w cyklu serca:
     * Faza skurczowa — intensywność, kierunek
     * Faza rozkurczowa — zachowanie przepływu
     * Aliasing w miejscach zwężeń
     * Brak wypełnienia (skrzeplina, niedrożność)
   - Doppler spektralny (jeśli widoczny):
     * Charakter krzywej (laminarna / turbulentna)
     * Wartości WYPALONE NA EKRANIE — PSV, EDV, RI, PI — **przepisz dosłownie** jeśli widoczne
     * Zmiany kształtu krzywej w sekwencji
     * Charakter rezystywny (RI) vs niskooporowy
6. RYTMICZNOŚĆ — zmienność przepływu między klatkami / cyklami
7. SUGEROWANE INTERPRETACJE (z wartości na obrazie, nie własne pomiary):
   - Klasyfikacja stenozy (NASCET / ECST):
     PSV ICA >125 cm/s → >50% stenoza
     PSV ICA >230 cm/s → >70% stenoza
     PSV ratio ICA/CCA >2 → istotna stenoza
8. RÓŻNICOWANIE I REKOMENDACJE (dodatkowe projekcje, CTA / MRA)

OGRANICZENIA — mocno podkreśl:
- ${sampleCount} klatek z ${videoDuration.toFixed(
    1,
  )}-sek nagrania — możesz przegapić szybkie zdarzenia
- Brak Twoich pomiarów — tylko wartości widoczne na obrazie
- Brak kontekstu klinicznego (wiek, MAP, leki, objawy)
- Brak porównania prawej / lewej strony

Format markdown, polski, terminologia precyzyjna. Zaznacz wyraźnie obserwacje czasowe (np. "w klatce 3 (faza skurczowa)…", "między klatką 2 a 5…").`;
}

function tcd({ regionLabel, sampleCount, videoDuration }: Ctx): string {
  return `Jesteś neurosonografistą. Otrzymujesz ${sampleCount} klatek chronologicznie z ${videoDuration.toFixed(
    1,
  )}-sek nagrania TCD/TCCD (deklarowane naczynie/struktura: ${regionLabel}).

Strukturalny opis DYNAMICZNY:

1. RODZAJ — TCD spektralny / TCCD z B-mode + kolorem
2. OKNO AKUSTYCZNE — skroniowe / oczne / karkowe / transforaminalne
3. STABILNOŚĆ I JAKOŚĆ OKNA W SEKWENCJI — czy okno stabilne, dryft sondy
4. CHARAKTER PRZEPŁYWU (między klatkami):
   - Krzywa spektralna — kształt, regularność, zmiany w cyklu
   - Wartości WYPALONE (PSV, EDV, MFV, PI, RI) — **przepisz dosłownie** jeśli widoczne
   - Wskaźnik Lindegaarda jeśli możliwy do oszacowania
5. INTERPRETACJA z disclaimerami:
   - MFV referencyjne: MCA 35-90, ACA 35-80, PCA 30-70 cm/s
   - Vasospasm po SAH: MFV MCA >120 łagodny, >200 ciężki
   - PI >1.2 = wzmożone opory wewnątrzczaszkowe
   - PI <0.5 = niewydolność tętnicy zaopatrującej (proksymalna stenoza)
6. RYTMICZNOŚĆ — czy regularny rytm spektralny w sekwencji
7. EMBOLI DETECTION (HITS) — czy widoczne high-intensity transients (krótkie błyski w spektrum)
8. SUGEROWANE NACZYNIE vs deklarowane "${regionLabel}" — czy obraz spójny

⚠ OGRANICZENIA — KRYTYCZNE:
- TCD jest wysoce zależny od operatora i kąta insonacji
- AI ma OGRANICZONĄ pewność w identyfikacji konkretnego naczynia
- ${sampleCount} klatek — pojedyncze HITS mogą być przegapione
- Brak kontekstu (CO2, MAP, wiek, objawy)
- Kąt insonacji nieznany — PSV może być niedoszacowane

Format markdown, polski. Zaznacz wyraźnie obserwacje czasowe.`;
}

function brain({ regionLabel, sampleCount, videoDuration }: Ctx): string {
  return `Jesteś neurosonografistą / radiologiem. Otrzymujesz ${sampleCount} klatek z ${videoDuration.toFixed(
    1,
  )}-sek nagrania USG mózgu (TCCD / przezciemiączkowe), deklarowana struktura: ${regionLabel}.

Strukturalny opis dynamiczny:

1. RODZAJ — TCCD u dorosłego (ograniczona wizualizacja) / przezciemiączkowe u noworodka / TCS
2. WIDOCZNE STRUKTURY:
   - Komory (boczne, III, IV) — wymiary, symetria, dynamika
   - Splot naczyniówkowy
   - Wzgórze, jądra podstawy, korpus modzelowaty
   - Pień mózgu, móżdżek
   - Substantia nigra / lentiform / raphe (echogeniczność jeśli TCS)
3. ASYMETRIE w sekwencji — mid-line shift, zmiany między klatkami
4. PATOLOGIA:
   - Wodogłowie (poszerzenie komór)
   - IVH I-IV (u noworodków)
   - PVL (leukomalacja okołokomorowa)
   - Krwawienia, obrzęk
   - Markery TCS: SN↑ (Parkinson), Lentiform↑ (MSA), Raphe↓ (depresja)
5. RUCH / TĘTNO MÓZGU — czy widoczne pulsacje w sekwencji
6. NACZYNIA (jeśli z Dopplerem):
   - Identyfikacja segmentów koła Willisa
   - Charakter przepływu MCA, ACA, PCA
7. RÓŻNICOWANIE I REKOMENDACJE

OGRANICZENIA:
- TCCD u dorosłego — ograniczona wizualizacja (czaszka tłumi)
- ${sampleCount} klatek z ${videoDuration.toFixed(1)}-sek nagrania — niepełna ocena
- Brak kontekstu klinicznego

Format markdown, polski. Zaznacz obserwacje czasowe.`;
}
