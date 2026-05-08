/**
 * Public SDK API Routes
 * 
 * These endpoints allow Android developers to integrate ApkZio SDK
 * into their apps for push notifications and analytics.
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

const router = Router();

// In-memory storage (replace with database in production)
interface App {
  app_id: string;
  package_name: string;
  app_name: string;
  version_code: number;
  version_name: string;
  developer_email: string;
  developer_name: string;
  api_key: string;
  created_at: string;
}

interface Device {
  device_id: string;
  subscriber_id: string;
  app_id: string;
  fcm_token: string;
  platform: string;
  os_version: string;
  app_version: string;
  model: string;
  manufacturer: string;
  locale: string;
  timezone: string;
  subscribed: boolean;
  subscribed_at: string | null;
  last_seen: string;
  created_at: string;
}

interface Notification {
  notification_id: string;
  app_id: string;
  title: string;
  body: string;
  image_url?: string;
  action_url?: string;
  data?: Record<string, any>;
  target: {
    type: "all" | "device_ids" | "topics" | "segments";
    device_ids?: string[];
    topics?: string[];
    segments?: string[];
  };
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  created_at: string;
}

interface Event {
  event_id: string;
  device_id: string;
  event_name: string;
  event_data: Record<string, any>;
  timestamp: string;
  created_at: string;
}

const apps = new Map<string, App>();
const devices = new Map<string, Device>();
const notifications = new Map<string, Notification>();
const events: Event[] = [];

// Lookup maps
const apiKeyToAppId = new Map<string, string>();
const packageNameToAppId = new Map<string, string>();
const devicesByAppId = new Map<string, Set<string>>();

// Helper: Generate API key
function generateApiKey(): string {
  return `apk_live_${crypto.randomBytes(16).toString("hex")}`;
}

// Helper: Verify API key
function verifyApiKey(apiKey: string): App | null {
  const appId = apiKeyToAppId.get(apiKey);
  if (!appId) return null;
  return apps.get(appId) || null;
}

// Helper: Get current timestamp
function now(): string {
  return new Date().toISOString();
}

/**
 * 1. Register App (First Build)
 * POST /api/v1/apps/register
 */
