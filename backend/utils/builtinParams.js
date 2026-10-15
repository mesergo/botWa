// Built-in flow variables computed at replacement time (not stored in the session),
// usable in any --var-- placeholder unless the session defines a parameter with the
// same name. --today-- is the current date in Israel as DD/MM/YYYY, matching the
// format of the input_date node and of date columns in client Google Sheets.
const formatIsraelDate = (date) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('day')}/${get('month')}/${get('year')}`;
};

export const getBuiltinParam = (name) => {
  if (name === 'today') return formatIsraelDate(new Date());
  return undefined;
};


