const SCHEMA_OUT_OF_DATE =
  "Database schema is out of date. Run scripts/sync-production-db.sh on the server, then restart the API.";

function errorText(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause instanceof Error ? err.cause.message : "";
  return `${err.message}\n${cause}`;
}

export function isGraphicsSchemaError(err: unknown): boolean {
  const message = errorText(err).toLowerCase();
  return message.includes("created_by_user_id")
    || (message.includes("graphics_projects") && message.includes("workspace_id"));
}

export function formatGraphicsProjectError(err: unknown): string {
  if (isGraphicsSchemaError(err)) return SCHEMA_OUT_OF_DATE;

  const message = err instanceof Error ? err.message : String(err);
  if (/Failed query:/i.test(message)) {
    return "Could not save the graphics project. If this persists, run the production database schema upgrade.";
  }
  if (message.length > 220) {
    return "Could not save the graphics project.";
  }
  return message;
}
