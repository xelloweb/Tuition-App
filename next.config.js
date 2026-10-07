/** @type {import('next').NextConfig} */
// The local SQLite file is no longer bundled into builds: it can hold real
// people's data, and the hosted site uses its own database (DATABASE_URL).
const nextConfig = {};

module.exports = nextConfig;
