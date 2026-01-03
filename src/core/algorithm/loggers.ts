import type { ApiCacheKey, Action } from "../enums";
import { ALL_ACTIONS, buildCacheKeyDict } from "../enums";
import { Logger } from "../helpers/logger";

const logger = new Logger("FeedCoordinator");
const loadCacheLogger = logger.tempLogger("loadCachedData()");
const saveTimelineToCacheLogger = logger.tempLogger("saveTimelineToCache");

const loggers = buildCacheKeyDict<Action, Logger, Record<Action, Logger>>(
	(key) => new Logger(key as string),
	ALL_ACTIONS.reduce(
		(_loggers, action) => {
			_loggers[action] = logger.tempLogger(action);
			return _loggers;
		},
		{} as Record<Action, Logger>,
	),
) as Record<Action | ApiCacheKey, Logger>;

export { logger, loadCacheLogger, saveTimelineToCacheLogger, loggers };
