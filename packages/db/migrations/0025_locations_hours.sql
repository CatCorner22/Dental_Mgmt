-- Increment 1.29: a location's business hours (docs/13 item on after-hours
-- holds: "locations gains hours jsonb").
--
-- One window per weekday as ["HH:MM", "HH:MM"] in the location's own
-- timezone, or null for a closed day. The default is a plain dental week;
-- the practice edits it when a settings surface exists. The after-hours
-- refund hard event reads it with the server clock, never the browser's.

ALTER TABLE locations
  ADD COLUMN hours jsonb NOT NULL DEFAULT
    '{"mon":["07:00","19:00"],"tue":["07:00","19:00"],"wed":["07:00","19:00"],"thu":["07:00","19:00"],"fri":["07:00","17:00"],"sat":null,"sun":null}'::jsonb;
