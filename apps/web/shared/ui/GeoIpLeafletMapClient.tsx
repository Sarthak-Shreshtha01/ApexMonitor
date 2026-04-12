'use client';

import { useMemo } from 'react';
import worldCountries from 'world-countries';
import { CircleMarker, MapContainer, Pane, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import type { GeoMetricRow } from './GeoIpLeafletMap';

type GeoIpLeafletMapClientProps = {
  data: GeoMetricRow[];
  loading?: boolean;
  compact?: boolean;
  title?: string;
};

const format = (value: number) => Intl.NumberFormat('en').format(value);

type MarkerPoint = {
  key: string;
  country: string;
  region: string;
  views: number;
  lcp: number;
  lat: number;
  lng: number;
};

function MapViewport({ points }: { points: MarkerPoint[] }) {
  const map = useMap();

  useMemo(() => {
    if (points.length === 0) {
      map.setView([18, 8], 1.6);
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 3);
      return;
    }

    map.fitBounds(
      points.map((point) => [point.lat, point.lng]),
      { padding: [24, 24], maxZoom: 4 }
    );
  }, [map, points]);

  return null;
}

function HeatOverlay({ points, maxViews }: { points: MarkerPoint[]; maxViews: number }) {
  const map = useMap();

  useMemo(() => {
    const heatPoints = points.map((point) => {
      const intensity = Math.min(1, point.views / maxViews);
      return [point.lat, point.lng, intensity] as [number, number, number];
    });

    const heatLayer = L.heatLayer(heatPoints, {
      radius: 26,
      blur: 22,
      maxZoom: 5,
      minOpacity: 0.24,
      gradient: {
        0.15: '#3b0a0a',
        0.45: '#7a1111',
        0.72: '#b41616',
        1.0: '#ff2d2d',
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, maxViews, points]);

  return null;
}

export function GeoIpLeafletMapClient({
  data,
  loading = false,
  compact = false,
  title = 'Live IP Origin Map',
}: GeoIpLeafletMapClientProps) {
  const byIso = useMemo(() => {
    return worldCountries.reduce<Record<string, { lat: number; lng: number }>>((acc, country) => {
      const iso = (country.cca2 ?? '').toUpperCase();
      const latlng = country.latlng ?? [];

      if (iso && latlng.length >= 2) {
        acc[iso] = {
          lat: Number(latlng[0]),
          lng: Number(latlng[1]),
        };
      }

      return acc;
    }, {});
  }, []);

  const points = useMemo(() => {
    const merged = data.reduce<Record<string, MarkerPoint>>((acc, row) => {
      const code = row.country_code.toUpperCase();
      const coords = byIso[code];

      const lat = Number(coords?.lat);
      const lng = Number(coords?.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return acc;
      }

      const key = `${code}-${row.region_code.toUpperCase()}`;
      const existing = acc[key];

      if (existing) {
        existing.views += row.page_views;
        existing.lcp = row.avg_lcp_ms ?? existing.lcp;
        return acc;
      }

      acc[key] = {
        key,
        country: code,
        region: row.region_code,
        views: row.page_views,
        lcp: row.avg_lcp_ms ?? 0,
        lat,
        lng,
      };

      return acc;
    }, {});

    return Object.values(merged).sort((a, b) => b.views - a.views);
  }, [byIso, data]);

  const maxViews = useMemo(() => Math.max(1, ...points.map((point) => point.views)), [points]);
  const top = points[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{title}</p>
        <span className="text-[9px] font-mono font-medium text-zinc-500">{loading ? 'SYNCING...' : `${points.length} ORIGINS`}</span>
      </div>

      <div className={`relative rounded border border-white/10 bg-[#0A0A0A] overflow-hidden ${compact ? 'h-40' : 'h-44 sm:h-52'}`}>
        <div className="pointer-events-none absolute inset-0 z-401 bg-linear-to-b from-black/20 via-transparent to-black/35" />
        <MapContainer
          center={[18, 8] as LatLngExpression}
          zoom={1.6}
          minZoom={1}
          maxZoom={6}
          scrollWheelZoom={false}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          zoomControl={false}
          attributionControl={false}
          className="h-full w-full geo-ip-map"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            subdomains={["a", "b", "c", "d"]}
          />

          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
            subdomains={["a", "b", "c", "d"]}
            opacity={0.22}
          />

          <MapViewport points={points} />
          <HeatOverlay points={points} maxViews={maxViews} />

          <Pane name="glow" style={{ zIndex: 420 }}>
            {points.map((point) => {
              const ratio = Math.min(1, point.views / maxViews);
              return (
                <CircleMarker
                  key={`${point.key}-glow`}
                  center={[point.lat, point.lng]}
                  radius={9 + ratio * 18}
                  pathOptions={{
                    color: 'rgba(255, 98, 46, 0.12)',
                    weight: 0,
                    fillColor: 'rgba(255, 98, 46, 0.24)',
                    fillOpacity: 0.45,
                    className: 'geo-point-glow',
                  }}
                />
              );
            })}
          </Pane>

          {points.map((point) => {
            const ratio = Math.min(1, point.views / maxViews);
            const radius = Math.min(12, 2.6 + Math.log10(point.views + 1) * 2.4);
            return (
              <CircleMarker
                key={point.key}
                center={[point.lat, point.lng]}
                radius={radius}
                pathOptions={{
                  color: '#FFD3C4',
                  weight: 0.8,
                  fillColor: '#FF4500',
                  fillOpacity: 0.72,
                  className: 'geo-point-core',
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                  <div className="text-[11px] font-mono text-white">
                    <div>{point.country}/{point.region}</div>
                    <div>Views: {format(point.views)}</div>
                    <div>Avg LCP: {point.lcp.toFixed(0)}ms</div>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {top ? (
          <div className="absolute top-3 left-3 z-402 bg-black/60 border border-white/10 backdrop-blur-sm px-2 py-1 rounded pointer-events-none">
            <span className="text-[9px] font-mono font-medium tracking-wide text-white">
              TOP IP ORIGIN: {top.country}/{top.region} · {format(top.views)}
            </span>
          </div>
        ) : null}
      </div>

      {!compact ? (
        <p className="text-[10px] text-zinc-500">
          Location is inferred from incoming request IP geolocation headers and aggregated by country/region.
        </p>
      ) : null}
    </div>
  );
}
