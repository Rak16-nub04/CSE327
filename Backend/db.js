const mongoose = require('mongoose');
const https = require('https');
const runtime = require('./runtime');

function envBool(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  if (typeof raw !== 'string') return Boolean(raw);
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return defaultValue;
}

function envInt(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function parseMongoUri(uri) {
  try {
    const u = new URL(uri);
    const username = u.username ? decodeURIComponent(u.username) : null;
    const password = u.password ? decodeURIComponent(u.password) : null;
    const dbName = u.pathname && u.pathname !== '/' ? u.pathname.slice(1) : null;
    const search = u.searchParams;
    return { username, password, dbName, searchParams: search, protocol: u.protocol };
  } catch {
    return null;
  }
}

function buildDirectUri({ host, port, username, password, dbName, searchParams, replicaSet }) {
  const authPart = username ? `${encodeURIComponent(username)}:${encodeURIComponent(password || '')}@` : '';
  const dbPart = dbName ? `/${dbName}` : '';
  const params = new URLSearchParams(searchParams || undefined);
  params.set('tls', 'true');
  params.delete('ssl');
  if (replicaSet) params.set('replicaSet', replicaSet);
  const query = params.toString();
  return `mongodb://${authPart}${host}:${port}${dbPart}${query ? `?${query}` : ''}`;
}

function redactMongoUri(uri) {
  if (typeof uri !== 'string') return '';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^@/]+)@/i, '$1<redacted>@');
}

function readUriFlag(uri, key) {
  try {
    const u = new URL(uri);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

const getPublicIP = () =>
  new Promise((resolve) => {
    const req = https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.ip || 'Unknown');
        } catch {
          resolve('Unknown');
        }
      });
    });

    req.on('error', () => resolve('Unknown'));
    req.setTimeout(4000, () => {
      req.destroy();
      resolve('Unknown');
    });
  });

const connectDB = async () => {
  const directHost = process.env.MONGO_DIRECT_HOST;
  const directPort = envInt('MONGO_DIRECT_PORT', 27017);
  const directReplicaSet = process.env.MONGO_REPLICA_SET || null;
  let parsed = null;

  try {
    const uri = process.env.MONGO_URI;

    if (!uri) {
      runtime.storage.mode = 'json';
      runtime.storage.mongoConnected = false;
      runtime.storage.mongoError = 'MONGO_URI not set';
      console.warn('[storage] MONGO_URI not set; using JSON file storage');
      return false;
    }

    const usingSrv = typeof uri === 'string' && uri.startsWith('mongodb+srv://');
    const tlsParam = readUriFlag(uri, 'tls') ?? readUriFlag(uri, 'ssl');
    const disablesTls = typeof tlsParam === 'string' && tlsParam.trim().toLowerCase() === 'false';

    parsed = parseMongoUri(uri);

    const serverSelectionTimeoutMS = envInt('MONGO_SERVER_SELECTION_TIMEOUT_MS', 8000);
    const ipv4Only = envBool('MONGO_IPV4_ONLY', false);
    const tlsInsecure = envBool('MONGO_TLS_INSECURE', false);
    const tlsAllowInvalidCertificates = envBool('MONGO_TLS_ALLOW_INVALID_CERTS', false);
    const tlsAllowInvalidHostnames = envBool('MONGO_TLS_ALLOW_INVALID_HOSTNAMES', false);
    const tlsCAFile = process.env.MONGO_TLS_CA_FILE;

    if (usingSrv && disablesTls) {
      console.warn(
        '[storage] Your MONGO_URI includes tls=false/ssl=false but MongoDB Atlas requires TLS. ' +
          'Remove that flag from the URI. Attempting connection with TLS enabled anyway.'
      );
    }

    const mongooseOptions = {
      serverSelectionTimeoutMS,
      ...(ipv4Only ? { family: 4 } : {}),
      ...(usingSrv || disablesTls ? { tls: true } : {}),
      ...(tlsInsecure
        ? { tlsInsecure: true }
        : {
            ...(tlsAllowInvalidCertificates ? { tlsAllowInvalidCertificates: true } : {}),
            ...(tlsAllowInvalidHostnames ? { tlsAllowInvalidHostnames: true } : {})
          }),
      ...(typeof tlsCAFile === 'string' && tlsCAFile.trim() ? { tlsCAFile: tlsCAFile.trim() } : {})
    };

    const conn = await mongoose.connect(uri, mongooseOptions);

    runtime.storage.mode = 'mongo';
    runtime.storage.mongoConnected = true;
    runtime.storage.mongoError = null;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    runtime.storage.mode = 'json';
    runtime.storage.mongoConnected = false;
    runtime.storage.mongoError = error.message;

    const isTlsError =
      typeof error?.message === 'string' &&
      /\bssl\b|\btls\b|ERR_SSL|tlsv1 alert/i.test(error.message);
    const usingSrv = typeof process.env.MONGO_URI === 'string' && process.env.MONGO_URI.startsWith('mongodb+srv://');

    if (isTlsError && usingSrv) {
      const ip = await getPublicIP();
      console.warn(
        `[storage] MongoDB connection failed (TLS/SSL handshake). Reason: ${error.message}\n` +
          `[storage] Node/OpenSSL: ${process.versions.node} / ${process.versions.openssl}\n` +
          `[storage] URI: ${redactMongoUri(process.env.MONGO_URI)}\n` +
          `[storage] Atlas hint: ensure Network Access allowlist includes your IP (${ip}) or temporarily allow 0.0.0.0/0 for local dev.\n` +
          `[storage] If you are on a restrictive network, try setting MONGO_IPV4_ONLY=1.\n` +
          `[storage] As a last resort for local dev only, try MONGO_TLS_INSECURE=1 (disables cert validation).`
      );

      if (directHost && parsed) {
        console.warn(`[storage] Attempting direct-host fallback to ${directHost}:${directPort}...`);
        const directUri = buildDirectUri({
          host: directHost,
          port: directPort,
          username: parsed.username,
          password: parsed.password,
          dbName: parsed.dbName,
          searchParams: parsed.searchParams,
          replicaSet: directReplicaSet
        });
        try {
          const conn = await mongoose.connect(directUri, {
            serverSelectionTimeoutMS: envInt('MONGO_SERVER_SELECTION_TIMEOUT_MS', 8000),
            family: envBool('MONGO_IPV4_ONLY', false) ? 4 : undefined,
            tls: true,
            tlsInsecure: envBool('MONGO_TLS_INSECURE', false) || undefined,
            tlsAllowInvalidCertificates: envBool('MONGO_TLS_ALLOW_INVALID_CERTS', false) || undefined,
            tlsAllowInvalidHostnames: envBool('MONGO_TLS_ALLOW_INVALID_HOSTNAMES', false) || undefined
          });
          runtime.storage.mode = 'mongo';
          runtime.storage.mongoConnected = true;
          runtime.storage.mongoError = null;
          console.warn(
            `[storage] Fallback connected via direct host ${directHost}:${directPort}. This is intended for temporary local debugging.`
          );
          return true;
        } catch (directErr) {
          console.warn(
            `[storage] Direct-host fallback failed (${directHost}:${directPort}); staying on JSON. Reason: ${directErr.message}`
          );
        }
      }

      return false;
    }

    console.warn(`[storage] MongoDB connection failed; using JSON file storage. Reason: ${error.message}`);
    return false;
  }
};

module.exports = connectDB;
