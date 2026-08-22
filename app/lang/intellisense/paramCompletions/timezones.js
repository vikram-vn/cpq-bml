const { buildStringParamItems } = require('./utils');

const TIMEZONES = [
    // GMT offsets
    { name: 'GMT+4', detail: 'Gulf Standard Time / GMT+04:00', doc: 'GMT+4 timezone offset.' },
    { name: 'GMT+0', detail: 'Greenwich Mean Time / GMT+00:00', doc: 'GMT+0 timezone offset.' },
    { name: 'GMT+1', detail: 'Central European Time / GMT+01:00', doc: 'GMT+1 timezone offset.' },
    { name: 'GMT+2', detail: 'Eastern European Time / GMT+02:00', doc: 'GMT+2 timezone offset.' },
    { name: 'GMT+3', detail: 'Arabia Standard Time / GMT+03:00', doc: 'GMT+3 timezone offset.' },
    { name: 'GMT+5', detail: 'Pakistan Standard Time / GMT+05:00', doc: 'GMT+5 timezone offset.' },
    { name: 'GMT+5:30', detail: 'India Standard Time / GMT+05:30', doc: 'GMT+5:30 timezone offset.' },
    { name: 'GMT+6', detail: 'Bangladesh Standard Time / GMT+06:00', doc: 'GMT+6 timezone offset.' },
    { name: 'GMT+7', detail: 'Indochina Time / GMT+07:00', doc: 'GMT+7 timezone offset.' },
    { name: 'GMT+8', detail: 'China Standard Time / GMT+08:00', doc: 'GMT+8 timezone offset.' },
    { name: 'GMT+9', detail: 'Japan Standard Time / GMT+09:00', doc: 'GMT+9 timezone offset.' },
    { name: 'GMT+9:30', detail: 'Australian Central Standard Time / GMT+09:30', doc: 'GMT+9:30 timezone offset.' },
    { name: 'GMT+10', detail: 'Australian Eastern Standard Time / GMT+10:00', doc: 'GMT+10 timezone offset.' },
    { name: 'GMT+11', detail: 'Solomon Islands Time / GMT+11:00', doc: 'GMT+11 timezone offset.' },
    { name: 'GMT+12', detail: 'New Zealand Standard Time / GMT+12:00', doc: 'GMT+12 timezone offset.' },
    { name: 'GMT+13', detail: 'Tonga Time / GMT+13:00', doc: 'GMT+13 timezone offset.' },
    { name: 'GMT+14', detail: 'Line Islands Time / GMT+14:00', doc: 'GMT+14 timezone offset.' },

    { name: 'GMT-1', detail: 'Cape Verde Time / GMT-01:00', doc: 'GMT-1 timezone offset.' },
    { name: 'GMT-2', detail: 'South Georgia Time / GMT-02:00', doc: 'GMT-2 timezone offset.' },
    { name: 'GMT-3', detail: 'Brasilia Time / GMT-03:00', doc: 'GMT-3 timezone offset.' },
    { name: 'GMT-3:30', detail: 'Newfoundland Time / GMT-03:30', doc: 'GMT-3:30 timezone offset.' },
    { name: 'GMT-4', detail: 'Atlantic Standard Time / GMT-04:00', doc: 'GMT-4 timezone offset.' },
    { name: 'GMT-5', detail: 'Eastern Standard Time / GMT-05:00', doc: 'GMT-5 timezone offset.' },
    { name: 'GMT-6', detail: 'Central Standard Time / GMT-06:00', doc: 'GMT-6 timezone offset.' },
    { name: 'GMT-7', detail: 'Mountain Standard Time / GMT-07:00', doc: 'GMT-7 timezone offset.' },
    { name: 'GMT-8', detail: 'Pacific Standard Time / GMT-08:00', doc: 'GMT-8 timezone offset.' },
    { name: 'GMT-9', detail: 'Alaska Standard Time / GMT-09:00', doc: 'GMT-9 timezone offset.' },
    { name: 'GMT-10', detail: 'Hawaii-Aleutian Standard Time / GMT-10:00', doc: 'GMT-10 timezone offset.' },
    { name: 'GMT-11', detail: 'Samoa Standard Time / GMT-11:00', doc: 'GMT-11 timezone offset.' },
    { name: 'GMT-12', detail: 'Baker Island Time / GMT-12:00', doc: 'GMT-12 timezone offset.' },

    { name: 'GMT', detail: 'Greenwich Mean Time', doc: 'Greenwich Mean Time (GMT).' },
    { name: 'UTC', detail: 'Coordinated Universal Time', doc: 'Coordinated Universal Time (UTC).' },

    // IANA Timezones
    { name: 'America/New_York', detail: 'US Eastern Time', doc: 'America/New_York (US Eastern Time).' },
    { name: 'America/Chicago', detail: 'US Central Time', doc: 'America/Chicago (US Central Time).' },
    { name: 'America/Denver', detail: 'US Mountain Time', doc: 'America/Denver (US Mountain Time).' },
    { name: 'America/Los_Angeles', detail: 'US Pacific Time', doc: 'America/Los_Angeles (US Pacific Time).' },
    { name: 'America/Phoenix', detail: 'US Mountain Standard (Arizona - no DST)', doc: 'America/Phoenix (Arizona Time).' },
    { name: 'America/Anchorage', detail: 'Alaska Time', doc: 'America/Anchorage (Alaska Time).' },
    { name: 'America/Halifax', detail: 'Canada Atlantic Time', doc: 'America/Halifax (Atlantic Time).' },
    { name: 'America/Toronto', detail: 'Canada Eastern Time', doc: 'America/Toronto (Canada Eastern Time).' },
    { name: 'America/Vancouver', detail: 'Canada Pacific Time', doc: 'America/Vancouver (Canada Pacific Time).' },
    { name: 'America/Mexico_City', detail: 'Mexico Central Time', doc: 'America/Mexico_City (Mexico Time).' },
    { name: 'America/Sao_Paulo', detail: 'Brazil Time', doc: 'America/Sao_Paulo (Brazil Time).' },
    { name: 'America/Buenos_Aires', detail: 'Argentina Time', doc: 'America/Buenos_Aires (Argentina Time).' },
    { name: 'America/Bogota', detail: 'Colombia Time', doc: 'America/Bogota (Colombia Time).' },
    { name: 'America/Lima', detail: 'Peru Time', doc: 'America/Lima (Peru Time).' },

    { name: 'Europe/London', detail: 'UK Time (GMT/BST)', doc: 'Europe/London (UK Time).' },
    { name: 'Europe/Paris', detail: 'Central European Time (France)', doc: 'Europe/Paris (France Time).' },
    { name: 'Europe/Berlin', detail: 'Central European Time (Germany)', doc: 'Europe/Berlin (Germany Time).' },
    { name: 'Europe/Rome', detail: 'Central European Time (Italy)', doc: 'Europe/Rome (Italy Time).' },
    { name: 'Europe/Madrid', detail: 'Central European Time (Spain)', doc: 'Europe/Madrid (Spain Time).' },
    { name: 'Europe/Amsterdam', detail: 'Central European Time (Netherlands)', doc: 'Europe/Amsterdam (Netherlands Time).' },
    { name: 'Europe/Brussels', detail: 'Central European Time (Belgium)', doc: 'Europe/Brussels (Belgium Time).' },
    { name: 'Europe/Vienna', detail: 'Central European Time (Austria)', doc: 'Europe/Vienna (Austria Time).' },
    { name: 'Europe/Zurich', detail: 'Central European Time (Switzerland)', doc: 'Europe/Zurich (Switzerland Time).' },
    { name: 'Europe/Dublin', detail: 'Irish Standard Time', doc: 'Europe/Dublin (Ireland Time).' },
    { name: 'Europe/Moscow', detail: 'Moscow Time', doc: 'Europe/Moscow (Moscow Time).' },
    { name: 'Europe/Istanbul', detail: 'Turkey Time', doc: 'Europe/Istanbul (Turkey Time).' },
    { name: 'Europe/Athens', detail: 'Eastern European Time (Greece)', doc: 'Europe/Athens (Greece Time).' },

    { name: 'Asia/Dubai', detail: 'Gulf Standard Time (UAE)', doc: 'Asia/Dubai (UAE Time).' },
    { name: 'Asia/Riyadh', detail: 'Arabian Standard Time (Saudi Arabia)', doc: 'Asia/Riyadh (Saudi Arabia Time).' },
    { name: 'Asia/Calcutta', detail: 'India Standard Time (IST - Oracle CPQ ID)', doc: 'Asia/Calcutta (India Standard Time).' },
    { name: 'Asia/Kolkata', detail: 'India Standard Time (Alias)', doc: 'Asia/Kolkata (Note: Oracle CPQ official ID is Asia/Calcutta).' },
    { name: 'Asia/Singapore', detail: 'Singapore Standard Time (SGT)', doc: 'Asia/Singapore (Singapore Time).' },
    { name: 'Asia/Tokyo', detail: 'Japan Standard Time (JST)', doc: 'Asia/Tokyo (Japan Time).' },
    { name: 'Asia/Shanghai', detail: 'China Standard Time (CST)', doc: 'Asia/Shanghai (China Time).' },
    { name: 'Asia/Hong_Kong', detail: 'Hong Kong Time (HKT)', doc: 'Asia/Hong_Kong (Hong Kong Time).' },
    { name: 'Asia/Bangkok', detail: 'Indochina Time (Thailand)', doc: 'Asia/Bangkok (Thailand Time).' },
    { name: 'Asia/Seoul', detail: 'Korea Standard Time (KST)', doc: 'Asia/Seoul (Korea Time).' },
    { name: 'Asia/Jakarta', detail: 'Western Indonesia Time (WIB)', doc: 'Asia/Jakarta (Indonesia Time).' },
    { name: 'Asia/Manila', detail: 'Philippine Time (PHT)', doc: 'Asia/Manila (Philippines Time).' },
    { name: 'Asia/Karachi', detail: 'Pakistan Time (PKT)', doc: 'Asia/Karachi (Pakistan Time).' },
    { name: 'Asia/Dhaka', detail: 'Bangladesh Time (BST)', doc: 'Asia/Dhaka (Bangladesh Time).' },

    { name: 'Australia/Sydney', detail: 'Australian Eastern Time (Sydney)', doc: 'Australia/Sydney (Sydney Time).' },
    { name: 'Australia/Melbourne', detail: 'Australian Eastern Time (Melbourne)', doc: 'Australia/Melbourne (Melbourne Time).' },
    { name: 'Australia/Brisbane', detail: 'Australian Eastern Standard Time (Brisbane)', doc: 'Australia/Brisbane (Brisbane Time).' },
    { name: 'Australia/Adelaide', detail: 'Australian Central Time (Adelaide)', doc: 'Australia/Adelaide (Adelaide Time).' },
    { name: 'Australia/Perth', detail: 'Australian Western Time (Perth)', doc: 'Australia/Perth (Perth Time).' },
    { name: 'Pacific/Auckland', detail: 'New Zealand Time (Auckland)', doc: 'Pacific/Auckland (New Zealand Time).' },
    { name: 'Pacific/Honolulu', detail: 'Hawaii Standard Time', doc: 'Pacific/Honolulu (Hawaii Time).' },

    { name: 'Africa/Algiers', detail: 'Central European Time / West Africa Time (GMT+1)', doc: 'Africa/Algiers (Oracle CPQ supported GMT+1 ID).' },
    { name: 'Africa/Cairo', detail: 'Egypt Time', doc: 'Africa/Cairo (Egypt Time).' },
    { name: 'Africa/Casablanca', detail: 'Morocco Time', doc: 'Africa/Casablanca (Morocco Time).' },
    { name: 'Africa/Johannesburg', detail: 'South Africa Time', doc: 'Africa/Johannesburg (South Africa Time).' },
    { name: 'Africa/Nairobi', detail: 'Kenya Time', doc: 'Africa/Nairobi (Kenya Time).' },

    { name: 'EST', detail: 'Eastern Standard Time', doc: 'EST timezone abbreviation.' },
    { name: 'CST', detail: 'Central Standard Time', doc: 'CST timezone abbreviation.' },
    { name: 'MST', detail: 'Mountain Standard Time', doc: 'MST timezone abbreviation.' },
    { name: 'PST', detail: 'Pacific Standard Time', doc: 'PST timezone abbreviation.' },
    { name: 'EDT', detail: 'Eastern Daylight Time', doc: 'EDT timezone abbreviation.' },
    { name: 'CDT', detail: 'Central Daylight Time', doc: 'CDT timezone abbreviation.' },
    { name: 'MDT', detail: 'Mountain Daylight Time', doc: 'MDT timezone abbreviation.' },
    { name: 'PDT', detail: 'Pacific Daylight Time', doc: 'PDT timezone abbreviation.' }
];

function getTimezoneCompletions(document, position) {
    return buildStringParamItems(TIMEZONES, document, position);
}

module.exports = {
    TIMEZONES,
    getTimezoneCompletions
};
