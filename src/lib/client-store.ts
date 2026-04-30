/**
 * Server-side client storage — reads/writes a JSON file.
 * This persists client configs across dev server restarts.
 *
 * Falls back to mock-data clients when the JSON file doesn't exist or is empty.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Client } from "@/lib/types";
import { clients as mockClients } from "@/lib/mock-data";

const DATA_DIR = path.join(process.cwd(), "data");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

/**
 * Read all clients. Returns saved clients if file exists, otherwise mock clients.
 */
export async function getAllClients(): Promise<Client[]> {
  try {
    const raw = await fs.readFile(CLIENTS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Client[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // file doesn't exist yet — fall through
  }
  return mockClients;
}

/**
 * Get a single client by slug.
 */
export async function getClientBySlug(slug: string): Promise<Client | undefined> {
  const all = await getAllClients();
  return all.find((c) => c.slug === slug);
}

/**
 * Look up a client by either the slug or the optional loginUsername
 * (e.g. an email address for the client contact). Case-insensitive on
 * both. Used by the auth route so a client can log in with a friendly
 * email instead of the technical slug.
 */
export async function getClientByLogin(login: string): Promise<Client | undefined> {
  if (!login) return undefined;
  const needle = login.toLowerCase().trim();
  const all = await getAllClients();
  return all.find((c) =>
    c.slug.toLowerCase() === needle ||
    (c.loginUsername && c.loginUsername.toLowerCase() === needle),
  );
}

/**
 * Save the full client list to disk.
 */
export async function saveAllClients(clientList: Client[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(CLIENTS_FILE, JSON.stringify(clientList, null, 2), "utf-8");
}

/**
 * Add or update a single client (matched by slug).
 */
export async function upsertClient(client: Client): Promise<Client[]> {
  const all = await getAllClients();
  const idx = all.findIndex((c) => c.slug === client.slug);
  if (idx >= 0) {
    all[idx] = client;
  } else {
    all.push(client);
  }
  await saveAllClients(all);
  return all;
}

/**
 * Delete a client by slug.
 */
export async function deleteClient(slug: string): Promise<Client[]> {
  const all = await getAllClients();
  const filtered = all.filter((c) => c.slug !== slug);
  await saveAllClients(filtered);
  return filtered;
}

/**
 * Seed the JSON file from mock data (only if file doesn't exist yet).
 */
export async function seedIfEmpty(): Promise<void> {
  try {
    await fs.access(CLIENTS_FILE);
  } catch {
    await saveAllClients(mockClients);
  }
}
