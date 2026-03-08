export async function fetchWeekendEvents() {
  const events = [];
  const thisWeekend = getThisWeekendDates();
  
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
  // Implementation for Luma API/scraping
  return [];
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