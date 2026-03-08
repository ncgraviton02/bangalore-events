export async function fetchWeekendEvents() {
  const events = [];
  const thisWeekend = getThisWeekendDates();
  
  // Fetch from all sources concurrently
  const [lumaEvents, meetupEvents, eventbriteEvents] = await Promise.allSettled([
    fetchLumaEvents(thisWeekend),
    fetchMeetupEvents(thisWeekend), 
    fetchEventbriteEvents(thisWeekend)
  ]);
  
  if (lumaEvents.status === 'fulfilled') events.push(...lumaEvents.value);
  if (meetupEvents.status === 'fulfilled') events.push(...meetupEvents.value);
  if (eventbriteEvents.status === 'fulfilled') events.push(...eventbriteEvents.value);
  
  // If no real events found, include sample data so the map isn't empty
  if (events.length === 0) {
    events.push(...getSampleEvents(thisWeekend));
  }
  
  return events;
}

function getThisWeekendDates() {
  const now = new Date();
  const day = now.getUTCDay();
  const saturday = new Date(now);
  const sunday = new Date(now);
  
  // Calculate days until Saturday (6) and Sunday (0)
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  saturday.setUTCDate(now.getUTCDate() + daysUntilSat);
  saturday.setUTCHours(0, 0, 0, 0);
  sunday.setUTCDate(saturday.getUTCDate() + 1);
  sunday.setUTCHours(23, 59, 59, 999);
  
  // If today IS Saturday or Sunday, include today
  if (day === 6) {
    saturday.setUTCDate(now.getUTCDate());
    saturday.setUTCHours(0, 0, 0, 0);
    sunday.setUTCDate(now.getUTCDate() + 1);
  } else if (day === 0) {
    saturday.setUTCDate(now.getUTCDate() - 1);
    saturday.setUTCHours(0, 0, 0, 0);
    sunday.setUTCDate(now.getUTCDate());
  }
  
  return { saturday, sunday };
}

async function fetchLumaEvents({ saturday, sunday }) {
  try {
    // Try Luma's discover page for Bangalore
    const response = await fetch('https://api.lu.ma/discover/get-events?geo_latitude=12.9716&geo_longitude=77.5946&geo_radius=50000', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BangaloreEvents/1.0)',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Fallback: try scraping the Bangalore page
      return await fetchLumaFallback(saturday, sunday);
    }
    
    const data = await response.json();
    const entries = data?.entries || data?.events || [];
    
    return entries
      .filter(entry => {
        const event = entry.event || entry;
        return isWeekendEvent(event.start_at, saturday, sunday);
      })
      .map(entry => {
        const event = entry.event || entry;
        return {
          title: event.name,
          dateTime: new Date(event.start_at).toISOString(),
          venue: event.geo_address_info?.full_address || event.location || 'Bangalore',
          lat: event.geo_latitude || null,
          lng: event.geo_longitude || null,
          category: categorizeEvent(event.name + ' ' + (event.description || '')),
          url: `https://lu.ma/${event.url || event.slug || ''}`,
          description: (event.description || '').substring(0, 200),
          source: 'Luma'
        };
      });
  } catch (error) {
    console.error('Luma fetch failed:', error);
    return [];
  }
}

async function fetchLumaFallback(saturday, sunday) {
  try {
    const resp = await fetch('https://lu.ma/bangalore', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BangaloreEvents/1.0)' }
    });
    const html = await resp.text();
    
    // Extract JSON data from the page
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (!match) return [];
    
    const nextData = JSON.parse(match[1]);
    const events = nextData?.props?.pageProps?.initialData?.events || 
                   nextData?.props?.pageProps?.events || [];
    
    return events
      .filter(e => isWeekendEvent(e.start_at, saturday, sunday))
      .map(e => ({
        title: e.name,
        dateTime: new Date(e.start_at).toISOString(),
        venue: e.geo_address_info?.full_address || e.location || 'Bangalore',
        lat: e.geo_latitude || null,
        lng: e.geo_longitude || null,
        category: categorizeEvent(e.name + ' ' + (e.description || '')),
        url: `https://lu.ma/${e.url || e.slug || ''}`,
        description: (e.description || '').substring(0, 200),
        source: 'Luma'
      }));
  } catch (e) {
    return [];
  }
}

