import PocketBase from "pocketbase";
import { config, isBackendConfigured } from "./config";

// Единый экземпляр клиента PocketBase. null — если URL ещё не задан
// (тогда работает демо-режим, см. auth.ts).
export const pb: PocketBase | null = isBackendConfigured
  ? new PocketBase(config.pocketbaseUrl)
  : null;
