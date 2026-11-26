USE `web-clothing-store`;

-- =========================
-- USERS
-- =========================
INSERT INTO users (name, password, email, role)
VALUES
(
    'admin',
    '$2b$10$ne2iJK1N.qgxPD6iMBu1nul2d1MbqTlDwEAPaJNUFi3SScooqhCrW',
    'admin@webapp.lab',
    'admin'
),
(
    'hacker',
    '$2b$10$ne2iJK1N.qgxPD6iMBu1nul2d1MbqTlDwEAPaJNUFi3SScooqhCrW',
    'hacker@webapp.lab',
    'user'
);
