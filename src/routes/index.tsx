import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Activity, ArrowDown, ArrowUp, Loader2, MapPin, TriangleAlert, Shirt } from "lucide-react";

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

const DAY_NAMES = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

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

function getActivityAdvice(code: number, tMax: number, tMin: number): Array<[string, string]> {
  const tips: Array<[string, string]> = [];

  if (SNOW_CODES.has(code)) {
    tips.push(["⛷️", "Sci o passeggiata sulla neve"], ["☕", "Bevanda calda al rientro"]);
  } else if (RAIN_CODES.has(code)) {
    tips.push(["🎬", "Cinema o museo"], ["🏋️", "Palestra al coperto"]);
  } else if (FOG_CODES.has(code)) {
    tips.push(["🏠", "Meglio attività al chiuso"], ["⚠️", "Attenzione se guidi o vai in bici"]);
  } else if (tMax >= 30) {
    tips.push(["🏊", "Piscina o area d'ombra"], ["🌳", "Evita sport intensi nelle ore centrali"]);
  } else if (CLEAR_CODES.has(code) && tMax >= 18) {
    tips.push(["🚴", "Bici o passeggiata"], ["🧺", "Pic-nic all'aperto"]);
  } else if (tMin <= 5) {
    tips.push(["🏃", "Corsa (vestiti a strati)"], ["🚶", "Passeggiata veloce"]);
  } else {
    tips.push(["🚶", "Passeggiata"], ["🎾", "Sport all'aperto"]);
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
  activities: Array<[string, string]>;
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
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  async function showWeather(day: number) {
    const id = ++requestId.current;
    setSelectedDay(day);
    setLoading(true);
    setForecast(null);
    setError(null);

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${VERONA_LAT}&longitude=${VERONA_LON}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FBerlin&forecast_days=16`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Errore API: ${res.status}`);
      const data: OpenMeteoResponse = await res.json();

      const {
        time: dates,
        weathercode: codes,
        temperature_2m_max: tmax,
        temperature_2m_min: tmin,
      } = data.daily;

      let foundIndex = -1;
      for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
        if (dateStr === undefined) continue;
        const d = new Date(dateStr + "T12:00:00");
        if (d.getDay() === day) {
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
        throw new Error("Nessuna previsione disponibile per questo giorno nei prossimi 16 giorni.");
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

      if (id !== requestId.current) return; // risposta obsoleta, ignora
      setForecast({
        dayName: DAY_NAMES[day] ?? "",
        dateLabel,
        description: desc,
        emoji,
        tMin: roundedMin,
        tMax: roundedMax,
        tips: getClothingAdvice(foundCode, roundedMax, roundedMin),
        activities: getActivityAdvice(foundCode, roundedMax, roundedMin),
      });
    } catch (err) {
      if (id !== requestId.current) return;
      setError(`Si è verificato un errore: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  // Carica automaticamente la previsione del giorno corrente all'apertura
  useEffect(() => {
    void showWeather(new Date().getDay());
  }, []);

  const isToday = selectedDay === new Date().getDay();

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-6 py-16">
      <main className="w-full max-w-md">
        {/* Header */}
        <header className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            Verona, Italia
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Meteo Verona
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scegli un giorno e scopri come vestirti
          </p>
        </header>

        {/* Selettore giorni */}
        <div
          role="group"
          aria-label="Seleziona il giorno della settimana"
          className="mt-8 grid grid-cols-7 gap-1 rounded-xl border border-border bg-card p-1"
        >
          {DAY_OPTIONS.map(([value, label]) => {
            const active = value === selectedDay;
            return (
              <button
                key={value}
                onClick={() => showWeather(value)}
                aria-pressed={active}
                className={`rounded-lg px-1 py-2 text-xs font-medium transition-colors sm:text-sm ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {label.slice(0, 3)}
              </button>
            );
          })}
        </div>

        {/* Risultato */}
        <div className="mt-6 min-h-64">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-left text-sm text-foreground"
            >
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <p>{error}</p>
            </div>
          )}

          {loading && (
            <div
              className="rounded-xl border border-border bg-card p-6"
              aria-busy="true"
              aria-label="Caricamento previsione"
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-10 w-40 animate-pulse rounded bg-muted" />
                <div className="mt-3 flex gap-2">
                  <div className="h-7 w-24 animate-pulse rounded-full bg-muted" />
                  <div className="h-7 w-20 animate-pulse rounded-full bg-muted" />
                  <div className="h-7 w-28 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            </div>
          )}

          {forecast && !loading && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-card-foreground shadow-sm">
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                {forecast.dayName}
                {isToday && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    Oggi
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{forecast.dateLabel}</div>

              <div className="mt-4 text-6xl" aria-hidden="true">
                {forecast.emoji}
              </div>
              <div className="mt-1 text-lg font-medium">{forecast.description}</div>

              <div className="mt-5 flex items-center justify-center gap-8">
                <div className="flex items-center gap-2">
                  <ArrowUp className="size-4 text-destructive" aria-hidden="true" />
                  <span className="text-3xl font-semibold tabular-nums">{forecast.tMax}°</span>
                  <span className="self-start pt-1 text-xs text-muted-foreground">max</span>
                </div>
                <div className="h-10 w-px bg-border" aria-hidden="true" />
                <div className="flex items-center gap-2">
                  <ArrowDown className="size-4 text-chart-2" aria-hidden="true" />
                  <span className="text-3xl font-semibold tabular-nums text-muted-foreground">
                    {forecast.tMin}°
                  </span>
                  <span className="self-start pt-1 text-xs text-muted-foreground">min</span>
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Shirt className="size-3.5" aria-hidden="true" />
                  Cosa indossare
                </div>
                <ul className="mt-3 flex list-none flex-wrap justify-center gap-2 p-0">
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

              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Activity className="size-3.5" aria-hidden="true" />
                  Attività consigliate
                </div>
                <ul className="mt-3 flex list-none flex-wrap justify-center gap-2 p-0">
                  {forecast.activities.map(([icon, text]) => (
                    <li
                      key={text}
                      className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 text-sm"
                    >
                      <span aria-hidden="true">{icon}</span> {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-10 text-center text-xs text-muted-foreground">
          Dati: Open-Meteo · Aggiornati in tempo reale
        </footer>
      </main>
    </div>
  );
}
