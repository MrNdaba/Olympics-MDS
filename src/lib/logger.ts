// Structured, secret-free logging (spec §19). Never pass passwords, OTP codes,
// or session tokens into these helpers.

type Fields = Record<string, unknown>;

function emit(level: string, event: string, fields: Fields) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), level, evt: event, ...fields }),
  );
}

export const log = {
  info: (event: string, fields: Fields = {}) => emit("info", event, fields),
  warn: (event: string, fields: Fields = {}) => emit("warn", event, fields),
  error: (event: string, fields: Fields = {}) => emit("error", event, fields),
};
