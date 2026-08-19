import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, MapPin, TriangleAlert, Shirt } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meteo Verona — Previsioni e consigli su cosa indossare" },
      {
        name: "description",
        content:
          "Scegli un giorno della settimana e scopri la previsione meteo più vicina per Verona, con consigli su cosa indossare. Dati Open-Meteo.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Meteo Verona — Previsioni e consigli su cosa indossare" },
      {
        property: "og:description",
        content:
          "Scegli un giorno della settimana e scopri la previsione meteo più vicina per Verona, con consigli su cosa indossare.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeteoVerona,
});

const VERONA_LAT = 45.4384;
const VERONA_LON = 10.9916;

// Mappa dei weather code WMO -> descrizione + emoji
const WEATHER_CODES: Record<number, [string, string]> = {
  0: ["Cielo sereno", "☀️"],
  1: ["Prevalentemente sereno", "🌤️"],
  2: ["Parzialmente nuvoloso", "⛅"],
  3: ["Nuvoloso", "☁️"],
  45: ["Nebbia", "🌫️"],
  48: ["Nebbia con brina", "🌫️"],
  51: ["Pioviggine leggera", "🌦️"],
  53: ["Pioviggine moderata", "🌦️"],
  55: ["Pioviggine intensa", "🌧️"],
  56: ["Pioviggine gelata leggera", "🌧️"],
  57: ["Pioviggine gelata intensa", "🌧️"],
  61: ["Pioggia leggera", "🌧️"],
  63: ["Pioggia moderata", "🌧️"],
  65: ["Pioggia forte", "🌧️"],
  66: ["Pioggia gelata leggera", "🌧️"],
  67: ["Pioggia gelata forte", "🌧️"],
  71: ["Neve leggera", "🌨️"],
  73: ["Neve moderata", "🌨️"],
  75: ["Neve forte", "❄️"],
  77: ["Granelli di neve", "❄️"],
  80: ["Rovesci leggeri", "🌦️"],
  81: ["Rovesci moderati", "🌧️"],
  82: ["Rovesci violenti", "⛈️"],
  85: ["Rovesci di neve leggeri", "🌨️"],
  86: ["Rovesci di neve forti", "❄️"],
  95: ["Temporale", "⛈️"],
  96: ["Temporale con grandine leggera", "⛈️"],
  99: ["Temporale con grandine forte", "⛈️"],
};

const DAY_NAMES = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

const DAY_OPTIONS: Array<[number, string]> = [
  [1, "Lunedì"],
  [2, "Martedì"],
  [3, "Mercoledì"],
  [4, "Giovedì"],
  [5, "Venerdì"],
  [6, "Sabato"],
  [0, "Domenica"],
];

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const CLEAR_CODES = new Set([0, 1]);
const FOG_CODES = new Set([45, 48]);

function getClothingAdvice(code: number, tMax: number, tMin: number): Array<[string, string]> {
  const tips: Array<[string, string]> = [];

  if (SNOW_CODES.has(code)) {
    tips.push(["🧥", "Giacca pesante"], ["🧣", "Sciarpa e guanti"], ["🥾", "Scarpe impermeabili"]);
  } else if (tMin <= 5) {
    tips.push(["🧥", "Giacca pesante"], ["🧢", "Berretto"]);
  } else if (tMin <= 12) {
    tips.push(["🧥", "Giacca media"]);
  } else if (tMin <= 18) {
    tips.push(["👕", "Maglione o giacca leggera"]);
  } else {
    tips.push(["👕", "Vestiti leggeri"]);
  }

  if (RAIN_CODES.has(code)) {
    tips.push(["☂️", "Ombrello"]);
  }

  if (FOG_CODES.has(code)) {
    tips.push(["🌫️", "Attenzione, visibilità ridotta"]);
  }

  if (CLEAR_CODES.has(code) && tMax >= 20) {
    tips.push(["🕶️", "Occhiali da sole"]);
  }

  if (tMax >= 28) {
    tips.push(["🧴", "Protezione solare"]);
  }

  return tips;
}

interface Forecast {
  dayName: string;
  dateLabel: string;
  description: string;
  emoji: string;
  tMin: number;
  tMax: number;
  tips: Array<[string, string]>;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

function MeteoVerona() {
  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function showWeather() {
    setLoading(true);
    setForecast(null);
    setError(null);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${VERONA_LAT}&longitude=${VERONA_LON}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FBerlin&forecast_days=16`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Errore API: ${res.status}`);
      const data: OpenMeteoResponse = await res.json();

      const { time: dates, weathercode: codes, temperature_2m_max: tmax, temperature_2m_min: tmin } =
        data.daily;

      let foundIndex = -1;
      for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
        if (dateStr === undefined) continue;
        const d = new Date(dateStr + "T12:00:00");
        if (d.getDay() === selectedDay) {
          foundIndex = i;
          break;
        }
      }

      const foundDate = dates[foundIndex];
      const foundCode = codes[foundIndex];
      const foundMax = tmax[foundIndex];
      const foundMin = tmin[foundIndex];
      if (
        foundIndex === -1 ||
        foundDate === undefined ||
        foundCode === undefined ||
        foundMax === undefined ||
        foundMin === undefined
      ) {
        setError("Nessuna previsione disponibile per questo giorno nei prossimi 16 giorni.");
        return;
      }

      const [desc, emoji] = WEATHER_CODES[foundCode] ?? ["Condizione sconosciuta", "❓"];
      const dateObj = new Date(foundDate + "T12:00:00");
      const dateLabel = dateObj.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const roundedMax = Math.round(foundMax);
      const roundedMin = Math.round(foundMin);

      setForecast({
        dayName: DAY_NAMES[selectedDay] ?? "",
        dateLabel,
        description: desc,
        emoji,
        tMin: roundedMin,
        tMax: roundedMax,
        tips: getClothingAdvice(foundCode, roundedMax, roundedMin),
      });
    } catch (err) {
      setError(`Si è verificato un errore: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-6 py-16">
      <main className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Meteo previsto — Verona</h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">
          Scegli un giorno della settimana per vedere la previsione più vicina
        </p>

        <div className="flex items-center justify-center gap-2">
          <label htmlFor="day-select" className="text-sm text-foreground">
            Giorno:
          </label>
          <select
            id="day-select"
            value={selectedDay}
            onChange={(e) => setSelectedDay(Number(e.target.value))}
            className="rounded-lg border border-input bg-card px-4 py-2.5 text-base text-card-foreground"
          >
            {DAY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={showWeather}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2.5 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-default disabled:opacity-50"
          >
            {loading ? "Carico..." : "Mostra meteo"}
          </button>
        </div>

        <div className="mt-10 min-h-24">
          {error && <p className="text-destructive">{error}</p>}

          {forecast && (
            <div className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <div className="text-5xl" aria-hidden="true">
                {forecast.emoji}
              </div>
              <div className="mt-2 font-semibold">{forecast.dayName}</div>
              <div className="text-sm text-muted-foreground">{forecast.dateLabel}</div>
              <div className="my-2 text-xl">{forecast.description}</div>
              <div>
                Min {forecast.tMin}°C — Max {forecast.tMax}°C
              </div>
              <ul className="mt-5 flex list-none flex-wrap justify-center gap-2 p-0">
                {forecast.tips.map(([icon, text]) => (
                  <li
                    key={text}
                    className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-sm"
                  >
                    <span aria-hidden="true">{icon}</span> {text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
