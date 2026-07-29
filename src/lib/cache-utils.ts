// Safe in-memory cache for master data
// TTL defaults to 5 minutes

type CacheItem<T> = {
    data: T;
    timestamp: number;
};

class MemoryCache {
    private cache: Map<string, CacheItem<any>> = new Map();
    private defaultTTL = 5 * 60 * 1000; // 5 minutes

    set<T>(key: string, data: T, ttl: number = this.defaultTTL) {
        this.cache.set(key, {
            data,
            timestamp: Date.now() + ttl
        });
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.timestamp) {
            this.cache.delete(key);
            return null;
        }
        return item.data as T;
    }

    invalidate(keyOrPrefix: string) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(keyOrPrefix)) {
                this.cache.delete(key);
            }
        }
    }

    clear() {
        this.cache.clear();
    }
}

export const globalCache = new MemoryCache();
