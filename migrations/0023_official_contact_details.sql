-- Seed Elpis Property Limited's own public contact details. Do not use inherited company details.
UPDATE app_settings
SET setting_value = '{"company_name":"Elpis Property Limited","tagline":"Your Future Begins With the Right Property.","phone":"","whatsapp_number":"","email":"hr@elpisproperty.org","address":"","facebook":"","instagram":"","twitter":"","linkedin":"","branches":[{"name":"Head Office","city":"","state":"","type":"Corporate Headquarters","address":"","phone":"","isHeadOffice":true}]}',
    updated_at = datetime('now')
WHERE setting_key = 'site_config'
  AND (
    setting_value IS NULL
    OR setting_value = ''
    OR setting_value = '{}'
    OR json_extract(setting_value, '$.phone') IS NULL
    OR json_extract(setting_value, '$.phone') = ''
    OR json_extract(setting_value, '$.email') IS NULL
    OR json_extract(setting_value, '$.email') = ''
  );
