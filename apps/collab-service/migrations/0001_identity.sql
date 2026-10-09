CREATE TABLE devices (id TEXT PRIMARY KEY, public_key TEXT NOT NULL, name TEXT NOT NULL);
CREATE TABLE rooms (id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES devices(id), code_hash TEXT UNIQUE, generation TEXT NOT NULL);
CREATE INDEX rooms_owner ON rooms(owner);
CREATE TABLE grants (room TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, device TEXT NOT NULL REFERENCES devices(id), generation TEXT NOT NULL, PRIMARY KEY(room, device));
CREATE TABLE nonces (device TEXT NOT NULL, nonce TEXT NOT NULL, expires INTEGER NOT NULL, PRIMARY KEY(device, nonce));
CREATE INDEX nonces_expiry ON nonces(expires);
CREATE TABLE limits (scope TEXT NOT NULL, bucket INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(scope, bucket));
