const { Mutex } = require('async-mutex');
const Redis = require('ioredis');

class TicketManager {
    constructor(options = {}) {
        this.initialSpots = options.initialSpots || 20;
        this.mode = options.mode || 'local'; // 'local' | 'redis'

        // Local state
        this.localSpots = this.initialSpots;
        this.localApproved = 0;
        this.localRejected = 0;
        this.mutex = new Mutex();

        // Redis state
        this.redisHost = options.redisHost || process.env.REDIS_HOST || 'localhost';
        this.redisPort = options.redisPort || process.env.REDIS_PORT || 6379;
        this.redis = null;

        if (this.mode === 'redis') {
            this._initRedis();
        }
    }

    _initRedis() {
        if (!this.redis) {
            this.redis = new Redis({
                host: this.redisHost,
                port: this.redisPort,
                retryStrategy: (times) => Math.min(times * 100, 2000),
                maxRetriesPerRequest: 3,
                lazyConnect: true
            });

            // Define atomic reservation Lua script
            this.redis.defineCommand('atomicReserve', {
                numberOfKeys: 3,
                lua: `
                    local available = tonumber(redis.call('get', KEYS[1]) or 0)
                    if available > 0 then
                        redis.call('decr', KEYS[1])
                        local approved = redis.call('incr', KEYS[2])
                        return {1, available - 1, approved}
                    else
                        local rejected = redis.call('incr', KEYS[3])
                        return {0, 0, rejected}
                    end
                `
            });

            this.redis.connect().catch((err) => {
                console.error(`[Redis Error] Failed to connect to ${this.redisHost}:${this.redisPort}:`, err.message);
            });
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'redis' && !this.redis) {
            this._initRedis();
        }
    }

    async reserve() {
        if (this.mode === 'redis') {
            return this._reserveRedis();
        }
        return this._reserveLocal();
    }

    async _reserveLocal() {
        return this.mutex.runExclusive(async () => {
            if (this.localSpots > 0) {
                this.localSpots--;
                this.localApproved++;
                return {
                    approved: true,
                    remaining: this.localSpots,
                    approvedTotal: this.localApproved,
                    rejectedTotal: this.localRejected
                };
            } else {
                this.localRejected++;
                return {
                    approved: false,
                    remaining: 0,
                    approvedTotal: this.localApproved,
                    rejectedTotal: this.localRejected
                };
            }
        });
    }

    async _reserveRedis() {
        if (!this.redis) {
            this._initRedis();
        }
        try {
            // [resultStatus, remaining, totalCount]
            const result = await this.redis.atomicReserve(
                'ticketrush:available',
                'ticketrush:approved',
                'ticketrush:rejected'
            );

            const isApproved = result[0] === 1;
            const remaining = result[1];
            const currentCount = result[2];

            return {
                approved: isApproved,
                remaining: remaining,
                approvedTotal: isApproved ? currentCount : undefined,
                rejectedTotal: !isApproved ? currentCount : undefined
            };
        } catch (err) {
            console.error('[Redis Reserve Error]', err.message);
            throw err;
        }
    }

    async getStatus() {
        if (this.mode === 'redis') {
            try {
                if (!this.redis) this._initRedis();
                const [spots, approved, rejected] = await Promise.all([
                    this.redis.get('ticketrush:available'),
                    this.redis.get('ticketrush:approved'),
                    this.redis.get('ticketrush:rejected')
                ]);

                return {
                    storage: 'redis',
                    total: this.initialSpots,
                    available: spots !== null ? parseInt(spots, 10) : this.initialSpots,
                    approved: approved !== null ? parseInt(approved, 10) : 0,
                    rejected: rejected !== null ? parseInt(rejected, 10) : 0
                };
            } catch (err) {
                return {
                    storage: 'redis (error)',
                    error: err.message,
                    total: this.initialSpots,
                    available: 0,
                    approved: 0,
                    rejected: 0
                };
            }
        }

        return {
            storage: 'local',
            total: this.initialSpots,
            available: this.localSpots,
            approved: this.localApproved,
            rejected: this.localRejected
        };
    }

    async reset() {
        this.localSpots = this.initialSpots;
        this.localApproved = 0;
        this.localRejected = 0;

        if (this.mode === 'redis') {
            try {
                if (!this.redis) this._initRedis();
                await Promise.all([
                    this.redis.set('ticketrush:available', this.initialSpots),
                    this.redis.set('ticketrush:approved', 0),
                    this.redis.set('ticketrush:rejected', 0)
                ]);
            } catch (err) {
                console.error('[Redis Reset Error]', err.message);
            }
        }

        return {
            ok: true,
            storage: this.mode,
            available: this.initialSpots,
            approved: 0,
            rejected: 0
        };
    }
}

module.exports = { TicketManager };
