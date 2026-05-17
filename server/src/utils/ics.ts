export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateIcs(event: {
  uid: string;
  title: string;
  description: string;
  location: string;
  start: Date;
  durationMinutes: number;
  organizerEmail: string;
  organizerName: string;
  attendeeEmail?: string;
  attendeeName?: string;
}): string {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60000);
  const now = new Date();
  const attendee = event.attendeeEmail
    ? `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${event.attendeeName ?? event.attendeeEmail}:MAILTO:${event.attendeeEmail}\r\n`
    : '';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RecruitCommand//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${event.uid}@recruitcommand.app`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(event.start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:Interview: ${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location}`,
    `ORGANIZER;CN=${event.organizerName}:MAILTO:${event.organizerEmail}`,
    attendee.trim(),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}
