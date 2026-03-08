export async function geocodeEvents(events) {
  const geocodedEvents = [];
  
  for (const event of events) {
    if (!event.venue) {
      geocodedEvents.push(event);
      continue;
    }
    
    try {
      const coords = await geocodeVenue(event.venue);
      geocodedEvents.push({
        ...event,
        lat: coords.lat,
        lng: coords.lng
      });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to geocode ${event.venue}:`, error);
      geocodedEvents.push(event);
    }
  }
  
  return geocodedEvents;
}

async function geocodeVenue(venueName) {
  const query = `${venueName}, Bangalore, India`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Bangalore-Events-App/1.0' }
  });
  
  const data = await response.json();
  
  if (data.length > 0) {
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon)
    };
  }
  
  throw new Error(`No coordinates found for ${venueName}`);
}