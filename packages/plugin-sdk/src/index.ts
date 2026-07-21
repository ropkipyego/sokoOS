import type { PermissionKey } from "@sokoos/types";

export type PluginApiVersion = 1;

export type PermissionDef = {
  key: PermissionKey;
  description: string;
  category: string;
};

export type PluginCapabilities = {
  apiRoutes?: boolean;
  adminMenus?: boolean;
  posExtensions?: boolean;
  migrations?: boolean;
  reports?: boolean;
  jobs?: boolean;
  settings?: boolean;
  syncEntities?: boolean;
};

export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  apiVersion: PluginApiVersion;
  description?: string;
  permissions: PermissionDef[];
  /** Zod schema or JSON Schema object — validated by host at load time. */
  settingsSchema?: unknown;
  capabilities: PluginCapabilities;
  dependsOn?: string[];
};

/** Stub route contribution for Nest / web routers. */
export type PluginRouteDef = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  permission?: PermissionKey;
  summary?: string;
};

export type PluginMenuItem = {
  id: string;
  label: string;
  path: string;
  parentId?: string;
  icon?: string;
  permission?: PermissionKey;
  surface: "admin" | "pos";
};

export type PluginReportDef = {
  id: string;
  name: string;
  description?: string;
  permission?: PermissionKey;
};

export type PluginJobDef = {
  id: string;
  name: string;
  /** Cron expression or interval descriptor. */
  schedule: string;
  permission?: PermissionKey;
};

export type PluginSettingDef = {
  key: string;
  label: string;
  description?: string;
  scope: "tenant" | "branch" | "device";
};

export type PluginSyncEntityDef = {
  entityType: string;
  /** Strategy hint for sync engine. */
  strategy: "upsert" | "append";
  schema?: unknown;
};

export type PluginRegistrationContext = {
  tenantId?: string;
  pluginId: string;
};

export interface PluginModule {
  manifest: PluginManifest;
  registerPermissions?(ctx: PluginRegistrationContext): PermissionDef[] | Promise<PermissionDef[]>;
  registerRoutes?(ctx: PluginRegistrationContext): PluginRouteDef[] | Promise<PluginRouteDef[]>;
  registerMenus?(ctx: PluginRegistrationContext): PluginMenuItem[] | Promise<PluginMenuItem[]>;
  registerReports?(ctx: PluginRegistrationContext): PluginReportDef[] | Promise<PluginReportDef[]>;
  registerJobs?(ctx: PluginRegistrationContext): PluginJobDef[] | Promise<PluginJobDef[]>;
  registerSettings?(ctx: PluginRegistrationContext): PluginSettingDef[] | Promise<PluginSettingDef[]>;
  registerSyncEntities?(
    ctx: PluginRegistrationContext,
  ): PluginSyncEntityDef[] | Promise<PluginSyncEntityDef[]>;
}

export const SUPPORTED_PLUGIN_API_VERSION: PluginApiVersion = 1;

export function assertCompatibleApiVersion(version: number): void {
  if (version !== SUPPORTED_PLUGIN_API_VERSION) {
    throw new Error(
      `Unsupported plugin apiVersion ${version}; host supports ${SUPPORTED_PLUGIN_API_VERSION}`,
    );
  }
}

export function validateManifest(manifest: PluginManifest): PluginManifest {
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error("PluginManifest requires id, name, and version");
  }
  assertCompatibleApiVersion(manifest.apiVersion);
  return manifest;
}
