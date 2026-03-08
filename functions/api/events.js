import { fetchWeekendEvents } from '../../src/utils/eventSources.js';
import { geocodeEvents } from '../../src/utils/geocoding.js';

export async function onRequest(context) {
  const { EVENTS_CACHE } = context.env;
  
  // Check cache first
  const cacheKey = 'weekend-events';
  const cached = await EVENTS_CACHE.get(cacheKey);
  
  if (cached) {
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
      return new Response(JSON.stringify(data.events), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  try {
    const events = await fetchWeekendEvents();
    const eventsWithGeo = await geocodeEvents(events);
    
    const cacheData = {
      events: eventsWithGeo,
      timestamp: Date.now()
    };
    
    await EVENTS_CACHE.put(cacheKey, JSON.stringify(cacheData));
    
    return new Response(JSON.stringify(eventsWithGeo), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch events' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}