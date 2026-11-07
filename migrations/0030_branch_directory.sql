-- Phase 16: operational branch directory and public branch publishing.
-- Branches remain the source of truth for staff/client assignment. The public
-- site mirrors branches flagged is_public through app_settings.site_config.

ALTER TABLE branches ADD COLUMN city TEXT;
ALTER TABLE branches ADD COLUMN state TEXT;
ALTER TABLE branches ADD COLUMN address TEXT;
ALTER TABLE branches ADD COLUMN phone TEXT;
ALTER TABLE branches ADD COLUMN branch_type TEXT;
ALTER TABLE branches ADD COLUMN is_head_office INTEGER NOT NULL DEFAULT 0;
ALTER TABLE branches ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_branches_public ON branches(is_public);

INSERT INTO branches (name, city, state, address, phone, branch_type, is_head_office, is_public)
SELECT 'Nyanya', 'Nyanya', 'Abuja, FCT',
       '1st Building by the 1st Pedestrian Bridge along Government Secondary School 3 road, Nyanya, Abuja, FCT, Nigeria.',
       '0805 070 0000', 'Head Office', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name='Nyanya');

UPDATE branches
SET city='Nyanya', state='Abuja, FCT',
    address='1st Building by the 1st Pedestrian Bridge along Government Secondary School 3 road, Nyanya, Abuja, FCT, Nigeria.',
    phone='0805 070 0000', branch_type='Head Office', is_head_office=1, is_public=1
WHERE name='Nyanya';
