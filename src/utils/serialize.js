function serializeBigInt(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
    )
  );
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  return serializeBigInt({
    id: user.id,
    companyId: user.companyId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
        }
      : null,
  });
}

function toPublicCompany(company) {
  if (!company) {
    return null;
  }

  return serializeBigInt({
    id: company.id,
    name: company.name,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  });
}

function toPublicProject(project) {
  if (!project) {
    return null;
  }

  return serializeBigInt({
    id: project.id,
    companyId: project.companyId,
    name: project.name,
    isUnclassified: project.isUnclassified,
    createdByUserId: project.createdByUserId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    company: project.company
      ? {
          id: project.company.id,
          name: project.company.name,
        }
      : null,
    assignedUsers: Array.isArray(project.userProjects)
      ? project.userProjects
          .filter((userProject) => userProject.user && !userProject.deletedAt)
          .map((userProject) => toPublicUser(userProject.user))
      : undefined,
  });
}

function toPublicMessage(message) {
  if (!message) {
    return null;
  }

  const usage =
    message.usageJson && typeof message.usageJson === 'object'
      ? {
          inputTokens: Number(message.usageJson.inputTokens || 0),
          outputTokens: Number(message.usageJson.outputTokens || 0),
          totalTokens: Number(message.usageJson.totalTokens || 0),
        }
      : null;

  return serializeBigInt({
    id: message.id,
    projectId: message.projectId,
    messageType: message.messageType,
    channelType: message.channelType,
    subject: message.subject,
    sourceSenderName: message.sourceSenderName,
    sourceSenderAddressOrAccount: message.sourceSenderAddressOrAccount,
    sourceSentAt: message.sourceSentAt,
    registeredByUserId: message.registeredByUserId,
    createdByUserId: message.createdByUserId,
    sourceText: message.sourceText,
    sourceLanguage: message.sourceLanguage,
    translatedText: message.translatedText,
    translatedLanguage: message.translatedLanguage,
    japaneseText: message.japaneseText,
    partnerText: message.partnerText,
    languagePair: message.languagePair,
    usage,
    signatureId: message.signatureId,
    signatureSnapshot: message.signatureSnapshot,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  });
}

function toPublicAttachment(attachment) {
  if (!attachment) {
    return null;
  }

  return serializeBigInt({
    id: attachment.id,
    messageId: attachment.messageId,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    fileSize: attachment.fileSize,
    uploadedByUserId: attachment.uploadedByUserId,
    createdAt: attachment.createdAt,
    updatedAt: attachment.updatedAt,
  });
}

function toPublicSignature(signature) {
  if (!signature) {
    return null;
  }

  return serializeBigInt({
    id: signature.id,
    userId: signature.userId,
    name: signature.name,
    japaneseText: signature.japaneseText,
    partnerText: signature.partnerText,
    isDefault: signature.isDefault,
    createdAt: signature.createdAt,
    updatedAt: signature.updatedAt,
  });
}

function toPublicDictionaryEntry(entry) {
  if (!entry) {
    return null;
  }

  return serializeBigInt({
    id: entry.id,
    scopeType: entry.scopeType,
    companyId: entry.companyId,
    sourceTerm: entry.sourceTerm,
    targetTerm: entry.targetTerm,
    note: entry.note,
    languagePair: entry.languagePair,
    createdByUserId: entry.createdByUserId,
    updatedByUserId: entry.updatedByUserId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

function toPublicHistory(history) {
  if (!history) {
    return null;
  }

  return serializeBigInt({
    id: history.id,
    snapshotJson: history.snapshotJson,
    changedByUserId: history.changedByUserId,
    createdAt: history.createdAt,
    changedByUser: history.changedByUser
      ? {
          id: history.changedByUser.id,
          email: history.changedByUser.email,
          displayName: history.changedByUser.displayName,
        }
      : null,
  });
}

module.exports = {
  serializeBigInt,
  toPublicAttachment,
  toPublicCompany,
  toPublicDictionaryEntry,
  toPublicHistory,
  toPublicMessage,
  toPublicProject,
  toPublicSignature,
  toPublicUser,
};
