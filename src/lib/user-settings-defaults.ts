export const DEFAULT_USER_SETTINGS = {
	schemaVersion: 1 as const,
	mail: {
		trashExpireDays: 30,
		categories: ["Inbox", "Social", "Promotion"],
	},
};

export const DEFAULT_USER_SETTINGS_JSON = JSON.stringify(DEFAULT_USER_SETTINGS);
