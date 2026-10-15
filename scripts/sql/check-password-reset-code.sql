-- Verify the 6-digit code from your email matches what is stored (replace CODE and user_id).
--
-- 1) On the server, compute the expected hash (replace 123456 with the code from the email subject):
--    node -e "const c=require('crypto');const code='123456';console.log(c.createHash('sha256').update('password-reset:'+code).digest('hex'))"
--
-- 2) Compare to code_hash below:

SELECT
  user_id,
  email,
  length(code_hash) AS hash_len,
  created_at,
  expires_at,
  (expires_at > now()) AS still_valid,
  code_hash
FROM auth_password_reset_codes
WHERE user_id = 'user_5a2f66e47e20a3d36c691aa7';
