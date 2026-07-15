export function formatObjectId(id) {
  return `MongoDB\\BSON\\ObjectID("${id.toString()}")`;
}

export function formatSmsDocument(doc) {
  return {
    id_: formatObjectId(doc._id),
    dest: doc.dest || doc.Destination || '',
    phone: doc.phone || doc.Sender || '',
    date:
      doc.date ||
      doc.Date ||
      new Date(doc._id.getTimestamp()).toLocaleString('he-IL'),
    message: doc.message || doc.MessageText || doc.Message || '',
  };
}

export function formatInsertedId(insertedId) {
  return formatObjectId(insertedId);
}

export function formatDemoMessage(doc, index) {
  const hex = `demo${String(index).padStart(20, '0')}`;
  return {
    id_: formatObjectId(hex),
    dest: doc.dest || '',
    phone: doc.phone || '',
    date: doc.date || '',
    message: doc.message || '',
  };
}
