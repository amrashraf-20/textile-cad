-- 0002_seed.sql — default market rates and a small global yarn library
INSERT INTO price_rates (key, value, unit, source) VALUES
    ('usd_egp', 49.5000, 'EGP per USD', 'seed'),
    ('cotton_usd_kg', 1.7500, 'USD per kg', 'seed'),
    ('polyester_usd_kg', 1.1500, 'USD per kg', 'seed')
ON CONFLICT (key) DO NOTHING;

INSERT INTO yarns (user_id, name, system, count, material, price_egp, is_global) VALUES
    (NULL, 'Egyptian Cotton 20/1', 'ne', 20, 'Combed cotton', 120.00, true),
    (NULL, 'Egyptian Cotton 30/1', 'ne', 30, 'Combed cotton', 145.00, true),
    (NULL, 'Carded Cotton 16/1', 'ne', 16, 'Carded cotton', 95.00, true),
    (NULL, 'Polyester Spun 24/1', 'ne', 24, 'Polyester', 78.00, true),
    (NULL, 'Polyester Filament 150D', 'denier', 150, 'Filament', 62.00, true),
    (NULL, 'Cotton/Poly 30/1 (TC)', 'ne', 30, 'Blend 65/35', 105.00, true)
ON CONFLICT DO NOTHING;
