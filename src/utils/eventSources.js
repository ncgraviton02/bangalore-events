export async function fetchWeekendEvents() {
  const events = [];
  const thisWeekend = getThisWeekendDates();
  
  // Add some sample events for testing
  const sampleEvents = [
    {
      title: "Bangalore Tech Meetup",
      dateTime: thisWeekend.saturday.toLocaleString(),
      venue: "Koramangala Social",
      category: "Tech",
      url: "https://example.com",
      description: "Connect with tech enthusiasts and developers",
      source: "Sample"
    },
    {
      title: "Weekend Music Festival",
      dateTime: thisWeekend.sunday.toLocaleString(),
      venue: "Cubbon Park",
      category: "Music", 
      url: "https://example.com",
      description: "Live music performances by local artists",
      source: "Sample"
    },
    {
      title: "Startup Networking Event",
      dateTime: thisWeekend.saturday.toLocaleString(),
      venue: "91springboard Koramangala",
      category: "Startup",
      url: "https://example.com", 
      description: "Meet fellow entrepreneurs and investors",
      source: "Sample"
    }
  ];
  
  events.push(...sampleEvents);
  
  // Fetch from all sources
  const [lumaEvents, meetupEvents, eventbriteEvents] = await Promise.allSettled([
    fetchLumaEvents(thisWeekend),
    fetchMeetupEvents(thisWeekend), 
    fetchEventbriteEvents(thisWeekend)
  ]);
  
  if (lumaEvents.status === 'fulfilled') events.push(...lumaEvents.value);
  if (meetupEvents.status === 'fulfilled') events.push(...meetupEvents.value);
  if (eventbriteEvents.status === 'fulfilled') events.push(...eventbriteEvents.value);
  
  return events;
}

function getThisWeekendDates() {
  const now = new Date();
  const saturday = new Date(now);
  const sunday = new Date(now);
  
  // Find this Saturday
  saturday.setDate(now.getDate() + (6 - now.getDay()));
  sunday.setDate(saturday.getDate() + 1);
  
  return { saturday, sunday };
}

async function fetchLumaEvents({ saturday, sunday }) {
  try {
    const response = await fetch('https://lu.ma/api/public/events?location=bangalore', {
      headers: { 'User-Agent': 'Bangalore-Events-App/1.0' }
    });
    
    const data = await response.json();
    
    return data.events
      .filter(event => isWeekendEvent(event.start_at, saturday, sunday))
      .map(event => ({
        title: event.name,
        dateTime: new Date(event.start_at).toLocaleString(),
        venue: event.location?.name || 'TBD',
        category: categorizeEvent(event.name + ' ' + event.description),
        url: `https://lu.ma/${event.url}`,
        description: event.description?.substring(0, 150) + '...' || '',
        source: 'Luma'
      }));
  } catch (error) {
    console.error('Luma fetch failed:', error);
    return [];
  }
}

async function fetchMeetupEvents({ saturday, sunday }) {
  // Implementation for Meetup API
  return [];
}

async function fetchEventbriteEvents({ saturday, sunday }) {
  // Implementation for Eventbrite API
  return [];
}

function categorizeEvent(text) {
  const lower = text.toLowerCase();
  
  if (lower.match(/tech|coding|programming|developer|software|ai|machine learning/)) return 'Tech';
  if (lower.match(/startup|entrepreneur|business|networking|pitch/)) return 'Startup'; 
  if (lower.match(/art|culture|gallery|exhibition|theater|dance|literature/)) return 'Arts/Culture';
  if (lower.match(/music|concert|dj|band|singing|acoustic/)) return 'Music';
  if (lower.match(/food|drinks|wine|beer|restaurant|culinary|cooking/)) return 'Food/Drinks';
  if (lower.match(/sports|fitness|yoga|running|cycling|gym|workout/)) return 'Sports/Fitness';
  if (lower.match(/workshop|training|learning|skill|course|tutorial/)) return 'Workshops';
  if (lower.match(/networking|meetup|community|professional/)) return 'Networking';
  
  return 'Other';
}

function isWeekendEvent(eventDate, saturday, sunday) {
  const date = new Date(eventDate);
  const eventDateStr = date.toDateString();
  return eventDateStr === saturday.toDateString() || eventDateStr === sunday.toDateString();
}