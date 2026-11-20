"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapField = {
  id: string;
  name: string;
  crop: string;
  area: number;
  latitude: number;
  longitude: number;
};

type LeafletElement = HTMLDivElement & {
  _leaflet_id?: number;
  _agrivision_map?: L.Map;
};

function isMapCoordinate(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude > -90
    && latitude < 90
    && longitude >= -180
    && longitude <= 180;
}

export default function LocationMap({ latitude, longitude, location, fields = [] }: { latitude: number; longitude: number; location: string; fields?: MapField[] }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapFields = useMemo(() => fields.filter((field) => isMapCoordinate(field.latitude, field.longitude)), [fields]);
  const markerIcon = useMemo(() => L.divIcon({
    className: "location-marker-icon",
    html: '<span class="location-marker-pulse"></span><span class="location-marker-pin"><span></span></span>',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  }), []);

  useEffect(() => {
    const element = mapElement.current as LeafletElement | null;
    if (!element) return;

    element._agrivision_map?.remove();
    delete element._agrivision_map;
    delete element._leaflet_id;

    const center: [number, number] = mapFields[0] && isMapCoordinate(mapFields[0].latitude, mapFields[0].longitude)
      ? [mapFields[0].latitude, mapFields[0].longitude] as [number, number]
      : isMapCoordinate(latitude, longitude) ? [latitude, longitude] : [20, 0];
    const map = L.map(element, { scrollWheelZoom: true }).setView(center, 10);
    element._agrivision_map = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    if (isMapCoordinate(latitude, longitude)) {
      L.marker([latitude, longitude], { icon: markerIcon, title: location }).addTo(map);
    }
    mapFields.forEach((field) => {
      const fieldIcon = L.divIcon({
        className: "field-marker-icon",
        html: '<span class="field-marker-dot"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      L.marker([field.latitude, field.longitude], { icon: fieldIcon, title: field.name })
        .bindTooltip(`${field.name} · ${field.crop}`, { direction: "top", offset: [0, -8] })
        .addTo(map);
    });
    if (mapFields.length > 1) {
      map.fitBounds(L.latLngBounds(mapFields.map((field) => [field.latitude, field.longitude])), { padding: [28, 28] });
    }

    return () => {
      map.remove();
      delete element._agrivision_map;
      delete element._leaflet_id;
    };
  }, [latitude, longitude, location, mapFields, markerIcon]);

  return <div className="leaflet-map-wrap" aria-label={`Map centered on ${location}`}>
    <div ref={mapElement} className="leaflet-map" />
  </div>;
}