router.post("/apps/register", async (req: Request, res: Response) => {
  try {
    const { package_name, app_name, version_code, version_name, developer_email, developer_name } = req.body;

    // Validation
    if (!package_name || !app_name) {
      return res.status(400).json({
        success: false,
        error: "package_name and app_name are required",
      });
    }

    // Check if app already exists
    let existingAppId = packageNameToAppId.get(package_name);
    if (existingAppId) {
      const existingApp = apps.get(existingAppId);
      return res.status(200).json({
        success: true,
        app_id: existingApp!.app_id,
        api_key: existingApp!.api_key,
        message: "App already registered",
      });
    }

    // Create new app
    const app_id = `app_${uuidv4().substring(0, 12)}`;
    const api_key = generateApiKey();

    const app: App = {
      app_id,
      package_name,
      app_name,
      version_code: version_code || 1,
      version_name: version_name || "1.0.0",
      developer_email: developer_email || "",
      developer_name: developer_name || "",
      api_key,
      created_at: now(),
    };

    apps.set(app_id, app);
    apiKeyToAppId.set(api_key, app_id);
    packageNameToAppId.set(package_name, app_id);
    devicesByAppId.set(app_id, new Set());

    console.log(`📱 New app registered: ${app_name} (${package_name})`);

    res.status(200).json({
      success: true,
      app_id,
      api_key,
      message: "App registered successfully",
    });
  } catch (error: any) {
    console.error("Error registering app:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 2. Register Device (First Install)
 * POST /api/v1/devices/register
 */
router.post("/devices/register", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-apkzio-api-key"] as string;
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "API key required" });
    }

    const app = verifyApiKey(apiKey);
    if (!app) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const {
      device_id: clientDeviceId,
      fcm_token,
      platform,
      os_version,
      app_version,
      model,
      manufacturer,
      locale,
      timezone,
    } = req.body;

    // Validation
    if (!fcm_token || !platform) {
      return res.status(400).json({
        success: false,
        error: "fcm_token and platform are required",
      });
    }

    // Check if device already exists
    if (devices.has(clientDeviceId)) {
      const existing = devices.get(clientDeviceId)!;
      existing.fcm_token = fcm_token;
      existing.last_seen = now();
      devices.set(clientDeviceId, existing);

      return res.status(200).json({
        success: true,
        device_id: existing.device_id,
        subscriber_id: existing.subscriber_id,
        message: "Device already registered, token updated",
      });
    }

    // Create new device
    const device_id = clientDeviceId || `device_${uuidv4().substring(0, 12)}`;
    const subscriber_id = `sub_${uuidv4().substring(0, 12)}`;

    const device: Device = {
      device_id,
      subscriber_id,
      app_id: app.app_id,
      fcm_token,
      platform: platform || "android",
      os_version: os_version || "unknown",
      app_version: app_version || "1.0.0",
      model: model || "unknown",
      manufacturer: manufacturer || "unknown",
      locale: locale || "en_US",
      timezone: timezone || "UTC",
      subscribed: false,
      subscribed_at: null,
      last_seen: now(),
      created_at: now(),
    };

    devices.set(device_id, device);
    devicesByAppId.get(app.app_id)?.add(device_id);

    console.log(`📱 New device registered: ${device_id} for app ${app.app_name}`);

    res.status(200).json({
      success: true,
      device_id,
      subscriber_id,
      message: "Device registered successfully",
    });
  } catch (error: any) {
    console.error("Error registering device:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 3. Update FCM Token
 * PUT /api/v1/devices/:deviceId/token
 */
router.put("/devices/:deviceId/token", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-apkzio-api-key"] as string;
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "API key required" });
    }

    const app = verifyApiKey(apiKey);
    if (!app) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const { deviceId } = req.params;
    const { fcm_token } = req.body;

    if (!fcm_token) {
      return res.status(400).json({
        success: false,
        error: "fcm_token is required",
      });
    }

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    device.fcm_token = fcm_token;
    device.last_seen = now();
    devices.set(deviceId, device);

    res.status(200).json({
      success: true,
      message: "FCM token updated successfully",
    });
  } catch (error: any) {
    console.error("Error updating FCM token:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 4. Subscribe to Notifications
 * POST /api/v1/devices/:deviceId/subscribe
 */
router.post("/devices/:deviceId/subscribe", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-apkzio-api-key"] as string;
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "API key required" });
    }

    const app = verifyApiKey(apiKey);
    if (!app) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const { deviceId } = req.params;
    const { fcm_token, topics, user_consent } = req.body;

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    if (fcm_token) {
      device.fcm_token = fcm_token;
    }

    device.subscribed = true;
    device.subscribed_at = now();
    device.last_seen = now();
    devices.set(deviceId, device);

    console.log(`🔔 Device ${deviceId} subscribed to notifications for app ${app.app_name}`);

    res.status(200).json({
      success: true,
      subscriber_id: device.subscriber_id,
      subscribed_at: device.subscribed_at,
      message: "Subscribed successfully",
    });
  } catch (error: any) {
    console.error("Error subscribing to notifications:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 5. Unsubscribe from Notifications
 * POST /api/v1/devices/:deviceId/unsubscribe
 */
router.post("/devices/:deviceId/unsubscribe", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-apkzio-api-key"] as string;
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "API key required" });
    }

    const app = verifyApiKey(apiKey);
    if (!app) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const { deviceId } = req.params;
    const { reason } = req.body;

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    device.subscribed = false;
    device.last_seen = now();
    devices.set(deviceId, device);

    console.log(`🔕 Device ${deviceId} unsubscribed from notifications (reason: ${reason})`);

    res.status(200).json({
      success: true,
      message: "Unsubscribed successfully",
    });
  } catch (error: any) {
    console.error("Error unsubscribing from notifications:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 6. Track Event
 * POST /api/v1/events/track
 */
router.post("/events/track", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-apkzio-api-key"] as string;
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "API key required" });
    }

    const app = verifyApiKey(apiKey);
    if (!app) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const { device_id, event_name, event_data, timestamp } = req.body;

    if (!device_id || !event_name) {
      return res.status(400).json({
        success: false,
        error: "device_id and event_name are required",
      });
    }

    const event: Event = {
      event_id: `evt_${uuidv4().substring(0, 12)}`,
      device_id,
      event_name,
      event_data: event_data || {},
      timestamp: timestamp || now(),
      created_at: now(),
    };

    events.push(event);

    res.status(200).json({
      success: true,
      message: "Event tracked successfully",
    });
  } catch (error: any) {
    console.error("Error tracking event:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 7. Get Notification Status
 * GET /api/v1/devices/:deviceId/status
 */
router.get("/devices/:deviceId/status", async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers["x-apkzio-api-key"] as string;
    if (!apiKey) {
      return res.status(401).json({ success: false, error: "API key required" });
    }

    const app = verifyApiKey(apiKey);
    if (!app) {
      return res.status(401).json({ success: false, error: "Invalid API key" });
    }

    const { deviceId } = req.params;

    const device = devices.get(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        error: "Device not found",
      });
    }

    res.status(200).json({
      success: true,
      device_id: device.device_id,
      subscribed: device.subscribed,
      fcm_token: device.fcm_token,
      subscribed_at: device.subscribed_at,
      last_seen: device.last_seen,
    });
  } catch (error: any) {
    console.error("Error getting device status:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 8. Send Push Notification (Admin)
 * POST /api/v1/notifications/send
 */
router.post("/notifications/send", async (req: Request, res: Response) => {
  try {
    const adminKey = req.headers["x-apkzio-admin-key"] as string;
    if (!adminKey) {
      return res.status(401).json({ success: false, error: "Admin key required" });
    }

    // Verify admin key (check against APKZIO_ADMIN_API_KEY env var)
    const validAdminKey = process.env.APKZIO_ADMIN_API_KEY;
    if (adminKey !== validAdminKey) {
      return res.status(401).json({ success: false, error: "Invalid admin key" });
    }

    const { app_id, title, body, image_url, action_url, data, target } = req.body;

    if (!app_id || !title || !body || !target) {
      return res.status(400).json({
        success: false,
        error: "app_id, title, body, and target are required",
      });
    }

    const app = apps.get(app_id);
    if (!app) {
      return res.status(404).json({
        success: false,
        error: "App not found",
      });
    }

    // Get target devices
    const appDeviceIds = devicesByAppId.get(app_id) || new Set();
    let targetDevices: Device[] = [];

    if (target.type === "all") {
      targetDevices = Array.from(appDeviceIds)
        .map(id => devices.get(id))
        .filter((d): d is Device => d !== undefined && d.subscribed);
    } else if (target.type === "device_ids" && target.device_ids) {
      targetDevices = target.device_ids
        .map(id => devices.get(id))
        .filter((d): d is Device => d !== undefined && d.subscribed);
    }

    const notification_id = `notif_${uuidv4().substring(0, 12)}`;
    const sent_count = targetDevices.length;

    // In production, send to Firebase Cloud Messaging here
    // For now, just log and store notification
    const notification: Notification = {
      notification_id,
      app_id,
      title,
      body,
      image_url,
      action_url,
      data,
      target,
      sent_count,
      failed_count: 0,
      delivered_count: 0,
      opened_count: 0,
      clicked_count: 0,
      created_at: now(),
    };

    notifications.set(notification_id, notification);

    console.log(`📤 Notification sent: "${title}" to ${sent_count} devices for app ${app.app_name}`);

    // TODO: Actually send via FCM
    // const fcmTokens = targetDevices.map(d => d.fcm_token);
    // await sendFcmMulticast(fcmTokens, { title, body, data });

    res.status(200).json({
      success: true,
      notification_id,
      sent_count,
      failed_count: 0,
      message: "Notification sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 9. Get Notification Analytics
 * GET /api/v1/notifications/:notificationId/analytics
 */
router.get("/notifications/:notificationId/analytics", async (req: Request, res: Response) => {
  try {
    const adminKey = req.headers["x-apkzio-admin-key"] as string;
    if (!adminKey) {
      return res.status(401).json({ success: false, error: "Admin key required" });
    }

    const validAdminKey = process.env.APKZIO_ADMIN_API_KEY;
    if (adminKey !== validAdminKey) {
      return res.status(401).json({ success: false, error: "Invalid admin key" });
    }

    const { notificationId } = req.params;

    const notification = notifications.get(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    const delivery_rate = notification.sent_count > 0 
      ? ((notification.delivered_count / notification.sent_count) * 100).toFixed(1)
      : "0.0";

    const open_rate = notification.delivered_count > 0
      ? ((notification.opened_count / notification.delivered_count) * 100).toFixed(1)
      : "0.0";

    const click_rate = notification.opened_count > 0
      ? ((notification.clicked_count / notification.opened_count) * 100).toFixed(1)
      : "0.0";

    res.status(200).json({
      success: true,
      notification_id: notification.notification_id,
      sent_at: notification.created_at,
      stats: {
        sent: notification.sent_count,
        delivered: notification.delivered_count,
        opened: notification.opened_count,
        clicked: notification.clicked_count,
        failed: notification.failed_count,
      },
      delivery_rate: parseFloat(delivery_rate),
      open_rate: parseFloat(open_rate),
      click_rate: parseFloat(click_rate),
    });
  } catch (error: any) {
    console.error("Error getting notification analytics:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 10. Get App Subscribers
 * GET /api/v1/apps/:appId/subscribers
 */
router.get("/apps/:appId/subscribers", async (req: Request, res: Response) => {
  try {
    const adminKey = req.headers["x-apkzio-admin-key"] as string;
    if (!adminKey) {
      return res.status(401).json({ success: false, error: "Admin key required" });
    }

    const validAdminKey = process.env.APKZIO_ADMIN_API_KEY;
    if (adminKey !== validAdminKey) {
      return res.status(401).json({ success: false, error: "Invalid admin key" });
    }

    const { appId } = req.params;
    const { page = "1", limit = "50", subscribed, platform } = req.query;

    const app = apps.get(appId);
    if (!app) {
      return res.status(404).json({
        success: false,
        error: "App not found",
      });
    }

    const appDeviceIds = devicesByAppId.get(appId) || new Set();
    let appDevices = Array.from(appDeviceIds)
      .map(id => devices.get(id))
      .filter((d): d is Device => d !== undefined);

    // Filter by subscribed status
    if (subscribed !== undefined) {
      const isSubscribed = subscribed === "true";
      appDevices = appDevices.filter(d => d.subscribed === isSubscribed);
    }

    // Filter by platform
    if (platform) {
      appDevices = appDevices.filter(d => d.platform === platform);
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;

    const paginatedDevices = appDevices.slice(start, end);

    const subscribers = paginatedDevices.map(d => ({
      subscriber_id: d.subscriber_id,
      device_id: d.device_id,
      fcm_token: d.fcm_token,
      platform: d.platform,
      os_version: d.os_version,
      app_version: d.app_version,
      subscribed: d.subscribed,
      subscribed_at: d.subscribed_at,
      last_seen: d.last_seen,
      model: d.model,
    }));

    res.status(200).json({
      success: true,
      total: appDevices.length,
      page: pageNum,
      limit: limitNum,
      subscribers,
    });
  } catch (error: any) {
    console.error("Error getting app subscribers:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * 11. List All Apps (Admin)
 * GET /api/v1/apps
 */
router.get("/apps", async (req: Request, res: Response) => {
  try {
    const adminKey = req.headers["x-apkzio-admin-key"] as string;
    if (!adminKey) {
      return res.status(401).json({ success: false, error: "Admin key required" });
    }

    const validAdminKey = process.env.APKZIO_ADMIN_API_KEY;
    if (adminKey !== validAdminKey) {
      return res.status(401).json({ success: false, error: "Invalid admin key" });
    }

    const appsList = Array.from(apps.values()).map(app => {
      const deviceCount = (devicesByAppId.get(app.app_id) || new Set()).size;
      const subscriberCount = Array.from(devicesByAppId.get(app.app_id) || new Set())
        .map(id => devices.get(id))
        .filter(d => d && d.subscribed).length;

      return {
        app_id: app.app_id,
        package_name: app.package_name,
        app_name: app.app_name,
        version_code: app.version_code,
        version_name: app.version_name,
        developer_email: app.developer_email,
        api_key: app.api_key,
        device_count: deviceCount,
        subscriber_count: subscriberCount,
        created_at: app.created_at,
      };
    });

    res.status(200).json({
      success: true,
      total: appsList.length,
      apps: appsList,
    });
  } catch (error: any) {
    console.error("Error listing apps:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

export default router;
