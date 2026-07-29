'use client';

import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LatLngExpression, LatLng, Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';


// This is the correct way to fix the default Leaflet icon path issue in Next.js
const defaultIcon = new Icon({
  iconUrl: "/marker-icon.png",
  iconRetinaUrl: "/marker-icon-2x.png",
  shadowUrl: "/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapSelectorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (coords: { lat: number; lng: number }) => void;
  initialPosition?: { latitude?: number; longitude?: number };
}

// Default position (e.g., center of India) if no initial position is provided
const DEFAULT_CENTER: LatLngExpression = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

// Component to handle map clicks and marker placement
function LocationMarker({ position, setPosition }: {
  position: LatLng | null;
  setPosition: (position: LatLng) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 13);
    }
  }, [position, map]);

  useMapEvents({
    click(e: any) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return position === null ? null : <Marker icon={defaultIcon} position={position}></Marker>;
}


export function MapSelector({ isOpen, onOpenChange, onSelect, initialPosition }: MapSelectorProps) {
  const startPosition = useMemo(() => {
    if (initialPosition?.latitude && initialPosition?.longitude) {
      return new LatLng(initialPosition.latitude, initialPosition.longitude);
    }
    return null;
  }, [initialPosition]);

  const [markerPosition, setMarkerPosition] = useState<LatLng | null>(startPosition);

  // Reset marker position when dialog re-opens with new initial data
  useEffect(() => {
    if (isOpen) {
      setMarkerPosition(startPosition);
    }
  }, [isOpen, startPosition]);

  const mapCenter = markerPosition || DEFAULT_CENTER;
  const mapZoom = markerPosition ? 13 : DEFAULT_ZOOM;

  const handleConfirm = () => {
    if (markerPosition) {
      onSelect({ lat: markerPosition.lat, lng: markerPosition.lng });
    }
    onOpenChange(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b pb-4 shrink-0">
          <DialogTitle className="text-xl">Adding New Item in Location</DialogTitle>
          <DialogDescription>Click on the map to place a marker at the desired address location.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 rounded-md overflow-hidden min-h-[50vh]">
          <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={markerPosition} setPosition={setMarkerPosition} />
          </MapContainer>
        </div>
        <DialogFooter className="border-t pt-4 mt-4 shrink-0 flex gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost" className="flex-1">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm} disabled={!markerPosition} className="flex-1 font-bold">
            Confirm Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
