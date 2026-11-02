export const sql = `
  ALTER TABLE todoist_projekte ADD COLUMN aktiv INTEGER NOT NULL DEFAULT 0;
  UPDATE todoist_projekte SET aktiv = 1;
`;
