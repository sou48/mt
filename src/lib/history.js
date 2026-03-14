function buildSnapshotJson(record, fields) {
  const snapshot = {};

  for (const field of fields) {
    snapshot[field] = record[field];
  }

  return JSON.parse(
    JSON.stringify(snapshot, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );
}

async function createMessageHistory(prisma, message, changedByUserId) {
  return prisma.messageHistory.create({
    data: {
      messageId: message.id,
      snapshotJson: buildSnapshotJson(message, [
        'projectId',
        'messageType',
        'channelType',
        'subject',
        'sourceSenderName',
        'sourceSenderAddressOrAccount',
        'sourceSentAt',
        'registeredByUserId',
        'createdByUserId',
        'sourceText',
        'sourceLanguage',
        'translatedText',
        'translatedLanguage',
        'japaneseText',
        'partnerText',
        'languagePair',
        'signatureId',
        'signatureSnapshot',
        'createdAt',
        'updatedAt',
        'deletedAt',
      ]),
      changedByUserId,
    },
  });
}

async function createSignatureHistory(prisma, signature, changedByUserId) {
  return prisma.signatureHistory.create({
    data: {
      signatureId: signature.id,
      snapshotJson: buildSnapshotJson(signature, [
        'userId',
        'name',
        'japaneseText',
        'partnerText',
        'isDefault',
        'createdAt',
        'updatedAt',
        'deletedAt',
      ]),
      changedByUserId,
    },
  });
}

async function createDictionaryEntryHistory(prisma, entry, changedByUserId) {
  return prisma.dictionaryEntryHistory.create({
    data: {
      dictionaryEntryId: entry.id,
      snapshotJson: buildSnapshotJson(entry, [
        'scopeType',
        'companyId',
        'sourceTerm',
        'targetTerm',
        'note',
        'languagePair',
        'createdByUserId',
        'updatedByUserId',
        'createdAt',
        'updatedAt',
        'deletedAt',
      ]),
      changedByUserId,
    },
  });
}

module.exports = {
  createDictionaryEntryHistory,
  createMessageHistory,
  createSignatureHistory,
};
