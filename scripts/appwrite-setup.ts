// One-off: creates the Appwrite database, collections, attributes, indexes and
// permissions this app expects. Safe to re-run — skips anything that already exists.
// Usage: node --env-file=.env.local ./node_modules/.bin/tsx scripts/appwrite-setup.ts
import { Client, Databases, Permission, Role, DatabasesIndexType } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DATABASE_ID = 'main';
const PUBLIC_PERMISSIONS = [
  Permission.read(Role.any()),
  Permission.create(Role.any()),
  Permission.update(Role.any()),
  Permission.delete(Role.any()),
];

async function ignoreExists<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 409) return null;
    throw err;
  }
}

async function ensureCollection(id: string, name: string) {
  await ignoreExists(() =>
    databases.createCollection(DATABASE_ID, id, name, PUBLIC_PERMISSIONS, false, true),
  );
}

async function main() {
  await ignoreExists(() => databases.create(DATABASE_ID, 'main'));
  console.log('Database ready.');

  // ─── wg_listings ─────────────────────────────────────────────────────────
  await ensureCollection('wg_listings', 'wg_listings');
  await ignoreExists(() => databases.createStringAttribute(DATABASE_ID, 'wg_listings', 'url', 2048, true));
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'wg_listings', 'listing_data', 100000, true),
  );
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'wg_listings', 'destination_journeys', 100000, true),
  );
  await ignoreExists(() =>
    databases.createBooleanAttribute(DATABASE_ID, 'wg_listings', 'is_favorite', true),
  );

  // ─── wg_destinations ─────────────────────────────────────────────────────
  await ensureCollection('wg_destinations', 'wg_destinations');
  await ignoreExists(() => databases.createStringAttribute(DATABASE_ID, 'wg_destinations', 'name', 255, true));
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'wg_destinations', 'address', 500, true),
  );
  await ignoreExists(() => databases.createFloatAttribute(DATABASE_ID, 'wg_destinations', 'lat', true));
  await ignoreExists(() => databases.createFloatAttribute(DATABASE_ID, 'wg_destinations', 'lng', true));

  // ─── commute_destinations ────────────────────────────────────────────────
  await ensureCollection('commute_destinations', 'commute_destinations');
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'commute_destinations', 'name', 255, true),
  );
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'commute_destinations', 'address', 500, true),
  );
  await ignoreExists(() => databases.createFloatAttribute(DATABASE_ID, 'commute_destinations', 'lat', true));
  await ignoreExists(() => databases.createFloatAttribute(DATABASE_ID, 'commute_destinations', 'lng', true));
  await ignoreExists(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'commute_destinations', 'weight', true, 1, 100),
  );
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'commute_destinations', 'schedule', 20000, true),
  );

  // ─── commute_travel_times ────────────────────────────────────────────────
  await ensureCollection('commute_travel_times', 'commute_travel_times');
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'commute_travel_times', 'cell_id', 64, true),
  );
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'commute_travel_times', 'destination_id', 64, true),
  );
  await ignoreExists(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'commute_travel_times', 'weekday', true, 1, 7),
  );
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'commute_travel_times', 'target_time', 8, true),
  );
  await ignoreExists(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'commute_travel_times', 'duration_minutes', false),
  );
  await ignoreExists(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'commute_travel_times', 'transfers', false),
  );
  await ignoreExists(() =>
    databases.createStringAttribute(DATABASE_ID, 'commute_travel_times', 'legs', 20000, false),
  );

  // ─── commute_jobs ────────────────────────────────────────────────────────
  await ensureCollection('commute_jobs', 'commute_jobs');
  await ignoreExists(() =>
    databases.createEnumAttribute(
      DATABASE_ID,
      'commute_jobs',
      'status',
      ['pending', 'running', 'done', 'error'],
      true,
    ),
  );
  await ignoreExists(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'commute_jobs', 'total_cells', true),
  );
  await ignoreExists(() =>
    databases.createIntegerAttribute(DATABASE_ID, 'commute_jobs', 'completed_cells', true),
  );
  await ignoreExists(() => databases.createStringAttribute(DATABASE_ID, 'commute_jobs', 'error', 2000, false));

  console.log('Attributes created — waiting for them to become available before creating indexes…');
  await new Promise((r) => setTimeout(r, 5000));

  // ─── indexes ─────────────────────────────────────────────────────────────
  await ignoreExists(() =>
    databases.createIndex(DATABASE_ID, 'wg_listings', 'url_idx', DatabasesIndexType.Key, ['url'], undefined, [
      255,
    ]),
  );
  await ignoreExists(() =>
    databases.createIndex(
      DATABASE_ID,
      'commute_travel_times',
      'destination_id_idx',
      DatabasesIndexType.Key,
      ['destination_id'],
    ),
  );

  console.log('Appwrite schema setup complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
