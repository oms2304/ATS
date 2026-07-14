// Minimal structured logger. Emits single-line JSON so logs are greppable and
// parseable in Render's log viewer, with no external dependency.

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, context: Record<string, unknown> = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};

export default logger;
