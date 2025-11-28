-- Delete duplicate auth users (keep only the one matching profile id)
DELETE FROM auth.identities 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email LIKE '%@tivoo.internal%' 
  AND id NOT IN (SELECT id FROM profiles)
);

DELETE FROM auth.users 
WHERE email LIKE '%@tivoo.internal%' 
AND id NOT IN (SELECT id FROM profiles);