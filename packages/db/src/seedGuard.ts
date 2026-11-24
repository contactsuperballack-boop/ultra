/** Prevent demo fixtures from being inserted into a production database. */
export function assertSeedAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === "production") {
    throw new Error(
      "Refusing to run demo seed data in production. Use a reviewed production bootstrap procedure instead.",
    );
  }
}
