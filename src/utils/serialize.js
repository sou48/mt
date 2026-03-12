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

module.exports = {
  serializeBigInt,
  toPublicUser,
};
