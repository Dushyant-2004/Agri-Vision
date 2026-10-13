"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

function MapCenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([latitude, longitude], 10, { duration: 1.2 });
  }, [latitude, longitude, map]);
  return null;
}

export default function LocationMap({ latitude, longitude, location }: { latitude: number; longitude: number; location: string }) {
  const markerIcon = useMemo(() => L.divIcon({
    className: "location-marker-icon",
    html: '<span class="location-marker-pulse"></span><span class="location-marker-pin"><span></span></span>',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
  }), []);

  return <div className="leaflet-map-wrap" aria-label={`Map centered on ${location}`}>
    <MapContainer center={[latitude, longitude]} zoom={10} scrollWheelZoom className="leaflet-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapCenter latitude={latitude} longitude={longitude} />
      <Marker position={[latitude, longitude]} icon={markerIcon} title={location} />
    </MapContainer>
  </div>;
}