async function fetchMeetupEvents({ saturday, sunday }) {
  try {
    // Use Meetup's public search endpoint
    const satStr = saturday.toISOString().split('T')[0];
    const sunStr = sunday.toISOString().split('T')[0];
    
    const response = await fetch(
      `https://www.meetup.com/gql2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; BangaloreEvents/1.0)'
        },
        body: JSON.stringify({
          operationName: 'categorySearch',
          variables: {
            first: 50,
            lat: 12.9716,
            lon: 77.5946,
            radius: 50,
            startDateRange: saturday.toISOString(),
            endDateRange: sunday.toISOString(),
            sortField: 'DATETIME'
          },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: 'f4801a5a7de2e0c6efe0e47afcc6c3ed50802b3e37f81f97eb41bc77ef4a3bc4'
            }
          }
        })
      }
    );
    
    if (!response.ok) {
      // Fallback: try the old API
      return await fetchMeetupFallback(saturday, sunday);
    }
    
    const data = await response.json();
    const edges = data?.data?.rankedEvents?.edges || [];
    
    return edges.map(({ node }) => ({
      title: node.title,
      dateTime: node.dateTime,
      venue: node.venue?.name || node.group?.city || 'Bangalore',
      lat: node.venue?.lat || null,
      lng: node.venue?.lng || null,
      category: categorizeEvent(node.title + ' ' + (node.description || '')),
      url: node.eventUrl,
      description: (node.description || '').replace(/<[^>]+>/g, '').substring(0, 200),
      source: 'Meetup'
    }));
  } catch (error) {
    console.error('Meetup fetch failed:', error);
    return [];
  }
}

async function fetchMeetupFallback(saturday, sunday) {
  try {
    const resp = await fetch(
      `https://www.meetup.com/find/?location=Bangalore&source=EVENTS&eventType=inPerson&sortField=DATETIME`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BangaloreEvents/1.0)' } }
    );
    // Can't easily parse without JS execution, return empty
    return [];
  } catch (e) {
    return [];
  }
}

async function fetchEventbriteEvents({ saturday, sunday }) {
  try {
    const satStr = saturday.toISOString().split('T')[0];
    const sunStr = sunday.toISOString().split('T')[0];
    
    // Eventbrite search page
    const url = `https://www.eventbrite.com/api/v3/destination/search/?event_search.dates.start_date=${satStr}&event_search.dates.end_date=${sunStr}&event_search.location.latitude=12.9716&event_search.location.longitude=77.5946&event_search.location.within=50km&page_size=50`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BangaloreEvents/1.0)',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const events = data?.events?.results || [];
    
    return events.map(event => ({
      title: event.name,
      dateTime: event.start_date || event.primary_datetime?.start_date || '',
      venue: event.primary_venue?.name || event.location || 'Bangalore',
      lat: event.primary_venue?.address?.latitude ? parseFloat(event.primary_venue.address.latitude) : null,
      lng: event.primary_venue?.address?.longitude ? parseFloat(event.primary_venue.address.longitude) : null,
      category: categorizeEvent(event.name + ' ' + (event.summary || '')),
      url: event.url,
      description: (event.summary || '').substring(0, 200),
      source: 'Eventbrite'
    }));
  } catch (error) {
    console.error('Eventbrite fetch failed:', error);
    return [];
  }
}

