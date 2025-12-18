
import { Coordinates } from "../types";

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
}

export const searchLocation = async (query: string): Promise<{ name: string; coords: Coordinates }[]> => {
  if (!query || query.length < 3) return [];

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch location data');
    }

    const data: NominatimResult[] = await response.json();

    return data.map((item) => ({
      name: item.display_name,
      coords: {
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      },
    }));
  } catch (error) {
    console.error("Nominatim Error:", error);
    return [];
  }
};