function getSampleEvents({ saturday, sunday }) {
  // Well-known Bangalore venues with real coordinates
  return [
    {
      title: "Weekend Tech Meetup",
      dateTime: saturday.toISOString(),
      venue: "91springboard, Koramangala",
      lat: 12.9352, lng: 77.6245,
      category: "Tech",
      url: "https://meetup.com/bangalore-tech",
      description: "Weekly tech community meetup — demos, talks, and networking",
      source: "Sample"
    },
    {
      title: "Cubbon Park Art Walk",
      dateTime: saturday.toISOString(),
      venue: "Cubbon Park",
      lat: 12.9763, lng: 77.5929,
      category: "Arts/Culture",
      url: "#",
      description: "Guided art walk through the green heart of Bangalore",
      source: "Sample"
    },
    {
      title: "Startup Brunch & Pitch",
      dateTime: sunday.toISOString(),
      venue: "Church Street Social",
      lat: 12.9740, lng: 77.6070,
      category: "Startup",
      url: "#",
      description: "Informal startup pitching over brunch — all founders welcome",
      source: "Sample"
    },
    {
      title: "Sunday Live Music Jam",
      dateTime: sunday.toISOString(),
      venue: "The Humming Tree, Indiranagar",
      lat: 12.9784, lng: 77.6408,
      category: "Music",
      url: "#",
      description: "Open mic and live music performances by local artists",
      source: "Sample"
    },
    {
      title: "Yoga in the Park",
      dateTime: saturday.toISOString(),
      venue: "Lalbagh Botanical Garden",
      lat: 12.9507, lng: 77.5848,
      category: "Sports/Fitness",
      url: "#",
      description: "Free community yoga session surrounded by nature",
      source: "Sample"
    },
    {
      title: "Craft Beer Tasting",
      dateTime: saturday.toISOString(),
      venue: "Toit Brewpub, Indiranagar",
      lat: 12.9810, lng: 77.6387,
      category: "Food/Drinks",
      url: "#",
      description: "Sample seasonal craft brews with expert commentary",
      source: "Sample"
    },
    {
      title: "AI/ML Workshop",
      dateTime: sunday.toISOString(),
      venue: "WeWork Galaxy, Residency Road",
      lat: 12.9716, lng: 77.6009,
      category: "Workshops",
      url: "#",
      description: "Hands-on workshop covering practical ML with Python",
      source: "Sample"
    },
    {
      title: "Founders Networking Mixer",
      dateTime: sunday.toISOString(),
      venue: "Bhive Workspace, HSR Layout",
      lat: 12.9116, lng: 77.6389,
      category: "Networking",
      url: "#",
      description: "Connect with Bangalore's startup ecosystem over drinks",
      source: "Sample"
    }
  ];
}

function categorizeEvent(text) {
  const lower = text.toLowerCase();
  
  if (lower.match(/\b(tech|coding|programming|developer|software|ai|machine learning|hackathon|devops|cloud|api|web3|blockchain)\b/)) return 'Tech';
  if (lower.match(/\b(startup|entrepreneur|business|pitch|founder|vc|investment|saas)\b/)) return 'Startup';
  if (lower.match(/\b(art|culture|gallery|exhibition|theater|theatre|dance|literature|poetry|heritage|museum)\b/)) return 'Arts/Culture';
  if (lower.match(/\b(music|concert|dj|band|singing|acoustic|jazz|rock|gig|live music)\b/)) return 'Music';
  if (lower.match(/\b(food|drinks|wine|beer|brewery|restaurant|culinary|cooking|brunch|tasting)\b/)) return 'Food/Drinks';
  if (lower.match(/\b(sports|fitness|yoga|running|cycling|gym|workout|marathon|trek|hike)\b/)) return 'Sports/Fitness';
  if (lower.match(/\b(workshop|training|learning|skill|course|tutorial|bootcamp|masterclass|hands-on)\b/)) return 'Workshops';
  if (lower.match(/\b(networking|meetup|community|professional|mixer|connect)\b/)) return 'Networking';
  
  return 'Other';
}

function isWeekendEvent(eventDate, saturday, sunday) {
  const date = new Date(eventDate);
  const satStart = new Date(saturday);
  satStart.setUTCHours(0, 0, 0, 0);
  const sunEnd = new Date(sunday);
  sunEnd.setUTCHours(23, 59, 59, 999);
  
  return date >= satStart && date <= sunEnd;
}
